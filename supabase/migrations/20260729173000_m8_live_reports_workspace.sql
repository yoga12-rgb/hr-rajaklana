-- M8 role-aware operational reports. Interactive reports are intentionally
-- bounded to 92 days; larger exports will use an asynchronous export worker.

create index if not exists attendance_records_outlet_work_date
  on public.attendance_records (outlet_id, work_date desc);

create index if not exists overtime_requests_date_status
  on public.overtime_requests (overtime_date desc, status);

create or replace function public.get_report_workspace(
  p_period_start date,
  p_period_end date,
  p_outlet_id uuid default null,
  p_employee_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_role public.access_role := public.current_access_role();
begin
  if viewer_role not in ('supervisor', 'management') then
    raise exception using
      errcode = '42501',
      message = 'Laporan hanya tersedia untuk supervisor dan management.';
  end if;

  if p_period_start is null
    or p_period_end is null
    or p_period_end < p_period_start then
    raise exception using
      errcode = '22023',
      message = 'Periode laporan tidak valid.';
  end if;

  if p_period_end - p_period_start > 91 then
    raise exception using
      errcode = '22023',
      message = 'Laporan interaktif dibatasi maksimal 92 hari.';
  end if;

  if p_outlet_id is not null and not exists (
    select 1 from public.outlets outlet where outlet.id = p_outlet_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'Outlet laporan tidak ditemukan.';
  end if;

  if p_employee_id is not null and not exists (
    select 1 from public.employees employee where employee.id = p_employee_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'Karyawan laporan tidak ditemukan.';
  end if;

  return jsonb_build_object(
    'role', viewer_role,
    'period_start', p_period_start,
    'period_end', p_period_end,
    'selected_outlet_id', p_outlet_id,
    'selected_employee_id', p_employee_id,
    'filters', jsonb_build_object(
      'outlets', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', outlet.id,
            'code', outlet.code,
            'name', outlet.name,
            'is_active', outlet.is_active
          )
          order by outlet.name
        )
        from public.outlets outlet
      ), '[]'::jsonb),
      'employees', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', employee.id,
            'nik', employee.nik,
            'name', employee.full_name,
            'position_name', position.name
          )
          order by employee.full_name
        )
        from public.employees employee
        join public.job_positions position
          on position.id = employee.job_position_id
        where employee.archived_at is null
      ), '[]'::jsonb)
    ),
    'summary', jsonb_build_object(
      'employee_count', (
        select count(distinct employee.id)::integer
        from public.employees employee
        where employee.archived_at is null
          and (p_employee_id is null or employee.id = p_employee_id)
          and (
            p_outlet_id is null
            or exists (
              select 1
              from public.employee_placements placement
              where placement.employee_id = employee.id
                and placement.outlet_id = p_outlet_id
                and placement.start_date <= p_period_end
                and (
                  placement.end_date is null
                  or placement.end_date >= p_period_start
                )
            )
          )
      ),
      'attendance_count', (
        select count(*)::integer
        from public.attendance_records attendance
        where attendance.work_date between p_period_start and p_period_end
          and (p_outlet_id is null or attendance.outlet_id = p_outlet_id)
          and (p_employee_id is null or attendance.employee_id = p_employee_id)
      ),
      'on_time_count', (
        select count(*)::integer
        from public.attendance_records attendance
        where attendance.work_date between p_period_start and p_period_end
          and attendance.clock_in_state in ('on_time', 'flexible')
          and (p_outlet_id is null or attendance.outlet_id = p_outlet_id)
          and (p_employee_id is null or attendance.employee_id = p_employee_id)
      ),
      'late_count', (
        select count(*)::integer
        from public.attendance_records attendance
        where attendance.work_date between p_period_start and p_period_end
          and attendance.clock_in_state = 'late'
          and (p_outlet_id is null or attendance.outlet_id = p_outlet_id)
          and (p_employee_id is null or attendance.employee_id = p_employee_id)
      ),
      'early_checkout_count', (
        select count(*)::integer
        from public.attendance_records attendance
        where attendance.work_date between p_period_start and p_period_end
          and attendance.clock_out_state in ('early', 'short_hours')
          and (p_outlet_id is null or attendance.outlet_id = p_outlet_id)
          and (p_employee_id is null or attendance.employee_id = p_employee_id)
      ),
      'approved_leave_days', coalesce((
        select sum(leave_request.requested_days)
        from public.leave_requests leave_request
        where leave_request.status = 'approved'
          and leave_request.starts_on <= p_period_end
          and leave_request.ends_on >= p_period_start
          and (
            p_employee_id is null
            or leave_request.employee_id = p_employee_id
          )
          and (
            p_outlet_id is null
            or exists (
              select 1
              from public.employee_placements placement
              where placement.employee_id = leave_request.employee_id
                and placement.outlet_id = p_outlet_id
                and placement.start_date <= leave_request.ends_on
                and (
                  placement.end_date is null
                  or placement.end_date >= leave_request.starts_on
                )
            )
          )
      ), 0),
      'approved_overtime_minutes', coalesce((
        select sum(overtime.approved_duration_min)
        from public.overtime_requests overtime
        where overtime.status = 'approved'
          and overtime.overtime_date between p_period_start and p_period_end
          and (p_employee_id is null or overtime.employee_id = p_employee_id)
          and (
            p_outlet_id is null
            or exists (
              select 1
              from public.employee_placements placement
              where placement.employee_id = overtime.employee_id
                and placement.outlet_id = p_outlet_id
                and placement.start_date <= overtime.overtime_date
                and (
                  placement.end_date is null
                  or placement.end_date >= overtime.overtime_date
                )
            )
          )
      ), 0)
    ),
    'attendance', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', attendance.id,
          'employee_id', employee.id,
          'employee_name', employee.full_name,
          'position_name', position.name,
          'outlet_id', outlet.id,
          'outlet_name', outlet.name,
          'work_date', attendance.work_date,
          'clock_in_at', attendance.clock_in_at,
          'clock_out_at', attendance.clock_out_at,
          'worked_duration_min', attendance.worked_duration_min,
          'clock_in_state', attendance.clock_in_state,
          'clock_out_state', attendance.clock_out_state,
          'validation_status', attendance.validation_status
        )
        order by attendance.work_date desc, attendance.clock_in_at desc
      )
      from public.attendance_records attendance
      join public.employees employee on employee.id = attendance.employee_id
      join public.job_positions position on position.id = employee.job_position_id
      join public.outlets outlet on outlet.id = attendance.outlet_id
      where attendance.work_date between p_period_start and p_period_end
        and (p_outlet_id is null or attendance.outlet_id = p_outlet_id)
        and (p_employee_id is null or attendance.employee_id = p_employee_id)
    ), '[]'::jsonb),
    'leaves', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', leave_request.id,
          'employee_id', employee.id,
          'employee_name', employee.full_name,
          'leave_type_name', leave_type.name,
          'starts_on', leave_request.starts_on,
          'ends_on', leave_request.ends_on,
          'requested_days', leave_request.requested_days,
          'status', leave_request.status
        )
        order by leave_request.starts_on desc
      )
      from public.leave_requests leave_request
      join public.employees employee on employee.id = leave_request.employee_id
      join public.leave_types leave_type on leave_type.id = leave_request.leave_type_id
      where leave_request.starts_on <= p_period_end
        and leave_request.ends_on >= p_period_start
        and (p_employee_id is null or leave_request.employee_id = p_employee_id)
        and (
          p_outlet_id is null
          or exists (
            select 1
            from public.employee_placements placement
            where placement.employee_id = leave_request.employee_id
              and placement.outlet_id = p_outlet_id
              and placement.start_date <= leave_request.ends_on
              and (
                placement.end_date is null
                or placement.end_date >= leave_request.starts_on
              )
          )
        )
    ), '[]'::jsonb),
    'overtime', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', overtime.id,
          'employee_id', employee.id,
          'employee_name', employee.full_name,
          'overtime_date', overtime.overtime_date,
          'source_type', overtime.source_type,
          'planned_duration_min', overtime.planned_duration_min,
          'actual_duration_min', overtime.actual_duration_min,
          'approved_duration_min', overtime.approved_duration_min,
          'status', overtime.status
        )
        order by overtime.overtime_date desc
      )
      from public.overtime_requests overtime
      join public.employees employee on employee.id = overtime.employee_id
      where overtime.overtime_date between p_period_start and p_period_end
        and (p_employee_id is null or overtime.employee_id = p_employee_id)
        and (
          p_outlet_id is null
          or exists (
            select 1
            from public.employee_placements placement
            where placement.employee_id = overtime.employee_id
              and placement.outlet_id = p_outlet_id
              and placement.start_date <= overtime.overtime_date
              and (
                placement.end_date is null
                or placement.end_date >= overtime.overtime_date
              )
          )
        )
    ), '[]'::jsonb),
    'shift_distribution', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'shift_type', distribution.shift_type,
          'assignment_type', distribution.assignment_type,
          'status', distribution.status,
          'total', distribution.total
        )
        order by distribution.shift_type, distribution.assignment_type
      )
      from (
        select
          case
            when assignment.status = 'off' then 'off'
            when assignment.status = 'leave' then 'leave'
            else template.shift_type::text
          end as shift_type,
          assignment.assignment_type,
          assignment.status::text as status,
          count(*)::integer as total
        from public.schedule_assignments assignment
        join public.roster_versions roster_version
          on roster_version.id = assignment.roster_version_id
          and roster_version.status = 'published'
        left join public.outlet_shift_templates template
          on template.id = assignment.shift_template_id
        where assignment.work_date between p_period_start and p_period_end
          and (p_outlet_id is null or assignment.outlet_id = p_outlet_id)
          and (p_employee_id is null or assignment.employee_id = p_employee_id)
        group by 1, 2, 3
      ) distribution
    ), '[]'::jsonb),
    'outlet_comparison', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'outlet_id', outlet.id,
          'outlet_name', outlet.name,
          'attendance_count', coalesce(metric.attendance_count, 0),
          'late_count', coalesce(metric.late_count, 0),
          'early_checkout_count', coalesce(metric.early_checkout_count, 0)
        )
        order by outlet.name
      )
      from public.outlets outlet
      left join lateral (
        select
          count(*)::integer as attendance_count,
          count(*) filter (
            where attendance.clock_in_state = 'late'
          )::integer as late_count,
          count(*) filter (
            where attendance.clock_out_state in ('early', 'short_hours')
          )::integer as early_checkout_count
        from public.attendance_records attendance
        where attendance.outlet_id = outlet.id
          and attendance.work_date between p_period_start and p_period_end
          and (p_employee_id is null or attendance.employee_id = p_employee_id)
      ) metric on true
      where p_outlet_id is null or outlet.id = p_outlet_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_report_workspace(date, date, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_report_workspace(date, date, uuid, uuid)
  to authenticated;
