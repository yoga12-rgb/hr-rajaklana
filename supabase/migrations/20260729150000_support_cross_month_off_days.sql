-- Preserve the business ownership of a week while allowing the actual off day
-- to fall in the following calendar month. A week belongs to the month that
-- contains its Monday.

create or replace function public.save_cross_month_roster_off_day(
  p_month_start date,
  p_employee_id uuid,
  p_off_date date,
  p_reason text,
  p_source_week_start date default null,
  p_borrowed_from_adjacent_week boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  draft_id uuid;
  period_id uuid;
  owner_month_end date;
  last_owner_week_start date;
  carry_over_limit date;
  target_week_start date;
  selected_source_week_start date;
  origin_outlet_id uuid;
  existing_off public.employee_off_days%rowtype;
  saved_off public.employee_off_days%rowtype;
  before_values jsonb;
begin
  if not public.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'Hanya supervisor yang dapat mengatur off day lintas bulan.';
  end if;

  if p_month_start is null
    or p_month_start <> date_trunc('month', p_month_start)::date then
    raise exception using
      errcode = '22023',
      message = 'Periode roster harus menggunakan tanggal pertama bulan.';
  end if;

  if p_employee_id is null or p_off_date is null then
    raise exception using
      errcode = '22023',
      message = 'Karyawan dan tanggal off wajib diisi.';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception using
      errcode = '22023',
      message = 'Alasan perubahan roster minimal 3 karakter.';
  end if;

  owner_month_end := (p_month_start + interval '1 month - 1 day')::date;
  last_owner_week_start :=
    owner_month_end - (extract(isodow from owner_month_end)::integer - 1);
  carry_over_limit := last_owner_week_start + 6;

  if p_off_date <= owner_month_end or p_off_date > carry_over_limit then
    raise exception using
      errcode = '22023',
      message = format(
        'Tanggal off lintas bulan hanya boleh %s sampai %s untuk roster %s.',
        owner_month_end + 1,
        carry_over_limit,
        p_month_start
      );
  end if;

  target_week_start :=
    p_off_date - (extract(isodow from p_off_date)::integer - 1);
  selected_source_week_start :=
    coalesce(p_source_week_start, target_week_start);

  if extract(isodow from selected_source_week_start)::integer <> 1
    or date_trunc('month', selected_source_week_start)::date
      <> p_month_start then
    raise exception using
      errcode = '22023',
      message = 'Pekan sumber off harus dimulai hari Senin dan dimiliki bulan roster yang sedang dibuka.';
  end if;

  if p_borrowed_from_adjacent_week then
    if abs(selected_source_week_start - target_week_start) <> 7 then
      raise exception using
        errcode = '22023',
        message = 'Off day hanya dapat dipinjam dari pekan bersebelahan.';
    end if;
  elsif selected_source_week_start <> target_week_start then
    raise exception using
      errcode = '22023',
      message = 'Sumber pekan berbeda wajib ditandai sebagai peminjaman off day.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'roster-off:' || p_employee_id::text || ':' ||
      selected_source_week_start::text,
      0
    )
  );

  perform 1
  from public.employees employee
  where employee.id = p_employee_id
    and employee.archived_at is null
    and employee.joined_at <= p_off_date;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'Karyawan aktif tidak ditemukan pada tanggal off.';
  end if;

  select placement.outlet_id
  into origin_outlet_id
  from public.employee_placements placement
  join public.outlets outlet
    on outlet.id = placement.outlet_id
  where placement.employee_id = p_employee_id
    and placement.is_primary
    and placement.start_date <= p_off_date
    and (
      placement.end_date is null
      or placement.end_date >= p_off_date
    )
    and outlet.is_active
  order by placement.start_date desc
  limit 1;

  if origin_outlet_id is null then
    raise exception using
      errcode = '22023',
      message = 'Karyawan tidak memiliki penempatan utama aktif pada tanggal off.';
  end if;

  draft_id := public.ensure_manual_roster_draft(p_month_start, p_reason);

  select version.roster_period_id
  into period_id
  from public.roster_versions version
  where version.id = draft_id;

  select off_day.*
  into existing_off
  from public.employee_off_days off_day
  join public.roster_periods period
    on period.id = off_day.roster_period_id
  where off_day.employee_id = p_employee_id
    and off_day.source_week_start = selected_source_week_start
  order by
    (period.id = period_id) desc,
    off_day.updated_at desc
  limit 1
  for update of off_day;

  if existing_off.id is not null then
    before_values := to_jsonb(existing_off);

    delete from public.schedule_assignments assignment
    using public.roster_versions version
    where version.id = assignment.roster_version_id
      and assignment.employee_id = p_employee_id
      and assignment.status = 'off'
      and (
        (
          version.id = draft_id
          and assignment.work_date = existing_off.off_date
        )
        or (
          version.status = 'draft'
          and assignment.assignment_source = 'generated'
          and assignment.work_date in (existing_off.off_date, p_off_date)
        )
      );

    update public.employee_off_days
    set
      roster_period_id = period_id,
      off_date = p_off_date,
      borrowed_from_adjacent_week = p_borrowed_from_adjacent_week,
      override_reason = case
        when p_borrowed_from_adjacent_week then trim(p_reason)
        else null
      end,
      set_by = actor_id,
      updated_at = now()
    where id = existing_off.id
    returning * into saved_off;
  else
    insert into public.employee_off_days (
      roster_period_id,
      employee_id,
      off_date,
      source_week_start,
      borrowed_from_adjacent_week,
      override_reason,
      set_by
    )
    values (
      period_id,
      p_employee_id,
      p_off_date,
      selected_source_week_start,
      p_borrowed_from_adjacent_week,
      case
        when p_borrowed_from_adjacent_week then trim(p_reason)
        else null
      end,
      actor_id
    )
    returning * into saved_off;
  end if;

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    before_values,
    after_values,
    reason
  )
  values (
    actor_id,
    'save_cross_month_roster_off_day',
    'employee_off_day',
    saved_off.id,
    before_values,
    to_jsonb(saved_off),
    trim(p_reason)
  );

  return jsonb_build_object(
    'roster_version_id', draft_id,
    'assignment_id', null,
    'off_day_id', saved_off.id,
    'carry_over', true,
    'affected_month_start', date_trunc('month', p_off_date)::date,
    'warnings', jsonb_build_array(jsonb_build_object(
      'code', 'cross_month_off_day',
      'message', format(
        'Off %s tetap memakai jatah pekan %s milik roster %s. Buat ulang roster %s agar jadwal ikut diperbarui.',
        p_off_date,
        selected_source_week_start,
        p_month_start,
        date_trunc('month', p_off_date)::date
      )
    ))
  );
end;
$$;

-- Keep the original snapshot builder as a private base, then enrich its
-- employee off-day input with owner-month carry-out and actual-month carry-in.
alter function public.get_roster_generation_input(date)
  rename to get_roster_generation_input_without_carry_over;

revoke all on function public.get_roster_generation_input_without_carry_over(date)
  from public, anon, authenticated;

create function public.get_roster_generation_input(
  p_month_start date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  base_snapshot jsonb;
  enriched_employees jsonb;
begin
  base_snapshot :=
    public.get_roster_generation_input_without_carry_over(p_month_start);

  select coalesce(
    jsonb_agg(
      (employee_item - 'offDays') ||
      jsonb_build_object(
        'offDays',
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'date', visible_off.off_date,
              'sourceWeekStart', visible_off.source_week_start
            )
            order by visible_off.source_week_start
          )
          from (
            select distinct on (off_day.source_week_start)
              off_day.off_date,
              off_day.source_week_start
            from public.employee_off_days off_day
            join public.roster_periods period
              on period.id = off_day.roster_period_id
            where off_day.employee_id = (employee_item->>'id')::uuid
              and (
                date_trunc('month', off_day.source_week_start)::date
                  = p_month_start
                or (
                  off_day.off_date >= p_month_start
                  and off_day.off_date
                    < (p_month_start + interval '1 month')::date
                )
              )
            order by
              off_day.source_week_start,
              (
                period.month_start
                  = date_trunc(
                    'month',
                    off_day.source_week_start
                  )::date
              ) desc,
              off_day.updated_at desc,
              off_day.id
          ) visible_off
        ), '[]'::jsonb)
      )
      order by employee_item->>'name'
    ),
    '[]'::jsonb
  )
  into enriched_employees
  from jsonb_array_elements(base_snapshot->'employees')
    as employee_rows(employee_item);

  return jsonb_set(
    base_snapshot,
    '{employees}',
    enriched_employees,
    true
  );
end;
$$;

-- Preserve the existing, thoroughly validated commit implementation and add a
-- transaction-local compatibility ledger for carry-in off assignments. The
-- temporary row is invisible outside this transaction and is removed before
-- the RPC returns; the durable source remains the owner-month ledger.
alter function public.commit_generated_roster(
  date,
  text,
  text,
  jsonb,
  text,
  jsonb,
  jsonb,
  jsonb
) rename to commit_generated_roster_without_carry_over;

revoke all on function public.commit_generated_roster_without_carry_over(
  date,
  text,
  text,
  jsonb,
  text,
  jsonb,
  jsonb,
  jsonb
) from public, anon, authenticated;

create function public.commit_generated_roster(
  p_month_start date,
  p_idempotency_key text,
  p_algorithm_version text,
  p_rule_snapshot jsonb,
  p_result_status text,
  p_assignments jsonb,
  p_conflicts jsonb,
  p_fairness_details jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_period_id uuid;
  assignment_item jsonb;
  owner_off public.employee_off_days%rowtype;
  temporary_off_id uuid;
  temporary_off_ids uuid[] := '{}'::uuid[];
  commit_result jsonb;
begin
  if not public.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'Hanya supervisor yang dapat menyimpan roster otomatis.';
  end if;

  if p_result_status = 'valid'
    and jsonb_typeof(p_assignments) = 'array' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'roster-generation:' || p_month_start::text,
        0
      )
    );

    insert into public.roster_periods (
      month_start,
      status,
      publish_deadline
    )
    values (
      p_month_start,
      'preparing',
      p_month_start - 7
    )
    on conflict (month_start) do nothing;

    select period.id
    into current_period_id
    from public.roster_periods period
    where period.month_start = p_month_start;

    for assignment_item in
      select value
      from jsonb_array_elements(p_assignments)
      where value->>'shift' = 'off'
    loop
      if not exists (
        select 1
        from public.employee_off_days off_day
        where off_day.roster_period_id = current_period_id
          and off_day.employee_id =
            (assignment_item->>'employeeId')::uuid
          and off_day.off_date = (assignment_item->>'date')::date
      ) then
        select off_day.*
        into owner_off
        from public.employee_off_days off_day
        join public.roster_periods period
          on period.id = off_day.roster_period_id
        where off_day.employee_id =
            (assignment_item->>'employeeId')::uuid
          and off_day.off_date = (assignment_item->>'date')::date
          and date_trunc(
            'month',
            off_day.source_week_start
          )::date < p_month_start
        order by
          (
            period.month_start
              = date_trunc(
                'month',
                off_day.source_week_start
              )::date
          ) desc,
          off_day.updated_at desc
        limit 1;

        if owner_off.id is not null then
          temporary_off_id := null;

          insert into public.employee_off_days (
            roster_period_id,
            employee_id,
            off_date,
            source_week_start,
            borrowed_from_adjacent_week,
            override_reason,
            set_by
          )
          values (
            current_period_id,
            owner_off.employee_id,
            owner_off.off_date,
            owner_off.source_week_start,
            owner_off.borrowed_from_adjacent_week,
            owner_off.override_reason,
            owner_off.set_by
          )
          on conflict do nothing
          returning id into temporary_off_id;

          if temporary_off_id is not null then
            temporary_off_ids :=
              array_append(temporary_off_ids, temporary_off_id);
          end if;
        end if;
      end if;
    end loop;
  end if;

  commit_result := public.commit_generated_roster_without_carry_over(
    p_month_start,
    p_idempotency_key,
    p_algorithm_version,
    p_rule_snapshot,
    p_result_status,
    p_assignments,
    p_conflicts,
    p_fairness_details
  );

  if cardinality(temporary_off_ids) > 0 then
    delete from public.employee_off_days off_day
    where off_day.id = any(temporary_off_ids);
  end if;

  return commit_result;
end;
$$;

create or replace function public.validate_carry_over_off_days_on_publish()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  publish_month_start date;
  next_month_start date;
  carry_off record;
begin
  if new.status <> 'published'
    or old.status = 'published' then
    return new;
  end if;

  select period.month_start
  into publish_month_start
  from public.roster_periods period
  where period.id = new.roster_period_id;

  next_month_start :=
    (publish_month_start + interval '1 month')::date;

  for carry_off in
    select distinct on (off_day.employee_id, off_day.off_date)
      off_day.employee_id,
      off_day.off_date
    from public.employee_off_days off_day
    where off_day.off_date >= publish_month_start
      and off_day.off_date < next_month_start
      and date_trunc(
        'month',
        off_day.source_week_start
      )::date < publish_month_start
    order by
      off_day.employee_id,
      off_day.off_date,
      off_day.updated_at desc
  loop
    if not exists (
      select 1
      from public.schedule_assignments assignment
      where assignment.roster_version_id = new.id
        and assignment.employee_id = carry_off.employee_id
        and assignment.work_date = carry_off.off_date
        and assignment.status = 'off'
    ) then
      raise exception using
        errcode = '23514',
        message = format(
          'Roster belum dapat dipublikasikan: off carry-over tanggal %s belum diterapkan.',
          carry_off.off_date
        );
    end if;

    if carry_off.off_date > publish_month_start
      and not exists (
        select 1
        from public.schedule_assignments assignment
        join public.outlet_shift_templates template
          on template.id = assignment.shift_template_id
        where assignment.roster_version_id = new.id
          and assignment.employee_id = carry_off.employee_id
          and assignment.work_date = carry_off.off_date - 1
          and assignment.status = 'scheduled'
          and template.shift_type = 'morning'
      ) then
      raise exception using
        errcode = '23514',
        message = format(
          'Roster belum dapat dipublikasikan: jadwal sebelum off carry-over %s wajib Pagi.',
          carry_off.off_date
        );
    end if;

    if carry_off.off_date + 1 < next_month_start
      and not exists (
        select 1
        from public.schedule_assignments assignment
        join public.outlet_shift_templates template
          on template.id = assignment.shift_template_id
        where assignment.roster_version_id = new.id
          and assignment.employee_id = carry_off.employee_id
          and assignment.work_date = carry_off.off_date + 1
          and assignment.status = 'scheduled'
          and template.shift_type = 'night'
      ) then
      raise exception using
        errcode = '23514',
        message = format(
          'Roster belum dapat dipublikasikan: jadwal setelah off carry-over %s wajib Malam.',
          carry_off.off_date
        );
    end if;
  end loop;

  return new;
end;
$$;

create trigger roster_versions_validate_carry_over_off_days
before update of status on public.roster_versions
for each row
execute function public.validate_carry_over_off_days_on_publish();

revoke all on function public.save_cross_month_roster_off_day(
  date,
  uuid,
  date,
  text,
  date,
  boolean
) from public, anon, authenticated;
revoke all on function public.get_roster_generation_input(date)
  from public, anon, authenticated;
revoke all on function public.commit_generated_roster(
  date,
  text,
  text,
  jsonb,
  text,
  jsonb,
  jsonb,
  jsonb
) from public, anon, authenticated;
revoke all on function public.validate_carry_over_off_days_on_publish()
  from public, anon, authenticated;

grant execute on function public.save_cross_month_roster_off_day(
  date,
  uuid,
  date,
  text,
  date,
  boolean
) to authenticated;
grant execute on function public.get_roster_generation_input(date)
  to authenticated;
grant execute on function public.commit_generated_roster(
  date,
  text,
  text,
  jsonb,
  text,
  jsonb,
  jsonb,
  jsonb
) to authenticated;
