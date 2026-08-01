-- A leave changes the draft on every affected scheduled day, but a cross-outlet
-- backup alert is only warranted when fewer than two eligible cashiers remain.
-- Two workers can still cover the default Morning/Night composition.

create or replace function public.workforce_notify_supervisors(
  p_notification_type text,
  p_title text,
  p_body text,
  p_subject_type text,
  p_subject_id uuid,
  p_payload jsonb default '{}'::jsonb,
  p_excluded_employee_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  supervisor record;
  remaining_staff_count integer;
begin
  if p_notification_type = 'roster_backup_required'
    and p_payload ? 'roster_version_id'
    and p_payload ? 'outlet_id'
    and p_payload ? 'work_date' then
    select count(*)::integer
    into remaining_staff_count
    from public.schedule_assignments assignment
    join public.employees employee on employee.id = assignment.employee_id
    join public.job_positions position
      on position.id = employee.job_position_id
    where assignment.roster_version_id =
        (p_payload->>'roster_version_id')::uuid
      and assignment.outlet_id = (p_payload->>'outlet_id')::uuid
      and assignment.work_date = (p_payload->>'work_date')::date
      and assignment.status = 'scheduled'
      and employee.archived_at is null
      and position.auto_roster_eligible;

    if remaining_staff_count >= 2 then
      return;
    end if;
  end if;

  for supervisor in
    select account.employee_id
    from public.user_accounts account
    join public.employees employee
      on employee.id = account.employee_id
    where account.access_role = 'supervisor'
      and account.account_status = 'active'
      and employee.archived_at is null
      and account.employee_id is distinct from p_excluded_employee_id
  loop
    perform public.workforce_notify_employee(
      supervisor.employee_id,
      p_notification_type,
      p_title,
      p_body,
      p_subject_type,
      p_subject_id,
      p_payload
    );
  end loop;
end;
$$;
