-- Pekan roster dimiliki oleh bulan tempat hari Senin awal pekan berada.
-- Ini mencegah pekan parsial dihitung ulang pada dua bulan.

create or replace function public.publish_manual_roster(
  p_roster_version_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  version_row public.roster_versions%rowtype;
  period_row public.roster_periods%rowtype;
  expected_assignments integer;
  actual_assignments integer;
  expected_off_allocations integer;
  actual_off_allocations integer;
  invalid_pattern_count integer;
  invalid_middle_count integer;
  staffing_conflict_count integer;
  notification_row public.notifications%rowtype;
  employee_record record;
begin
  if not public.is_supervisor() then
    raise exception 'Hanya supervisor yang dapat mempublikasikan roster';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Alasan publikasi minimal 3 karakter';
  end if;

  select *
  into version_row
  from public.roster_versions version
  where version.id = p_roster_version_id
  for update;

  if version_row.id is null or version_row.status <> 'draft' then
    raise exception 'Versi draft roster tidak ditemukan atau sudah berubah';
  end if;

  select *
  into period_row
  from public.roster_periods period
  where period.id = version_row.roster_period_id
  for update;

  select count(*)
  into expected_assignments
  from public.employees employee
  join public.job_positions position on position.id = employee.job_position_id
  where employee.archived_at is null
    and (
      position.auto_roster_eligible
      or exists (
        select 1
        from public.user_accounts account
        where account.employee_id = employee.id
          and account.access_role = 'supervisor'
          and account.account_status = 'active'
      )
    )
    and exists (
      select 1
      from public.employee_placements placement
      where placement.employee_id = employee.id
        and placement.is_primary
        and placement.start_date
          < (period_row.month_start + interval '1 month')::date
        and (
          placement.end_date is null
          or placement.end_date >= period_row.month_start
        )
    );

  expected_assignments := expected_assignments
    * (
      (period_row.month_start + interval '1 month')::date
      - period_row.month_start
    );

  select count(*)
  into actual_assignments
  from public.schedule_assignments assignment
  where assignment.roster_version_id = version_row.id;

  if expected_assignments = 0 then
    raise exception 'Tidak ada kasir atau supervisor aktif yang dapat dijadwalkan';
  end if;

  if actual_assignments <> expected_assignments then
    raise exception
      'Roster belum lengkap: % dari % penugasan harian terisi',
      actual_assignments,
      expected_assignments;
  end if;

  -- Satu pekan dimiliki bulan tempat hari Seninnya berada. Pekan parsial
  -- yang dimulai pada bulan sebelumnya tidak boleh ditagih ulang.
  select count(distinct date_trunc('week', day_value)::date)
  into expected_off_allocations
  from generate_series(
    period_row.month_start,
    (period_row.month_start + interval '1 month - 1 day')::date,
    interval '1 day'
  ) day_value
  where date_trunc('week', day_value)::date >= period_row.month_start;

  expected_off_allocations := expected_off_allocations
    * (
      select count(*)
      from public.employees employee
      join public.job_positions position
        on position.id = employee.job_position_id
      where employee.archived_at is null
        and position.auto_roster_eligible
        and exists (
          select 1
          from public.employee_placements placement
          where placement.employee_id = employee.id
            and placement.is_primary
            and placement.start_date
              < (period_row.month_start + interval '1 month')::date
            and (
              placement.end_date is null
              or placement.end_date >= period_row.month_start
            )
        )
    );

  select count(*)
  into actual_off_allocations
  from public.employee_off_days off_day
  join public.employees employee on employee.id = off_day.employee_id
  join public.job_positions position on position.id = employee.job_position_id
  where off_day.roster_period_id = period_row.id
    and off_day.source_week_start >= period_row.month_start
    and off_day.source_week_start
      < (period_row.month_start + interval '1 month')::date
    and position.auto_roster_eligible;

  if actual_off_allocations <> expected_off_allocations then
    raise exception
      'Jatah off day kasir belum lengkap: % dari % alokasi pekan tersedia',
      actual_off_allocations,
      expected_off_allocations;
  end if;

  select count(*)
  into invalid_middle_count
  from (
    select
      assignment.employee_id,
      date_trunc('week', assignment.work_date),
      count(*) as middle_total
    from public.schedule_assignments assignment
    join public.outlet_shift_templates template
      on template.id = assignment.shift_template_id
    where assignment.roster_version_id = version_row.id
      and assignment.status = 'scheduled'
      and template.shift_type = 'middle'
    group by assignment.employee_id, date_trunc('week', assignment.work_date)
    having count(*) > 1
      and bool_or(not exists (
        select 1
        from public.schedule_overrides schedule_override
        where schedule_override.schedule_assignment_id = assignment.id
          and length(trim(schedule_override.reason)) >= 3
      ))
  ) invalid_middle;

  if invalid_middle_count > 0 then
    raise exception 'Batas shift Middle mingguan dilanggar tanpa override';
  end if;

  select count(*)
  into invalid_pattern_count
  from public.employee_off_days off_day
  where off_day.roster_period_id = period_row.id
    and (
      (
        off_day.off_date > period_row.month_start
        and not exists (
          select 1
          from public.schedule_assignments previous_assignment
          left join public.outlet_shift_templates previous_template
            on previous_template.id = previous_assignment.shift_template_id
          where previous_assignment.roster_version_id = version_row.id
            and previous_assignment.employee_id = off_day.employee_id
            and previous_assignment.work_date = off_day.off_date - 1
            and (
              previous_template.shift_type = 'morning'
              or exists (
                select 1
                from public.schedule_overrides schedule_override
                where schedule_override.schedule_assignment_id
                  = previous_assignment.id
                  and length(trim(schedule_override.reason)) >= 3
              )
            )
        )
      )
      or
      (
        off_day.off_date
          < (period_row.month_start + interval '1 month - 1 day')::date
        and not exists (
          select 1
          from public.schedule_assignments next_assignment
          left join public.outlet_shift_templates next_template
            on next_template.id = next_assignment.shift_template_id
          where next_assignment.roster_version_id = version_row.id
            and next_assignment.employee_id = off_day.employee_id
            and next_assignment.work_date = off_day.off_date + 1
            and (
              next_template.shift_type = 'night'
              or exists (
                select 1
                from public.schedule_overrides schedule_override
                where schedule_override.schedule_assignment_id
                  = next_assignment.id
                  and length(trim(schedule_override.reason)) >= 3
              )
            )
        )
      )
    );

  if invalid_pattern_count > 0 then
    raise exception 'Pola Pagi sebelum off atau Malam setelah off belum terpenuhi';
  end if;

  select count(*)
  into staffing_conflict_count
  from (
    select
      requirement.outlet_id,
      requirement.shift_template_id,
      work_day::date
    from public.outlet_staffing_requirements requirement
    cross join generate_series(
      period_row.month_start,
      (period_row.month_start + interval '1 month - 1 day')::date,
      interval '1 day'
    ) work_day
    where requirement.effective_from <= work_day::date
      and (
        requirement.effective_until is null
        or requirement.effective_until >= work_day::date
      )
      and requirement.cashier_count = (
        select count(*)::smallint
        from public.employee_placements placement
        join public.employees employee on employee.id = placement.employee_id
        join public.job_positions position
          on position.id = employee.job_position_id
        where placement.outlet_id = requirement.outlet_id
          and placement.is_primary
          and placement.start_date <= work_day::date
          and (
            placement.end_date is null
            or placement.end_date >= work_day::date
          )
          and employee.archived_at is null
          and position.auto_roster_eligible
      )
      and (
        select count(*)
        from public.schedule_assignments assignment
        join public.employees employee on employee.id = assignment.employee_id
        join public.job_positions position
          on position.id = employee.job_position_id
        where assignment.roster_version_id = version_row.id
          and assignment.outlet_id = requirement.outlet_id
          and assignment.shift_template_id = requirement.shift_template_id
          and assignment.work_date = work_day::date
          and assignment.status = 'scheduled'
          and position.auto_roster_eligible
      ) < requirement.minimum_staff
  ) staffing_conflicts;

  if staffing_conflict_count > 0 then
    raise exception
      'Roster memiliki % konflik kebutuhan minimum staf outlet',
      staffing_conflict_count;
  end if;

  update public.roster_versions
  set
    status = 'superseded',
    updated_at = now()
  where roster_period_id = period_row.id
    and status = 'published';

  update public.roster_versions
  set
    status = 'published',
    change_summary = trim(p_reason),
    published_at = now(),
    published_by = actor_id,
    updated_at = now()
  where id = version_row.id;

  update public.roster_periods
  set
    status = 'published',
    active_version_id = version_row.id,
    updated_at = now()
  where id = period_row.id;

  for employee_record in
    select distinct assignment.employee_id
    from public.schedule_assignments assignment
    where assignment.roster_version_id = version_row.id
  loop
    insert into public.notifications (
      employee_id,
      notification_type,
      title,
      body,
      subject_type,
      subject_id,
      payload
    )
    values (
      employee_record.employee_id,
      'roster_published',
      'Jadwal kerja diperbarui',
      'Roster bulan ini telah dipublikasikan. Silakan periksa dan tandai sudah dibaca.',
      'roster_version',
      version_row.id,
      jsonb_build_object(
        'month_start', period_row.month_start,
        'version_number', version_row.version_number
      )
    )
    returning * into notification_row;

    insert into public.notification_receipts (notification_id)
    values (notification_row.id);
  end loop;

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
    'publish_manual_roster',
    'roster_version',
    version_row.id,
    jsonb_build_object('status', 'draft'),
    jsonb_build_object(
      'status', 'published',
      'version_number', version_row.version_number,
      'assignment_count', actual_assignments
    ),
    trim(p_reason)
  );

  return jsonb_build_object(
    'roster_version_id', version_row.id,
    'version_number', version_row.version_number,
    'published_assignments', actual_assignments
  );
end;
$$;
