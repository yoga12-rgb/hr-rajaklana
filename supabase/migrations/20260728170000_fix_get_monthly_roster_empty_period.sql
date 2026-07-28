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
  employees_json jsonb;
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

  -- Tarik daftar karyawan (diperlukan bahkan jika roster_periods belum ada, agar
  -- supervisor bisa membuat penugasan pertama)
  employees_json := case
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
  end;

  if period_row.id is null then
    return jsonb_build_object(
      'period', null,
      'version', null,
      'employees', employees_json,
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

  return jsonb_build_object(
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
    'employees', employees_json,
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
          'work_date', assignment.work_date,
          'outlet_id',
            case
              when viewer_role in ('supervisor', 'management')
                then assignment.outlet_id
              else null
            end,
          'outlet_name', outlet.name,
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
  );
end;
$$;
