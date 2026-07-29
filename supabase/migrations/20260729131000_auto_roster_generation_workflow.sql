alter table public.schedule_assignments
  add column assignment_source text not null default 'manual'
    check (assignment_source in ('manual', 'generated')),
  add column generation_run_id uuid
    references public.roster_generation_runs(id) on delete set null;

alter table public.roster_generation_runs
  add column idempotency_key text;

create unique index roster_generation_runs_idempotent
  on public.roster_generation_runs (roster_version_id, idempotency_key)
  where idempotency_key is not null;

alter table public.roster_score_details
  add column off_count integer not null default 0 check (off_count >= 0);

create or replace function public.mark_manual_schedule_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.roster_generation', true), '') <> 'on' then
    new.assignment_source := 'manual';
    new.generation_run_id := null;
  end if;
  return new;
end;
$$;

create trigger schedule_assignments_mark_manual
before insert or update on public.schedule_assignments
for each row execute function public.mark_manual_schedule_assignment();

create or replace function public.get_roster_generation_input(
  p_month_start date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  period_id uuid;
  draft_id uuid;
  month_end date;
  employees_json jsonb;
  outlets_json jsonb;
  policy_json jsonb;
begin
  if not public.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'Hanya supervisor yang dapat membuat roster otomatis.';
  end if;

  if p_month_start is null
    or p_month_start <> date_trunc('month', p_month_start)::date then
    raise exception using
      errcode = '22023',
      message = 'Periode roster harus menggunakan tanggal pertama bulan.';
  end if;

  month_end := (p_month_start + interval '1 month - 1 day')::date;

  select period.id
  into period_id
  from public.roster_periods period
  where period.month_start = p_month_start;

  if period_id is not null then
    select version.id
    into draft_id
    from public.roster_versions version
    where version.roster_period_id = period_id
      and version.status = 'draft'
    order by version.version_number desc
    limit 1;
  end if;

  select coalesce(jsonb_agg(employee_payload order by employee_name), '[]'::jsonb)
  into employees_json
  from (
    select
      employee.full_name as employee_name,
      jsonb_build_object(
        'id', employee.id,
        'name', employee.full_name,
        'primaryOutletId', coalesce(
          (
            select placement.outlet_id
            from public.employee_placements placement
            where placement.employee_id = employee.id
              and placement.is_primary
              and placement.start_date <= p_month_start
              and (
                placement.end_date is null
                or placement.end_date >= p_month_start
              )
            order by placement.start_date desc
            limit 1
          ),
          (
            select placement.outlet_id
            from public.employee_placements placement
            where placement.employee_id = employee.id
              and placement.is_primary
              and placement.start_date <= month_end
              and (
                placement.end_date is null
                or placement.end_date >= p_month_start
              )
            order by placement.start_date
            limit 1
          )
        ),
        'activeFrom', employee.joined_at,
        'placements', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'outletId', placement.outlet_id,
              'startDate', placement.start_date,
              'endDate', placement.end_date
            )
            order by placement.start_date, placement.outlet_id
          )
          from public.employee_placements placement
          where placement.employee_id = employee.id
            and placement.is_primary
            and placement.start_date <= month_end
            and (
              placement.end_date is null
              or placement.end_date >= p_month_start
            )
        ), '[]'::jsonb),
        'offDays', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'date', off_day.off_date,
              'sourceWeekStart', off_day.source_week_start
            )
            order by off_day.source_week_start
          )
          from public.employee_off_days off_day
          where off_day.roster_period_id = period_id
            and off_day.employee_id = employee.id
        ), '[]'::jsonb),
        'leaveDates', coalesce((
          select jsonb_agg(leave_day::date order by leave_day)
          from public.leave_requests request
          cross join lateral generate_series(
            greatest(request.starts_on, p_month_start),
            least(request.ends_on, month_end),
            interval '1 day'
          ) leave_day
          where request.employee_id = employee.id
            and request.status = 'approved'
            and request.starts_on <= month_end
            and request.ends_on >= p_month_start
        ), '[]'::jsonb),
        'lockedAssignments', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'date', assignment.work_date,
              'outletId', assignment.outlet_id,
              'shift', template.shift_type,
              'isBackup', assignment.assignment_type = 'backup',
              'backupReason', backup.reason
            )
            order by assignment.work_date
          )
          from public.schedule_assignments assignment
          join public.outlet_shift_templates template
            on template.id = assignment.shift_template_id
          left join public.backup_assignments backup
            on backup.schedule_assignment_id = assignment.id
          where assignment.roster_version_id = draft_id
            and assignment.employee_id = employee.id
            and assignment.status = 'scheduled'
            and assignment.assignment_source = 'manual'
        ), '[]'::jsonb)
      ) as employee_payload
    from public.employees employee
    join public.job_positions position
      on position.id = employee.job_position_id
    where employee.archived_at is null
      and employee.joined_at <= month_end
      and position.auto_roster_eligible
      and exists (
        select 1
        from public.employee_placements placement
        where placement.employee_id = employee.id
          and placement.is_primary
          and placement.start_date <= month_end
          and (
            placement.end_date is null
            or placement.end_date >= p_month_start
          )
      )
  ) eligible_employees;

  select coalesce(jsonb_agg(outlet_payload order by outlet_name), '[]'::jsonb)
  into outlets_json
  from (
    select
      outlet.name as outlet_name,
      jsonb_build_object(
        'id', outlet.id,
        'name', outlet.name,
        'availableShifts', coalesce((
          select jsonb_agg(template.shift_type order by template.shift_type)
          from public.outlet_shift_templates template
          where template.outlet_id = outlet.id
            and template.is_active
        ), '[]'::jsonb),
        'staffingRequirements', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'cashierCount', requirement.cashier_count,
              'shift', template.shift_type,
              'minimumStaff', requirement.minimum_staff,
              'effectiveFrom', requirement.effective_from,
              'effectiveUntil', requirement.effective_until
            )
            order by
              requirement.cashier_count,
              template.shift_type,
              requirement.effective_from
          )
          from public.outlet_staffing_requirements requirement
          join public.outlet_shift_templates template
            on template.id = requirement.shift_template_id
          where requirement.outlet_id = outlet.id
            and requirement.effective_from <= month_end
            and (
              requirement.effective_until is null
              or requirement.effective_until >= p_month_start
            )
        ), '[]'::jsonb)
      ) as outlet_payload
    from public.outlets outlet
    where outlet.is_active
  ) active_outlets;

  select case
    when policy.id is null then null
    else jsonb_build_object(
      'id', policy.id,
      'versionNumber', policy.version_number,
      'configuration', policy.configuration,
      'effectiveFrom', policy.effective_from
    )
  end
  into policy_json
  from public.policy_versions policy
  where policy.policy_type = 'roster'
    and policy.effective_from < (p_month_start + interval '1 month')
    and (
      policy.effective_until is null
      or policy.effective_until >= p_month_start
    )
  order by policy.version_number desc
  limit 1;

  return jsonb_build_object(
    'monthStart', p_month_start,
    'employees', employees_json,
    'outlets', outlets_json,
    'policyVersion', policy_json
  );
end;
$$;

create or replace function public.commit_generated_roster(
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
  actor_id uuid := auth.uid();
  draft_id uuid;
  run_id uuid;
  existing_run public.roster_generation_runs%rowtype;
  assignment_item jsonb;
  conflict_item jsonb;
  fairness_item jsonb;
  v_employee_id uuid;
  v_outlet_id uuid;
  v_work_date date;
  shift_value text;
  v_assignment_type text;
  source_value text;
  template_row public.outlet_shift_templates%rowtype;
  duration_minutes integer;
  applied_count integer := 0;
  blocking_count integer := 0;
  draft_preexisting boolean := false;
begin
  if not public.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'Hanya supervisor yang dapat menyimpan roster otomatis.';
  end if;

  if p_month_start is null
    or p_month_start <> date_trunc('month', p_month_start)::date then
    raise exception using
      errcode = '22023',
      message = 'Periode roster harus menggunakan tanggal pertama bulan.';
  end if;

  if length(trim(coalesce(p_idempotency_key, ''))) < 16
    or length(trim(coalesce(p_algorithm_version, ''))) < 3 then
    raise exception using
      errcode = '22023',
      message = 'Identitas generation run tidak valid.';
  end if;

  if p_result_status not in ('valid', 'invalid')
    or jsonb_typeof(p_rule_snapshot) <> 'object'
    or jsonb_typeof(p_assignments) <> 'array'
    or jsonb_typeof(p_conflicts) <> 'array'
    or jsonb_typeof(p_fairness_details) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'Payload hasil optimizer tidak valid.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'roster-generation:' || p_month_start::text,
      0
    )
  );

  select version.id
  into draft_id
  from public.roster_versions version
  join public.roster_periods period
    on period.id = version.roster_period_id
  where period.month_start = p_month_start
    and version.status = 'draft'
  order by version.version_number desc
  limit 1;

  draft_preexisting := draft_id is not null;

  draft_id := public.ensure_manual_roster_draft(
    p_month_start,
    'Generate roster otomatis'
  );

  select *
  into existing_run
  from public.roster_generation_runs generation
  where generation.roster_version_id = draft_id
    and generation.idempotency_key = trim(p_idempotency_key);

  if existing_run.id is not null then
    return jsonb_build_object(
      'generation_run_id', existing_run.id,
      'roster_version_id', draft_id,
      'result_status', existing_run.rule_snapshot->>'resultStatus',
      'assignment_count', (
        select count(*)
        from public.schedule_assignments assignment
        where assignment.generation_run_id = existing_run.id
      ),
      'conflict_count', (
        select count(*)
        from public.roster_conflicts conflict
        where conflict.generation_run_id = existing_run.id
      ),
      'idempotent_replay', true
    );
  end if;

  insert into public.roster_generation_runs (
    roster_version_id,
    algorithm_version,
    rule_snapshot,
    status,
    requested_by,
    idempotency_key
  )
  values (
    draft_id,
    trim(p_algorithm_version),
    p_rule_snapshot || jsonb_build_object('resultStatus', p_result_status),
    'processing',
    actor_id,
    trim(p_idempotency_key)
  )
  returning id into run_id;

  for conflict_item in
    select value from jsonb_array_elements(p_conflicts)
  loop
    insert into public.roster_conflicts (
      generation_run_id,
      employee_id,
      outlet_id,
      work_date,
      conflict_code,
      severity,
      description,
      suggestions
    )
    values (
      run_id,
      nullif(conflict_item->>'employeeId', '')::uuid,
      nullif(conflict_item->>'outletId', '')::uuid,
      nullif(conflict_item->>'date', '')::date,
      conflict_item->>'code',
      conflict_item->>'severity',
      conflict_item->>'description',
      coalesce(conflict_item->'suggestions', '[]'::jsonb)
    );

    if conflict_item->>'severity' = 'blocking' then
      blocking_count := blocking_count + 1;
    end if;
  end loop;

  for fairness_item in
    select value from jsonb_array_elements(p_fairness_details)
  loop
    insert into public.roster_score_details (
      generation_run_id,
      employee_id,
      morning_count,
      night_count,
      middle_count,
      off_count,
      pairing_counts,
      fairness_score
    )
    values (
      run_id,
      (fairness_item->>'employeeId')::uuid,
      coalesce((fairness_item->>'morningCount')::integer, 0),
      coalesce((fairness_item->>'nightCount')::integer, 0),
      coalesce((fairness_item->>'middleCount')::integer, 0),
      coalesce((fairness_item->>'offCount')::integer, 0),
      coalesce(fairness_item->'pairingCounts', '{}'::jsonb),
      coalesce((fairness_item->>'fairnessScore')::numeric, 0)
    );
  end loop;

  if p_result_status = 'valid' and blocking_count > 0 then
    raise exception using
      errcode = '22023',
      message = 'Roster valid tidak boleh memiliki konflik blocking.';
  end if;

  if p_result_status = 'valid' then
    perform set_config('app.roster_generation', 'on', true);

    delete from public.schedule_assignments assignment
    using public.employees employee, public.job_positions position
    where assignment.roster_version_id = draft_id
      and employee.id = assignment.employee_id
      and position.id = employee.job_position_id
      and position.auto_roster_eligible
      and (
        not draft_preexisting
        or assignment.assignment_source = 'generated'
      );

    for assignment_item in
      select value
      from jsonb_array_elements(p_assignments)
      order by value->>'date', value->>'employeeId'
    loop
      v_employee_id := (assignment_item->>'employeeId')::uuid;
      v_outlet_id := (assignment_item->>'outletId')::uuid;
      v_work_date := (assignment_item->>'date')::date;
      shift_value := assignment_item->>'shift';
      v_assignment_type := assignment_item->>'assignmentType';
      source_value := assignment_item->>'source';

      if v_work_date < p_month_start
        or v_work_date >= (p_month_start + interval '1 month')::date then
        raise exception 'Output optimizer memiliki tanggal di luar periode';
      end if;

      perform 1
      from public.employees employee
      join public.job_positions position
        on position.id = employee.job_position_id
      where employee.id = v_employee_id
        and employee.archived_at is null
        and employee.joined_at <= v_work_date
        and position.auto_roster_eligible;

      if not found then
        raise exception 'Output optimizer memuat kasir yang tidak eligible';
      end if;

      if source_value = 'locked' then
        perform 1
        from public.schedule_assignments assignment
        left join public.outlet_shift_templates template
          on template.id = assignment.shift_template_id
        where assignment.roster_version_id = draft_id
          and assignment.employee_id = v_employee_id
          and assignment.work_date = v_work_date
          and assignment.assignment_source = 'manual'
          and assignment.outlet_id = v_outlet_id
          and assignment.assignment_type = v_assignment_type
          and assignment.status = 'scheduled'
          and template.shift_type::text = shift_value;

        if not found then
          raise exception 'Shift terkunci berubah saat generation run disimpan';
        end if;
        continue;
      end if;

      if v_assignment_type <> 'primary' then
        raise exception 'Optimizer tidak boleh membuat backup outlet otomatis';
      end if;

      perform 1
      from public.employee_placements placement
      where placement.employee_id = v_employee_id
        and placement.outlet_id = v_outlet_id
        and placement.is_primary
        and placement.start_date <= v_work_date
        and (
          placement.end_date is null
          or placement.end_date >= v_work_date
        );

      if not found then
        raise exception 'Outlet output tidak sesuai penempatan efektif kasir';
      end if;

      if shift_value in ('morning', 'middle', 'night') then
        select *
        into template_row
        from public.outlet_shift_templates template
        where template.outlet_id = v_outlet_id
          and template.shift_type::text = shift_value
          and template.is_active
        limit 1;

        if template_row.id is null then
          raise exception 'Template shift output tidak tersedia';
        end if;

        duration_minutes := (
          extract(epoch from (
            case
              when template_row.ends_at > template_row.starts_at
                then template_row.ends_at - template_row.starts_at
              else template_row.ends_at - template_row.starts_at + interval '24 hours'
            end
          )) / 60
        )::integer;

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
          status,
          assignment_source,
          generation_run_id
        )
        values (
          draft_id,
          v_employee_id,
          v_outlet_id,
          template_row.id,
          v_work_date,
          'primary',
          template_row.starts_at,
          template_row.ends_at,
          duration_minutes,
          'scheduled',
          'generated',
          run_id
        )
        on conflict (roster_version_id, employee_id, work_date) do nothing;
      elsif shift_value = 'off' then
        perform 1
        from public.employee_off_days off_day
        join public.roster_periods period
          on period.id = off_day.roster_period_id
        where period.month_start = p_month_start
          and off_day.employee_id = v_employee_id
          and off_day.off_date = v_work_date;

        if not found then
          raise exception 'Status off output tidak memiliki alokasi off day';
        end if;

        insert into public.schedule_assignments (
          roster_version_id,
          employee_id,
          outlet_id,
          work_date,
          assignment_type,
          status,
          assignment_source,
          generation_run_id
        )
        values (
          draft_id,
          v_employee_id,
          v_outlet_id,
          v_work_date,
          'primary',
          'off',
          'generated',
          run_id
        )
        on conflict (roster_version_id, employee_id, work_date) do nothing;
      elsif shift_value = 'leave' then
        perform 1
        from public.leave_requests request
        where request.employee_id = v_employee_id
          and request.status = 'approved'
          and request.starts_on <= v_work_date
          and request.ends_on >= v_work_date;

        if not found then
          raise exception 'Status cuti output tidak memiliki pengajuan approved';
        end if;

        insert into public.schedule_assignments (
          roster_version_id,
          employee_id,
          outlet_id,
          work_date,
          assignment_type,
          status,
          assignment_source,
          generation_run_id
        )
        values (
          draft_id,
          v_employee_id,
          v_outlet_id,
          v_work_date,
          'primary',
          'leave',
          'generated',
          run_id
        )
        on conflict (roster_version_id, employee_id, work_date) do nothing;
      else
        raise exception 'Jenis shift output optimizer tidak valid';
      end if;
    end loop;

    select count(*)
    into applied_count
    from public.schedule_assignments assignment
    where assignment.generation_run_id = run_id;
  end if;

  update public.roster_generation_runs
  set
    status = 'completed',
    completed_at = now()
  where id = run_id;

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
    'generate_roster',
    'roster_generation_run',
    run_id,
    jsonb_build_object(
      'roster_version_id', draft_id,
      'result_status', p_result_status,
      'assignment_count', applied_count,
      'conflict_count', jsonb_array_length(p_conflicts),
      'algorithm_version', trim(p_algorithm_version)
    ),
    'Generate roster otomatis'
  );

  return jsonb_build_object(
    'generation_run_id', run_id,
    'roster_version_id', draft_id,
    'result_status', p_result_status,
    'assignment_count', applied_count,
    'conflict_count', jsonb_array_length(p_conflicts),
    'idempotent_replay', false
  );
end;
$$;

revoke all on function public.get_roster_generation_input(date)
  from public, anon, authenticated;
revoke all on function public.mark_manual_schedule_assignment()
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
