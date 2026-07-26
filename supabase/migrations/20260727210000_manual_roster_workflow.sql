-- M3: transactional manual roster, off-day ledger, publication, and read acknowledgement.

create unique index employee_off_days_one_source_week
  on public.employee_off_days (
    roster_period_id,
    employee_id,
    source_week_start
  );

create unique index shift_swap_requests_one_open_requester_schedule
  on public.shift_swap_requests (requester_schedule_id)
  where status in ('pending_colleague', 'pending_supervisor');

revoke insert, update, delete on public.roster_periods from authenticated;
revoke insert, update, delete on public.roster_versions from authenticated;
revoke insert, update, delete on public.employee_off_days from authenticated;
revoke insert, update, delete on public.schedule_assignments from authenticated;
revoke insert, update, delete on public.schedule_overrides from authenticated;
revoke insert, update, delete on public.schedule_acknowledgements from authenticated;
revoke insert, update, delete on public.backup_assignments from authenticated;
revoke insert, update, delete on public.shift_swap_requests from authenticated;

-- Raw roster identifiers and audit records are not part of the employee-facing
-- schedule contract. All roles read through role-aware RPCs or the public view.
revoke select on public.roster_periods from authenticated;
revoke select on public.roster_versions from authenticated;
revoke select on public.employee_off_days from authenticated;
revoke select on public.schedule_assignments from authenticated;
revoke select on public.schedule_overrides from authenticated;
revoke select on public.schedule_acknowledgements from authenticated;
revoke select on public.backup_assignments from authenticated;
revoke select on public.shift_swap_requests from authenticated;

create or replace function public.prevent_published_schedule_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_version_id uuid;
  target_status public.roster_version_status;
begin
  target_version_id :=
    case
      when tg_op = 'DELETE' then old.roster_version_id
      else new.roster_version_id
    end;

  select version.status
  into target_status
  from public.roster_versions version
  where version.id = target_version_id;

  if target_status <> 'draft' then
    raise exception 'Jadwal pada versi yang sudah dipublikasikan tidak dapat diubah';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger schedule_assignments_draft_only
before insert or update or delete on public.schedule_assignments
for each row execute function public.prevent_published_schedule_mutation();

create or replace function public.ensure_manual_roster_draft(
  p_month_start date,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  period_row public.roster_periods%rowtype;
  draft_id uuid;
  next_version integer;
begin
  if not public.is_supervisor() then
    raise exception 'Hanya supervisor yang dapat mengubah roster';
  end if;

  if p_month_start is null
    or p_month_start <> date_trunc('month', p_month_start)::date then
    raise exception 'Periode roster harus menggunakan tanggal pertama bulan';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Alasan perubahan roster minimal 3 karakter';
  end if;

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

  select *
  into period_row
  from public.roster_periods period
  where period.month_start = p_month_start
  for update;

  if period_row.status = 'closed' then
    raise exception 'Periode roster sudah ditutup';
  end if;

  select version.id
  into draft_id
  from public.roster_versions version
  where version.roster_period_id = period_row.id
    and version.status = 'draft'
  order by version.version_number desc
  limit 1
  for update;

  if draft_id is not null then
    return draft_id;
  end if;

  select coalesce(max(version.version_number), 0) + 1
  into next_version
  from public.roster_versions version
  where version.roster_period_id = period_row.id;

  insert into public.roster_versions (
    roster_period_id,
    version_number,
    status,
    change_summary,
    created_by
  )
  values (
    period_row.id,
    next_version,
    'draft',
    trim(p_reason),
    actor_id
  )
  returning id into draft_id;

  if period_row.active_version_id is not null then
    insert into public.schedule_assignments (
      roster_version_id,
      employee_id,
      outlet_id,
      shift_template_id,
      work_date,
      assignment_type,
      planned_start,
      planned_end,
      planned_duration_min,
      status
    )
    select
      draft_id,
      assignment.employee_id,
      assignment.outlet_id,
      assignment.shift_template_id,
      assignment.work_date,
      assignment.assignment_type,
      assignment.planned_start,
      assignment.planned_end,
      assignment.planned_duration_min,
      assignment.status
    from public.schedule_assignments assignment
    where assignment.roster_version_id = period_row.active_version_id;

    insert into public.backup_assignments (
      schedule_assignment_id,
      employee_id,
      origin_outlet_id,
      destination_outlet_id,
      work_date,
      reason,
      assigned_by
    )
    select
      cloned.id,
      backup.employee_id,
      backup.origin_outlet_id,
      backup.destination_outlet_id,
      backup.work_date,
      backup.reason,
      actor_id
    from public.backup_assignments backup
    join public.schedule_assignments original
      on original.id = backup.schedule_assignment_id
    join public.schedule_assignments cloned
      on cloned.roster_version_id = draft_id
     and cloned.employee_id = original.employee_id
     and cloned.work_date = original.work_date
    where original.roster_version_id = period_row.active_version_id;
  end if;

  update public.roster_periods
  set
    status = 'draft',
    updated_at = now()
  where id = period_row.id;

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    after_values,
    reason
  )
  values (
    actor_id,
    'create_manual_roster_draft',
    'roster_version',
    draft_id,
    jsonb_build_object(
      'roster_period_id', period_row.id,
      'version_number', next_version,
      'cloned_from', period_row.active_version_id
    ),
    trim(p_reason)
  );

  return draft_id;
end;
$$;

create or replace function public.save_manual_roster_assignment(
  p_month_start date,
  p_employee_id uuid,
  p_work_date date,
  p_outlet_id uuid,
  p_shift_type public.shift_type,
  p_status public.schedule_status,
  p_assignment_type text,
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
  actor_id uuid := (select auth.uid());
  draft_id uuid;
  period_id uuid;
  origin_outlet_id uuid;
  selected_outlet_id uuid;
  template_row public.outlet_shift_templates%rowtype;
  existing_assignment public.schedule_assignments%rowtype;
  saved_assignment public.schedule_assignments%rowtype;
  existing_off public.employee_off_days%rowtype;
  target_week_start date;
  selected_source_week_start date;
  duration_minutes integer := 0;
  before_values jsonb;
  warnings jsonb := '[]'::jsonb;
  middle_count integer;
  max_consecutive_days integer;
begin
  if not public.is_supervisor() then
    raise exception 'Hanya supervisor yang dapat mengubah roster';
  end if;

  if p_employee_id is null or p_work_date is null then
    raise exception 'Karyawan dan tanggal jadwal wajib diisi';
  end if;

  if p_work_date < p_month_start
    or p_work_date >= (p_month_start + interval '1 month')::date then
    raise exception 'Tanggal jadwal harus berada dalam periode roster';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Alasan perubahan roster minimal 3 karakter';
  end if;

  if p_assignment_type not in ('primary', 'backup') then
    raise exception 'Jenis penugasan tidak valid';
  end if;

  if p_status = 'cancelled' then
    raise exception 'Gunakan status scheduled atau off untuk jadwal manual';
  end if;

  perform 1
  from public.employees employee
  where employee.id = p_employee_id
    and employee.archived_at is null;

  if not found then
    raise exception 'Karyawan aktif tidak ditemukan';
  end if;

  select placement.outlet_id
  into origin_outlet_id
  from public.employee_placements placement
  join public.outlets outlet on outlet.id = placement.outlet_id
  where placement.employee_id = p_employee_id
    and placement.is_primary
    and placement.start_date <= p_work_date
    and (placement.end_date is null or placement.end_date >= p_work_date)
    and outlet.is_active
  order by placement.start_date desc
  limit 1;

  if origin_outlet_id is null then
    raise exception 'Karyawan tidak memiliki penempatan utama aktif pada tanggal tersebut';
  end if;

  draft_id := public.ensure_manual_roster_draft(p_month_start, p_reason);

  select version.roster_period_id
  into period_id
  from public.roster_versions version
  where version.id = draft_id;

  select *
  into existing_assignment
  from public.schedule_assignments assignment
  where assignment.roster_version_id = draft_id
    and assignment.employee_id = p_employee_id
    and assignment.work_date = p_work_date
  for update;

  if found then
    before_values := to_jsonb(existing_assignment);
  end if;

  if p_status = 'off' then
    selected_outlet_id := origin_outlet_id;
    p_assignment_type := 'primary';
    p_shift_type := null;

    target_week_start :=
      p_work_date - (extract(isodow from p_work_date)::integer - 1);
    selected_source_week_start :=
      coalesce(p_source_week_start, target_week_start);

    if p_borrowed_from_adjacent_week then
      if abs(selected_source_week_start - target_week_start) <> 7 then
        raise exception 'Off day hanya dapat dipinjam dari pekan bersebelahan';
      end if;

      if selected_source_week_start < p_month_start - 6
        or selected_source_week_start
          >= (p_month_start + interval '1 month')::date then
        raise exception 'Sumber off day harus berada pada periode bulan yang sama';
      end if;
    elsif selected_source_week_start <> target_week_start then
      raise exception 'Sumber pekan berbeda wajib ditandai sebagai peminjaman off day';
    end if;

    select *
    into existing_off
    from public.employee_off_days off_day
    where off_day.roster_period_id = period_id
      and off_day.employee_id = p_employee_id
      and off_day.source_week_start = selected_source_week_start
    for update;

    if found and existing_off.off_date <> p_work_date then
      delete from public.schedule_assignments assignment
      where assignment.roster_version_id = draft_id
        and assignment.employee_id = p_employee_id
        and assignment.work_date = existing_off.off_date
        and assignment.status = 'off';
    end if;

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
      p_work_date,
      selected_source_week_start,
      p_borrowed_from_adjacent_week,
      case
        when p_borrowed_from_adjacent_week then trim(p_reason)
        else null
      end,
      actor_id
    )
    on conflict (roster_period_id, employee_id, source_week_start)
    do update set
      off_date = excluded.off_date,
      borrowed_from_adjacent_week = excluded.borrowed_from_adjacent_week,
      override_reason = excluded.override_reason,
      set_by = excluded.set_by,
      updated_at = now();
  else
    if p_outlet_id is null or p_shift_type is null then
      raise exception 'Outlet dan jenis shift wajib untuk jadwal kerja';
    end if;

    select outlet.id
    into selected_outlet_id
    from public.outlets outlet
    where outlet.id = p_outlet_id
      and outlet.is_active;

    if selected_outlet_id is null then
      raise exception 'Outlet aktif tidak ditemukan';
    end if;

    if p_assignment_type = 'primary'
      and selected_outlet_id <> origin_outlet_id then
      raise exception 'Outlet berbeda wajib dicatat sebagai penugasan backup';
    end if;

    if p_assignment_type = 'backup'
      and selected_outlet_id = origin_outlet_id then
      raise exception 'Outlet backup harus berbeda dari outlet utama';
    end if;

    select *
    into template_row
    from public.outlet_shift_templates template
    where template.outlet_id = selected_outlet_id
      and template.shift_type = p_shift_type
      and template.is_active
    order by template.created_at desc
    limit 1;

    if template_row.id is null then
      raise exception 'Template shift aktif tidak ditemukan untuk outlet';
    end if;

    duration_minutes :=
      case
        when template_row.ends_at > template_row.starts_at
          then extract(epoch from (template_row.ends_at - template_row.starts_at))::integer / 60
        else
          (
            extract(
              epoch from (
                (template_row.ends_at + interval '24 hours')
                - template_row.starts_at
              )
            )::integer / 60
          )
      end;

    delete from public.employee_off_days off_day
    where off_day.roster_period_id = period_id
      and off_day.employee_id = p_employee_id
      and off_day.off_date = p_work_date;
  end if;

  insert into public.schedule_assignments (
    roster_version_id,
    employee_id,
    outlet_id,
    shift_template_id,
    work_date,
    assignment_type,
    planned_start,
    planned_end,
    planned_duration_min,
    status
  )
  values (
    draft_id,
    p_employee_id,
    selected_outlet_id,
    template_row.id,
    p_work_date,
    p_assignment_type,
    case when p_status = 'scheduled' then template_row.starts_at else null end,
    case when p_status = 'scheduled' then template_row.ends_at else null end,
    case when p_status = 'scheduled' then duration_minutes else 0 end,
    p_status
  )
  on conflict (roster_version_id, employee_id, work_date)
  do update set
    outlet_id = excluded.outlet_id,
    shift_template_id = excluded.shift_template_id,
    assignment_type = excluded.assignment_type,
    planned_start = excluded.planned_start,
    planned_end = excluded.planned_end,
    planned_duration_min = excluded.planned_duration_min,
    status = excluded.status,
    updated_at = now()
  returning * into saved_assignment;

  delete from public.backup_assignments backup
  where backup.schedule_assignment_id = saved_assignment.id;

  if p_status = 'scheduled' and p_assignment_type = 'backup' then
    insert into public.backup_assignments (
      schedule_assignment_id,
      employee_id,
      origin_outlet_id,
      destination_outlet_id,
      work_date,
      reason,
      assigned_by
    )
    values (
      saved_assignment.id,
      p_employee_id,
      origin_outlet_id,
      selected_outlet_id,
      p_work_date,
      trim(p_reason),
      actor_id
    );
  end if;

  insert into public.schedule_overrides (
    schedule_assignment_id,
    before_values,
    after_values,
    reason,
    changed_by
  )
  values (
    saved_assignment.id,
    coalesce(before_values, '{}'::jsonb),
    to_jsonb(saved_assignment),
    trim(p_reason),
    actor_id
  );

  if p_status = 'scheduled' and p_shift_type = 'middle' then
    select count(*)
    into middle_count
    from public.schedule_assignments assignment
    join public.outlet_shift_templates template
      on template.id = assignment.shift_template_id
    where assignment.roster_version_id = draft_id
      and assignment.employee_id = p_employee_id
      and assignment.status = 'scheduled'
      and template.shift_type = 'middle'
      and date_trunc('week', assignment.work_date)
        = date_trunc('week', p_work_date);

    if middle_count > 1 then
      warnings := warnings || jsonb_build_array(jsonb_build_object(
        'code', 'middle_weekly_override',
        'message', 'Karyawan memiliki lebih dari satu shift Middle pada pekan ini; alasan disimpan sebagai override.'
      ));
    end if;
  end if;

  select coalesce(max(streak_length), 0)
  into max_consecutive_days
  from (
    select count(*)::integer as streak_length
    from (
      select
        assignment.work_date,
        assignment.work_date
          - (
            row_number() over (order by assignment.work_date)
          )::integer as streak_group
      from public.schedule_assignments assignment
      where assignment.roster_version_id = draft_id
        and assignment.employee_id = p_employee_id
        and assignment.status = 'scheduled'
    ) scheduled_days
    group by streak_group
  ) streaks;

  if max_consecutive_days > 6 then
    warnings := warnings || jsonb_build_array(jsonb_build_object(
      'code', 'consecutive_work_days',
      'message', format(
        'Karyawan memiliki %s hari kerja berturut-turut; tinjau kembali off day.',
        max_consecutive_days
      )
    ));
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
    'save_manual_roster_assignment',
    'schedule_assignment',
    saved_assignment.id,
    before_values,
    to_jsonb(saved_assignment),
    trim(p_reason)
  );

  return jsonb_build_object(
    'roster_version_id', draft_id,
    'assignment_id', saved_assignment.id,
    'warnings', warnings
  );
end;
$$;

create or replace function public.get_monthly_roster(
  p_month_start date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_role public.access_role := public.current_access_role();
  viewer_employee_id uuid := public.current_employee_id();
  period_row public.roster_periods%rowtype;
  selected_version public.roster_versions%rowtype;
  result jsonb;
begin
  if viewer_role is null then
    raise exception 'Sesi pengguna tidak aktif';
  end if;

  if p_month_start is null
    or p_month_start <> date_trunc('month', p_month_start)::date then
    raise exception 'Periode roster harus menggunakan tanggal pertama bulan';
  end if;

  select *
  into period_row
  from public.roster_periods period
  where period.month_start = p_month_start;

  if period_row.id is null then
    return jsonb_build_object(
      'period', null,
      'version', null,
      'employees', '[]'::jsonb,
      'assignments', '[]'::jsonb,
      'off_days', '[]'::jsonb,
      'swap_requests', '[]'::jsonb
    );
  end if;

  if viewer_role in ('supervisor', 'management') then
    select *
    into selected_version
    from public.roster_versions version
    where version.roster_period_id = period_row.id
      and (
        version.status = 'draft'
        or version.id = period_row.active_version_id
      )
    order by
      case when version.status = 'draft' then 0 else 1 end,
      version.version_number desc
    limit 1;
  else
    select *
    into selected_version
    from public.roster_versions version
    where version.id = period_row.active_version_id
      and version.status = 'published';
  end if;

  select jsonb_build_object(
    'period',
      jsonb_build_object(
        'id', period_row.id,
        'month_start', period_row.month_start,
        'status', period_row.status,
        'publish_deadline', period_row.publish_deadline,
        'active_version_id', period_row.active_version_id
      ),
    'version',
      case
        when selected_version.id is null then null
        else jsonb_build_object(
          'id', selected_version.id,
          'version_number', selected_version.version_number,
          'status', selected_version.status,
          'change_summary', selected_version.change_summary,
          'published_at', selected_version.published_at
        )
      end,
    'employees',
      case
        when viewer_role in ('supervisor', 'management') then coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', employee.id,
            'name', employee.full_name,
            'position', position.name,
            'primary_outlet_id', placement.outlet_id,
            'primary_outlet_name', outlet.name
          ) order by employee.full_name)
          from public.employees employee
          join public.job_positions position
            on position.id = employee.job_position_id
          join lateral (
            select employee_placement.outlet_id
            from public.employee_placements employee_placement
            where employee_placement.employee_id = employee.id
              and employee_placement.is_primary
              and employee_placement.start_date
                < (p_month_start + interval '1 month')::date
              and (
                employee_placement.end_date is null
                or employee_placement.end_date >= p_month_start
              )
            order by employee_placement.start_date desc
            limit 1
          ) placement on true
          join public.outlets outlet on outlet.id = placement.outlet_id
          where employee.archived_at is null
        ), '[]'::jsonb)
        else '[]'::jsonb
      end,
    'assignments',
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',
            case
              when viewer_role in ('supervisor', 'management')
                or assignment.employee_id = viewer_employee_id
                then assignment.id
              else null
            end,
          'employee_id',
            case
              when viewer_role in ('supervisor', 'management')
                then assignment.employee_id
              else null
            end,
          'employee_name', employee.full_name,
          'outlet_id',
            case
              when viewer_role in ('supervisor', 'management')
                then assignment.outlet_id
              else null
            end,
          'outlet_name', outlet.name,
          'work_date', assignment.work_date,
          'shift_type', coalesce(template.shift_type::text, 'off'),
          'planned_start', assignment.planned_start,
          'planned_end', assignment.planned_end,
          'status', assignment.status,
          'assignment_type', assignment.assignment_type,
          'is_own', assignment.employee_id = viewer_employee_id,
          'acknowledged',
            exists (
              select 1
              from public.schedule_acknowledgements acknowledgement
              where acknowledgement.schedule_assignment_id = assignment.id
                and acknowledgement.employee_id = assignment.employee_id
                and acknowledgement.acknowledged_version
                  = selected_version.version_number
            )
        ) order by assignment.work_date, employee.full_name)
        from public.schedule_assignments assignment
        join public.employees employee on employee.id = assignment.employee_id
        join public.outlets outlet on outlet.id = assignment.outlet_id
        left join public.outlet_shift_templates template
          on template.id = assignment.shift_template_id
        where assignment.roster_version_id = selected_version.id
      ), '[]'::jsonb),
    'off_days',
      case
        when viewer_role in ('supervisor', 'management') then coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', off_day.id,
            'employee_id', off_day.employee_id,
            'off_date', off_day.off_date,
            'source_week_start', off_day.source_week_start,
            'borrowed_from_adjacent_week', off_day.borrowed_from_adjacent_week,
            'override_reason', off_day.override_reason
          ) order by off_day.off_date)
          from public.employee_off_days off_day
          where off_day.roster_period_id = period_row.id
        ), '[]'::jsonb)
        else '[]'::jsonb
      end,
    'swap_requests',
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', swap.id,
          'requester_id', swap.requester_id,
          'requester_name', requester.full_name,
          'requester_schedule_id', swap.requester_schedule_id,
          'colleague_id', swap.colleague_id,
          'colleague_name', colleague.full_name,
          'colleague_schedule_id', swap.colleague_schedule_id,
          'reason', swap.reason,
          'status', swap.status,
          'decision_note', swap.decision_note,
          'is_requester', swap.requester_id = viewer_employee_id,
          'is_colleague', swap.colleague_id = viewer_employee_id
        ) order by swap.created_at desc)
        from public.shift_swap_requests swap
        join public.schedule_assignments requester_assignment
          on requester_assignment.id = swap.requester_schedule_id
        join public.roster_versions swap_version
          on swap_version.id = requester_assignment.roster_version_id
        join public.employees requester on requester.id = swap.requester_id
        join public.employees colleague on colleague.id = swap.colleague_id
        where swap_version.roster_period_id = period_row.id
          and (
            viewer_role in ('supervisor', 'management')
            or swap.requester_id = viewer_employee_id
            or swap.colleague_id = viewer_employee_id
          )
      ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

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

  select count(distinct date_trunc('week', day_value)::date)
  into expected_off_allocations
  from generate_series(
    period_row.month_start,
    (period_row.month_start + interval '1 month - 1 day')::date,
    interval '1 day'
  ) day_value;

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

create or replace function public.acknowledge_monthly_roster(
  p_month_start date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_employee uuid := public.current_employee_id();
  period_row public.roster_periods%rowtype;
  version_number integer;
  acknowledged_count integer;
begin
  if current_employee is null then
    raise exception 'Akun aktif tidak terhubung ke data karyawan';
  end if;

  select *
  into period_row
  from public.roster_periods period
  where period.month_start = p_month_start
    and period.status = 'published';

  if period_row.active_version_id is null then
    raise exception 'Roster aktif belum dipublikasikan';
  end if;

  select version.version_number
  into version_number
  from public.roster_versions version
  where version.id = period_row.active_version_id
    and version.status = 'published';

  insert into public.schedule_acknowledgements (
    schedule_assignment_id,
    employee_id,
    acknowledged_version
  )
  select
    assignment.id,
    current_employee,
    version_number
  from public.schedule_assignments assignment
  where assignment.roster_version_id = period_row.active_version_id
    and assignment.employee_id = current_employee
  on conflict (schedule_assignment_id, employee_id, acknowledged_version)
  do nothing;

  get diagnostics acknowledged_count = row_count;

  update public.notification_receipts receipt
  set
    in_app_read_at = coalesce(receipt.in_app_read_at, now()),
    acknowledged_at = coalesce(receipt.acknowledged_at, now()),
    updated_at = now()
  from public.notifications notification
  where receipt.notification_id = notification.id
    and notification.employee_id = current_employee
    and notification.subject_type = 'roster_version'
    and notification.subject_id = period_row.active_version_id;

  return jsonb_build_object(
    'roster_version_id', period_row.active_version_id,
    'acknowledged_assignments', acknowledged_count
  );
end;
$$;

create or replace function public.get_shift_swap_options(
  p_requester_schedule_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_employee uuid := public.current_employee_id();
  requester_assignment public.schedule_assignments%rowtype;
begin
  if current_employee is null then
    raise exception 'Akun aktif tidak terhubung ke data karyawan';
  end if;

  select assignment.*
  into requester_assignment
  from public.schedule_assignments assignment
  join public.roster_versions version
    on version.id = assignment.roster_version_id
  join public.roster_periods period
    on period.active_version_id = version.id
  where assignment.id = p_requester_schedule_id
    and assignment.employee_id = current_employee
    and assignment.status = 'scheduled'
    and version.status = 'published';

  if requester_assignment.id is null then
    raise exception 'Jadwal aktif milik pengguna tidak ditemukan';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'schedule_id', option_assignment.id,
      'employee_name', employee.full_name,
      'work_date', option_assignment.work_date,
      'shift_type', template.shift_type,
      'planned_start', option_assignment.planned_start,
      'planned_end', option_assignment.planned_end
    ) order by option_assignment.work_date, employee.full_name)
    from public.schedule_assignments option_assignment
    join public.employees employee
      on employee.id = option_assignment.employee_id
    join public.outlet_shift_templates template
      on template.id = option_assignment.shift_template_id
    where option_assignment.roster_version_id
        = requester_assignment.roster_version_id
      and option_assignment.outlet_id = requester_assignment.outlet_id
      and option_assignment.employee_id <> requester_assignment.employee_id
      and option_assignment.status = 'scheduled'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.request_shift_swap(
  p_requester_schedule_id uuid,
  p_colleague_schedule_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_employee uuid := public.current_employee_id();
  requester_assignment public.schedule_assignments%rowtype;
  colleague_assignment public.schedule_assignments%rowtype;
  request_row public.shift_swap_requests%rowtype;
  notification_id uuid;
begin
  if current_employee is null then
    raise exception 'Akun aktif tidak terhubung ke data karyawan';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Alasan pertukaran shift minimal 3 karakter';
  end if;

  select assignment.*
  into requester_assignment
  from public.schedule_assignments assignment
  join public.roster_versions version
    on version.id = assignment.roster_version_id
  join public.roster_periods period
    on period.active_version_id = version.id
  where assignment.id = p_requester_schedule_id
    and assignment.employee_id = current_employee
    and assignment.status = 'scheduled'
    and version.status = 'published'
  for update of assignment;

  if requester_assignment.id is null then
    raise exception 'Jadwal aktif milik pengguna tidak ditemukan';
  end if;

  select assignment.*
  into colleague_assignment
  from public.schedule_assignments assignment
  where assignment.id = p_colleague_schedule_id
    and assignment.roster_version_id = requester_assignment.roster_version_id
    and assignment.employee_id <> requester_assignment.employee_id
    and assignment.status = 'scheduled'
  for update;

  if colleague_assignment.id is null then
    raise exception 'Jadwal rekan tidak ditemukan pada versi roster yang sama';
  end if;

  if colleague_assignment.outlet_id <> requester_assignment.outlet_id then
    raise exception 'Pertukaran shift hanya dapat dilakukan dalam outlet yang sama';
  end if;

  if (
    select count(*) <> 2
    from public.employees employee
    join public.job_positions position
      on position.id = employee.job_position_id
    where employee.id in (
      requester_assignment.employee_id,
      colleague_assignment.employee_id
    )
      and employee.archived_at is null
      and position.auto_roster_eligible
  ) then
    raise exception 'Pertukaran shift hanya tersedia antarkasir aktif';
  end if;

  insert into public.shift_swap_requests (
    requester_id,
    requester_schedule_id,
    colleague_id,
    colleague_schedule_id,
    reason
  )
  values (
    requester_assignment.employee_id,
    requester_assignment.id,
    colleague_assignment.employee_id,
    colleague_assignment.id,
    trim(p_reason)
  )
  returning * into request_row;

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
    colleague_assignment.employee_id,
    'shift_swap_colleague_review',
    'Permintaan tukar shift',
    'Rekan kerja meminta persetujuan pertukaran shift.',
    'shift_swap_request',
    request_row.id,
    jsonb_build_object(
      'requester_schedule_id', requester_assignment.id,
      'colleague_schedule_id', colleague_assignment.id
    )
  )
  returning id into notification_id;

  insert into public.notification_receipts (notification_id)
  values (notification_id);

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    after_values,
    reason
  )
  values (
    actor_id,
    'request_shift_swap',
    'shift_swap_request',
    request_row.id,
    to_jsonb(request_row),
    trim(p_reason)
  );

  return jsonb_build_object(
    'request_id', request_row.id,
    'status', request_row.status
  );
end;
$$;

create or replace function public.decide_shift_swap_colleague(
  p_request_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_employee uuid := public.current_employee_id();
  request_row public.shift_swap_requests%rowtype;
  next_status text;
  notification_id uuid;
begin
  if current_employee is null then
    raise exception 'Akun aktif tidak terhubung ke data karyawan';
  end if;

  if p_decision not in ('accept', 'reject') then
    raise exception 'Keputusan rekan harus accept atau reject';
  end if;

  select *
  into request_row
  from public.shift_swap_requests request
  where request.id = p_request_id
  for update;

  if request_row.id is null
    or request_row.colleague_id <> current_employee then
    raise exception 'Permintaan pertukaran untuk rekan tidak ditemukan';
  end if;

  if request_row.status <> 'pending_colleague' then
    raise exception 'Permintaan pertukaran sudah diputuskan atau berubah';
  end if;

  next_status := case
    when p_decision = 'accept' then 'pending_supervisor'
    else 'rejected'
  end;

  update public.shift_swap_requests
  set
    status = next_status,
    colleague_decided_at = now(),
    decision_note = nullif(trim(coalesce(p_note, '')), ''),
    updated_at = now()
  where id = request_row.id;

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
    request_row.requester_id,
    'shift_swap_colleague_decision',
    'Status permintaan tukar shift',
    case
      when p_decision = 'accept'
        then 'Rekan menyetujui. Permintaan menunggu keputusan supervisor.'
      else 'Rekan menolak permintaan pertukaran shift.'
    end,
    'shift_swap_request',
    request_row.id,
    jsonb_build_object('status', next_status)
  )
  returning id into notification_id;

  insert into public.notification_receipts (notification_id)
  values (notification_id);

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
    'decide_shift_swap_colleague',
    'shift_swap_request',
    request_row.id,
    jsonb_build_object('status', request_row.status),
    jsonb_build_object('status', next_status),
    nullif(trim(coalesce(p_note, '')), '')
  );

  return jsonb_build_object(
    'request_id', request_row.id,
    'status', next_status
  );
end;
$$;

create or replace function public.decide_shift_swap_supervisor(
  p_request_id uuid,
  p_decision text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  request_row public.shift_swap_requests%rowtype;
  requester_assignment public.schedule_assignments%rowtype;
  colleague_assignment public.schedule_assignments%rowtype;
  requester_clone public.schedule_assignments%rowtype;
  colleague_clone public.schedule_assignments%rowtype;
  period_row public.roster_periods%rowtype;
  source_version public.roster_versions%rowtype;
  draft_id uuid;
  draft_version_number integer;
  middle_conflicts integer;
  notification_id uuid;
  affected_employee uuid;
begin
  if not public.is_supervisor() then
    raise exception 'Hanya supervisor yang dapat memutuskan pertukaran shift';
  end if;

  if p_decision not in ('approve', 'reject') then
    raise exception 'Keputusan supervisor harus approve atau reject';
  end if;

  if length(trim(coalesce(p_note, ''))) < 3 then
    raise exception 'Catatan keputusan minimal 3 karakter';
  end if;

  select *
  into request_row
  from public.shift_swap_requests request
  where request.id = p_request_id
  for update;

  if request_row.id is null or request_row.status <> 'pending_supervisor' then
    raise exception 'Permintaan pertukaran tidak menunggu keputusan supervisor';
  end if;

  if p_decision = 'reject' then
    update public.shift_swap_requests
    set
      status = 'rejected',
      supervisor_decided_by = actor_id,
      supervisor_decided_at = now(),
      decision_note = trim(p_note),
      updated_at = now()
    where id = request_row.id;

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
      'decide_shift_swap_supervisor',
      'shift_swap_request',
      request_row.id,
      jsonb_build_object('status', request_row.status),
      jsonb_build_object('status', 'rejected'),
      trim(p_note)
    );

    return jsonb_build_object(
      'request_id', request_row.id,
      'status', 'rejected',
      'roster_version_id', null
    );
  end if;

  select *
  into requester_assignment
  from public.schedule_assignments assignment
  where assignment.id = request_row.requester_schedule_id;

  select *
  into colleague_assignment
  from public.schedule_assignments assignment
  where assignment.id = request_row.colleague_schedule_id;

  if requester_assignment.id is null
    or colleague_assignment.id is null
    or requester_assignment.roster_version_id
      <> colleague_assignment.roster_version_id
    or requester_assignment.outlet_id <> colleague_assignment.outlet_id
    or requester_assignment.status <> 'scheduled'
    or colleague_assignment.status <> 'scheduled' then
    raise exception 'Jadwal sumber pertukaran tidak lagi valid';
  end if;

  select *
  into source_version
  from public.roster_versions version
  where version.id = requester_assignment.roster_version_id
    and version.status = 'published';

  select *
  into period_row
  from public.roster_periods period
  where period.id = source_version.roster_period_id
    and period.active_version_id = source_version.id
  for update;

  if period_row.id is null then
    raise exception 'Versi roster sumber bukan versi aktif';
  end if;

  if exists (
    select 1
    from public.roster_versions version
    where version.roster_period_id = period_row.id
      and version.status = 'draft'
  ) then
    raise exception 'Selesaikan draft roster yang sedang berjalan sebelum menyetujui pertukaran';
  end if;

  draft_id := public.ensure_manual_roster_draft(
    period_row.month_start,
    trim(p_note)
  );

  select version.version_number
  into draft_version_number
  from public.roster_versions version
  where version.id = draft_id;

  select *
  into requester_clone
  from public.schedule_assignments assignment
  where assignment.roster_version_id = draft_id
    and assignment.employee_id = requester_assignment.employee_id
    and assignment.work_date = requester_assignment.work_date
  for update;

  select *
  into colleague_clone
  from public.schedule_assignments assignment
  where assignment.roster_version_id = draft_id
    and assignment.employee_id = colleague_assignment.employee_id
    and assignment.work_date = colleague_assignment.work_date
  for update;

  update public.schedule_assignments
  set
    outlet_id = colleague_assignment.outlet_id,
    shift_template_id = colleague_assignment.shift_template_id,
    assignment_type = colleague_assignment.assignment_type,
    planned_start = colleague_assignment.planned_start,
    planned_end = colleague_assignment.planned_end,
    planned_duration_min = colleague_assignment.planned_duration_min,
    updated_at = now()
  where id = requester_clone.id
  returning * into requester_clone;

  update public.schedule_assignments
  set
    outlet_id = requester_assignment.outlet_id,
    shift_template_id = requester_assignment.shift_template_id,
    assignment_type = requester_assignment.assignment_type,
    planned_start = requester_assignment.planned_start,
    planned_end = requester_assignment.planned_end,
    planned_duration_min = requester_assignment.planned_duration_min,
    updated_at = now()
  where id = colleague_clone.id
  returning * into colleague_clone;

  insert into public.schedule_overrides (
    schedule_assignment_id,
    before_values,
    after_values,
    reason,
    changed_by
  )
  values
    (
      requester_clone.id,
      to_jsonb(requester_assignment),
      to_jsonb(requester_clone),
      trim(p_note),
      actor_id
    ),
    (
      colleague_clone.id,
      to_jsonb(colleague_assignment),
      to_jsonb(colleague_clone),
      trim(p_note),
      actor_id
    );

  select count(*)
  into middle_conflicts
  from (
    select
      assignment.employee_id,
      date_trunc('week', assignment.work_date),
      count(*) as middle_total
    from public.schedule_assignments assignment
    join public.outlet_shift_templates template
      on template.id = assignment.shift_template_id
    where assignment.roster_version_id = draft_id
      and assignment.employee_id in (
        request_row.requester_id,
        request_row.colleague_id
      )
      and assignment.status = 'scheduled'
      and template.shift_type = 'middle'
    group by assignment.employee_id, date_trunc('week', assignment.work_date)
    having count(*) > 1
  ) conflicts;

  if middle_conflicts > 0 then
    raise exception 'Pertukaran melanggar batas satu shift Middle per pekan';
  end if;

  update public.roster_versions
  set
    status = 'superseded',
    updated_at = now()
  where id = source_version.id;

  update public.roster_versions
  set
    status = 'published',
    change_summary = trim(p_note),
    published_at = now(),
    published_by = actor_id,
    updated_at = now()
  where id = draft_id;

  update public.roster_periods
  set
    status = 'published',
    active_version_id = draft_id,
    updated_at = now()
  where id = period_row.id;

  update public.shift_swap_requests
  set
    status = 'approved',
    supervisor_decided_by = actor_id,
    supervisor_decided_at = now(),
    decision_note = trim(p_note),
    updated_at = now()
  where id = request_row.id;

  foreach affected_employee in array array[
    request_row.requester_id,
    request_row.colleague_id
  ]
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
      affected_employee,
      'shift_swap_supervisor_decision',
      'Pertukaran shift disetujui',
      'Supervisor menyetujui pertukaran dan menerbitkan versi roster baru.',
      'shift_swap_request',
      request_row.id,
      jsonb_build_object(
        'status', 'approved',
        'roster_version_id', draft_id,
        'version_number', draft_version_number
      )
    )
    returning id into notification_id;

    insert into public.notification_receipts (notification_id)
    values (notification_id);
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
    'decide_shift_swap_supervisor',
    'shift_swap_request',
    request_row.id,
    jsonb_build_object(
      'status', request_row.status,
      'roster_version_id', source_version.id
    ),
    jsonb_build_object(
      'status', 'approved',
      'roster_version_id', draft_id,
      'version_number', draft_version_number
    ),
    trim(p_note)
  );

  return jsonb_build_object(
    'request_id', request_row.id,
    'status', 'approved',
    'roster_version_id', draft_id,
    'version_number', draft_version_number
  );
end;
$$;

revoke all on function public.prevent_published_schedule_mutation() from public;
revoke all on function public.ensure_manual_roster_draft(date, text) from public;
revoke all on function public.save_manual_roster_assignment(
  date,
  uuid,
  date,
  uuid,
  public.shift_type,
  public.schedule_status,
  text,
  text,
  date,
  boolean
) from public;
revoke all on function public.get_monthly_roster(date) from public;
revoke all on function public.publish_manual_roster(uuid, text) from public;
revoke all on function public.acknowledge_monthly_roster(date) from public;
revoke all on function public.get_shift_swap_options(uuid) from public;
revoke all on function public.request_shift_swap(uuid, uuid, text) from public;
revoke all on function public.decide_shift_swap_colleague(uuid, text, text)
  from public;
revoke all on function public.decide_shift_swap_supervisor(uuid, text, text)
  from public;

grant execute on function public.save_manual_roster_assignment(
  date,
  uuid,
  date,
  uuid,
  public.shift_type,
  public.schedule_status,
  text,
  text,
  date,
  boolean
) to authenticated;
grant execute on function public.get_monthly_roster(date) to authenticated;
grant execute on function public.publish_manual_roster(uuid, text)
  to authenticated;
grant execute on function public.acknowledge_monthly_roster(date)
  to authenticated;
grant execute on function public.get_shift_swap_options(uuid)
  to authenticated;
grant execute on function public.request_shift_swap(uuid, uuid, text)
  to authenticated;
grant execute on function public.decide_shift_swap_colleague(uuid, text, text)
  to authenticated;
grant execute on function public.decide_shift_swap_supervisor(uuid, text, text)
  to authenticated;
