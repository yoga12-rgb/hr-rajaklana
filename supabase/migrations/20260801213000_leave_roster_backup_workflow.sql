-- Approved leave must be reflected in the editable roster without mutating an
-- immutable published version. Scheduled work that becomes leave also creates
-- an actionable supervisor notification for a manual cross-outlet backup.

create function public.sync_approved_leave_to_roster(
  p_leave_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  request_row public.leave_requests%rowtype;
  employee_name text;
  period_row public.roster_periods%rowtype;
  draft_id uuid;
  work_day date;
  assignment_row record;
  placement_outlet_id uuid;
  saved_assignment public.schedule_assignments%rowtype;
  before_assignment jsonb;
  affected_schedule_ids jsonb := '[]'::jsonb;
  shift_label text;
begin
  if not public.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'Hanya supervisor yang dapat menyelaraskan cuti dengan roster.';
  end if;

  select request.*
  into request_row
  from public.leave_requests request
  where request.id = p_leave_request_id
    and request.status = 'approved';

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Pengajuan cuti approved tidak ditemukan.';
  end if;

  select employee.full_name
  into employee_name
  from public.employees employee
  where employee.id = request_row.employee_id;

  for period_row in
    select period.*
    from public.roster_periods period
    where period.month_start <= request_row.ends_on
      and (period.month_start + interval '1 month - 1 day')::date
        >= request_row.starts_on
      and period.status <> 'closed'
    order by period.month_start
    for update
  loop
    draft_id := public.ensure_manual_roster_draft(
      period_row.month_start,
      format('Sinkronisasi cuti approved %s', p_leave_request_id)
    );

    for work_day in
      select leave_day::date
      from generate_series(
        greatest(request_row.starts_on, period_row.month_start),
        least(
          request_row.ends_on,
          (period_row.month_start + interval '1 month - 1 day')::date
        ),
        interval '1 day'
      ) leave_day
    loop
      select
        assignment.*,
        template.shift_type,
        outlet.name as outlet_name
      into assignment_row
      from public.schedule_assignments assignment
      left join public.outlet_shift_templates template
        on template.id = assignment.shift_template_id
      join public.outlets outlet on outlet.id = assignment.outlet_id
      where assignment.roster_version_id = draft_id
        and assignment.employee_id = request_row.employee_id
        and assignment.work_date = work_day
      for update of assignment;

      if found and assignment_row.status = 'scheduled' then
        before_assignment := to_jsonb(assignment_row)
          - 'shift_type'
          - 'outlet_name';

        delete from public.backup_assignments backup
        where backup.schedule_assignment_id = assignment_row.id;

        update public.schedule_assignments assignment
        set
          shift_template_id = null,
          assignment_type = 'primary',
          planned_start = null,
          planned_end = null,
          planned_duration_min = 0,
          status = 'leave',
          updated_at = pg_catalog.clock_timestamp()
        where assignment.id = assignment_row.id
        returning assignment.* into saved_assignment;

        insert into public.schedule_overrides (
          schedule_assignment_id,
          before_values,
          after_values,
          reason,
          changed_by
        )
        values (
          saved_assignment.id,
          before_assignment,
          to_jsonb(saved_assignment),
          format('Cuti disetujui: %s', p_leave_request_id),
          auth.uid()
        );

        affected_schedule_ids := affected_schedule_ids
          || jsonb_build_array(saved_assignment.id);
        shift_label := case assignment_row.shift_type::text
          when 'morning' then 'Pagi'
          when 'middle' then 'Middle'
          when 'night' then 'Malam'
          else 'jadwal kerja'
        end;

        perform public.workforce_notify_supervisors(
          'roster_backup_required',
          format('Backup diperlukan · %s', assignment_row.outlet_name),
          format(
            '%s cuti pada %s. Alokasi shift %s perlu ditinjau dan dapat diisi backup dari outlet lain.',
            employee_name,
            work_day,
            shift_label
          ),
          'roster_backup_need',
          p_leave_request_id,
          jsonb_build_object(
            'action', 'assign_backup',
            'leave_request_id', p_leave_request_id,
            'leave_employee_id', request_row.employee_id,
            'leave_employee_name', employee_name,
            'roster_version_id', draft_id,
            'month_start', period_row.month_start,
            'work_date', work_day,
            'outlet_id', assignment_row.outlet_id,
            'outlet_name', assignment_row.outlet_name,
            'shift_type', assignment_row.shift_type
          ),
          request_row.employee_id
        );
      elsif found and assignment_row.status = 'off' then
        perform public.workforce_notify_supervisors(
          'leave_off_overlap',
          'Cuti bertabrakan dengan off day',
          format(
            '%s memiliki cuti approved dan off day pada %s. Tinjau kembali jatah off pekan tersebut.',
            employee_name,
            work_day
          ),
          'roster_leave_overlap',
          p_leave_request_id,
          jsonb_build_object(
            'action', 'review_off',
            'leave_request_id', p_leave_request_id,
            'employee_id', request_row.employee_id,
            'month_start', period_row.month_start,
            'work_date', work_day,
            'outlet_id', assignment_row.outlet_id
          ),
          request_row.employee_id
        );
      elsif not found then
        select placement.outlet_id
        into placement_outlet_id
        from public.employee_placements placement
        where placement.employee_id = request_row.employee_id
          and placement.is_primary
          and placement.start_date <= work_day
          and (
            placement.end_date is null
            or placement.end_date >= work_day
          )
        order by placement.start_date desc
        limit 1;

        if placement_outlet_id is not null then
          insert into public.schedule_assignments (
            roster_version_id,
            employee_id,
            outlet_id,
            work_date,
            assignment_type,
            status,
            assignment_source
          )
          values (
            draft_id,
            request_row.employee_id,
            placement_outlet_id,
            work_day,
            'primary',
            'leave',
            'manual'
          )
          returning * into saved_assignment;

          affected_schedule_ids := affected_schedule_ids
            || jsonb_build_array(saved_assignment.id);
        end if;
      end if;
    end loop;
  end loop;

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    after_values,
    reason
  )
  values (
    auth.uid(),
    'sync_approved_leave_to_roster',
    'leave_request',
    p_leave_request_id,
    jsonb_build_object(
      'affected_schedule_ids', affected_schedule_ids,
      'affected_schedule_count', jsonb_array_length(affected_schedule_ids)
    ),
    'Cuti approved diselaraskan ke draft roster'
  );

  return affected_schedule_ids;
end;
$$;

revoke all on function public.sync_approved_leave_to_roster(uuid)
from public, anon, authenticated;

create or replace function public.decide_leave_request(
  request_id uuid,
  decision text,
  note text,
  expected_version integer
)
returns public.leave_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_request public.leave_requests%rowtype;
  decided_request public.leave_requests%rowtype;
  leave_type public.leave_types%rowtype;
  affected_schedule_ids jsonb := '[]'::jsonb;
begin
  if not public.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'Hanya supervisor yang dapat memutuskan pengajuan cuti.';
  end if;

  if decision is null
    or decision not in ('approved', 'rejected')
    or (decision = 'rejected' and length(trim(note)) < 3) then
    raise exception using
      errcode = '22023',
      message = 'Keputusan atau catatan penolakan tidak valid.';
  end if;

  select *
  into previous_request
  from public.leave_requests
  where id = request_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Pengajuan cuti tidak ditemukan.';
  end if;

  if previous_request.status <> 'pending'
    or previous_request.request_version <> expected_version then
    raise exception using
      errcode = '40001',
      message = 'Pengajuan cuti sudah diputuskan atau berubah.';
  end if;

  if previous_request.employee_id = public.current_employee_id() then
    raise exception using
      errcode = '42501',
      message = 'Supervisor tidak dapat memutuskan pengajuan sendiri.';
  end if;

  select *
  into leave_type
  from public.leave_types
  where id = previous_request.leave_type_id;

  if leave_type.deducts_annual_balance then
    perform 1
    from public.leave_entitlements
    where employee_id = previous_request.employee_id
      and leave_type_id = previous_request.leave_type_id
      and year = extract(year from previous_request.starts_on)::integer
      and reserved_days >= previous_request.requested_days
    for update;

    if not found then
      raise exception using
        errcode = '23514',
        message = 'Reservasi saldo cuti tidak konsisten.';
    end if;

    update public.leave_entitlements
    set
      used_days = used_days + case
        when decision = 'approved' then previous_request.requested_days
        else 0
      end,
      reserved_days = reserved_days - previous_request.requested_days
    where employee_id = previous_request.employee_id
      and leave_type_id = previous_request.leave_type_id
      and year = extract(year from previous_request.starts_on)::integer;
  end if;

  update public.leave_requests
  set
    status = decision::public.request_status,
    request_version = request_version + 1,
    decided_by = (select auth.uid()),
    decided_at = now(),
    decision_note = nullif(trim(note), '')
  where id = request_id
    and status = 'pending'
    and request_version = expected_version
  returning * into decided_request;

  if not found then
    raise exception using
      errcode = '40001',
      message = 'Pengajuan cuti sudah diputuskan oleh supervisor lain.';
  end if;

  if decision = 'approved' then
    affected_schedule_ids := public.sync_approved_leave_to_roster(
      decided_request.id
    );
  end if;

  perform public.workforce_notify_employee(
    previous_request.employee_id,
    'leave_request_decided',
    case
      when decision = 'approved' then 'Pengajuan cuti disetujui'
      else 'Pengajuan cuti ditolak'
    end,
    case
      when decision = 'approved'
        then 'Pengajuan Anda telah disetujui supervisor.'
      else format('Pengajuan Anda ditolak: %s', trim(note))
    end,
    'leave_request',
    decided_request.id,
    jsonb_build_object(
      'status', decided_request.status,
      'request_version', decided_request.request_version,
      'affected_schedule_ids', affected_schedule_ids
    )
  );

  insert into public.approval_events (
    subject_type,
    subject_id,
    actor_id,
    action,
    note,
    subject_version
  )
  values (
    'leave_request',
    request_id,
    (select auth.uid()),
    decision,
    nullif(trim(note), ''),
    decided_request.request_version
  );

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
    (select auth.uid()),
    'decide',
    'leave_request',
    request_id,
    to_jsonb(previous_request),
    to_jsonb(decided_request),
    nullif(trim(note), '')
  );

  return decided_request;
end;
$$;
