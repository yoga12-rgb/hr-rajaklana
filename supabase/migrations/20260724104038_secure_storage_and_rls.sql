create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select account.employee_id
  from public.user_accounts account
  where account.user_id = (select auth.uid())
    and account.account_status = 'active'
  limit 1;
$$;

create or replace function public.current_access_role()
returns public.access_role
language sql
stable
security definer
set search_path = ''
as $$
  select account.access_role
  from public.user_accounts account
  where account.user_id = (select auth.uid())
    and account.account_status = 'active'
  limit 1;
$$;

create or replace function public.is_supervisor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.current_access_role() = 'supervisor'::public.access_role,
    false
  );
$$;

create or replace function public.can_view_sensitive_operations()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.current_access_role() in (
      'supervisor'::public.access_role,
      'management'::public.access_role
    ),
    false
  );
$$;

revoke all on function public.current_employee_id() from public;
revoke all on function public.current_access_role() from public;
revoke all on function public.is_supervisor() from public;
revoke all on function public.can_view_sensitive_operations() from public;

grant execute on function public.current_employee_id() to authenticated;
grant execute on function public.current_access_role() to authenticated;
grant execute on function public.is_supervisor() to authenticated;
grant execute on function public.can_view_sensitive_operations() to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'employment_statuses',
    'job_positions',
    'policy_versions',
    'employees',
    'user_accounts',
    'emergency_contacts',
    'outlets',
    'employee_placements',
    'outlet_shift_templates',
    'outlet_staffing_requirements',
    'roster_periods',
    'roster_versions',
    'employee_off_days',
    'schedule_assignments',
    'schedule_overrides',
    'schedule_acknowledgements',
    'backup_assignments',
    'shift_swap_requests',
    'roster_generation_runs',
    'roster_conflicts',
    'roster_score_details',
    'attendance_records',
    'attendance_evidence',
    'attendance_risk_flags',
    'attendance_validations',
    'attendance_correction_requests',
    'leave_types',
    'leave_entitlements',
    'leave_requests',
    'request_attachments',
    'overtime_requests',
    'approval_events',
    'announcements',
    'announcement_targets',
    'announcement_receipts',
    'notifications',
    'notification_receipts',
    'push_subscriptions',
    'audit_logs',
    'file_deletion_jobs',
    'data_import_jobs',
    'backup_exports'
  ]
  loop
    execute format(
      'alter table public.%I enable row level security',
      table_name
    );
  end loop;
end;
$$;

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from public;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public
  to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'employment_statuses',
    'job_positions',
    'policy_versions',
    'outlets',
    'outlet_shift_templates',
    'outlet_staffing_requirements',
    'leave_types'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      table_name || '_read_authenticated',
      table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select public.is_supervisor()))',
      table_name || '_insert_supervisor',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select public.is_supervisor())) with check ((select public.is_supervisor()))',
      table_name || '_update_supervisor',
      table_name
    );
  end loop;
end;
$$;

create policy user_accounts_read_authorized
on public.user_accounts
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select public.can_view_sensitive_operations())
);

create policy user_accounts_insert_other_users
on public.user_accounts
for insert
to authenticated
with check (
  (select public.is_supervisor())
  and user_id <> (select auth.uid())
);

create policy user_accounts_update_other_users
on public.user_accounts
for update
to authenticated
using (
  (select public.is_supervisor())
  and user_id <> (select auth.uid())
)
with check (
  (select public.is_supervisor())
  and user_id <> (select auth.uid())
);

create policy employees_read_authorized
on public.employees
for select
to authenticated
using (
  id = (select public.current_employee_id())
  or (select public.can_view_sensitive_operations())
);

create policy employees_insert_supervisor
on public.employees
for insert
to authenticated
with check ((select public.is_supervisor()));

create policy employees_update_supervisor
on public.employees
for update
to authenticated
using ((select public.is_supervisor()))
with check ((select public.is_supervisor()));

create policy emergency_contacts_read_authorized
on public.emergency_contacts
for select
to authenticated
using (
  employee_id = (select public.current_employee_id())
  or (select public.can_view_sensitive_operations())
);

create policy emergency_contacts_insert_supervisor
on public.emergency_contacts
for insert
to authenticated
with check ((select public.is_supervisor()));

create policy emergency_contacts_update_supervisor
on public.emergency_contacts
for update
to authenticated
using ((select public.is_supervisor()))
with check ((select public.is_supervisor()));

create policy employee_placements_read_authorized
on public.employee_placements
for select
to authenticated
using (
  employee_id = (select public.current_employee_id())
  or (select public.can_view_sensitive_operations())
);

create policy employee_placements_insert_supervisor
on public.employee_placements
for insert
to authenticated
with check ((select public.is_supervisor()));

create policy employee_placements_update_supervisor
on public.employee_placements
for update
to authenticated
using ((select public.is_supervisor()))
with check ((select public.is_supervisor()));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'roster_periods',
    'roster_versions',
    'schedule_assignments',
    'backup_assignments'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      table_name || '_read_authenticated',
      table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select public.is_supervisor()))',
      table_name || '_insert_supervisor',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select public.is_supervisor())) with check ((select public.is_supervisor()))',
      table_name || '_update_supervisor',
      table_name
    );
  end loop;
end;
$$;

create policy employee_off_days_read_authorized
on public.employee_off_days
for select
to authenticated
using (
  employee_id = (select public.current_employee_id())
  or (select public.can_view_sensitive_operations())
);

create policy employee_off_days_insert_supervisor
on public.employee_off_days
for insert
to authenticated
with check ((select public.is_supervisor()));

create policy employee_off_days_update_supervisor
on public.employee_off_days
for update
to authenticated
using ((select public.is_supervisor()))
with check ((select public.is_supervisor()));

create policy schedule_overrides_read_operations
on public.schedule_overrides
for select
to authenticated
using ((select public.can_view_sensitive_operations()));

create policy schedule_overrides_insert_supervisor
on public.schedule_overrides
for insert
to authenticated
with check ((select public.is_supervisor()));

create policy schedule_overrides_update_supervisor
on public.schedule_overrides
for update
to authenticated
using ((select public.is_supervisor()))
with check ((select public.is_supervisor()));

create policy schedule_acknowledgements_read_authorized
on public.schedule_acknowledgements
for select
to authenticated
using (
  employee_id = (select public.current_employee_id())
  or (select public.can_view_sensitive_operations())
);

create policy schedule_acknowledgements_insert_own
on public.schedule_acknowledgements
for insert
to authenticated
with check (employee_id = (select public.current_employee_id()));

create policy schedule_acknowledgements_update_supervisor
on public.schedule_acknowledgements
for update
to authenticated
using ((select public.is_supervisor()))
with check ((select public.is_supervisor()));

create policy shift_swap_requests_read_authorized
on public.shift_swap_requests
for select
to authenticated
using (
  requester_id = (select public.current_employee_id())
  or colleague_id = (select public.current_employee_id())
  or (select public.can_view_sensitive_operations())
);

create policy shift_swap_requests_insert_own
on public.shift_swap_requests
for insert
to authenticated
with check (requester_id = (select public.current_employee_id()));

create policy shift_swap_requests_manage_supervisor
on public.shift_swap_requests
for update
to authenticated
using ((select public.is_supervisor()))
with check ((select public.is_supervisor()));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'roster_generation_runs',
    'roster_conflicts',
    'roster_score_details'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select public.can_view_sensitive_operations()))',
      table_name || '_read_operations',
      table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select public.is_supervisor()))',
      table_name || '_insert_supervisor',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select public.is_supervisor())) with check ((select public.is_supervisor()))',
      table_name || '_update_supervisor',
      table_name
    );
  end loop;
end;
$$;

create policy attendance_records_read_authorized
on public.attendance_records
for select
to authenticated
using (
  employee_id = (select public.current_employee_id())
  or (select public.can_view_sensitive_operations())
);

create policy attendance_records_insert_own
on public.attendance_records
for insert
to authenticated
with check (
  employee_id = (select public.current_employee_id())
  and validation_status = 'pending'
);

create policy attendance_records_manage_supervisor
on public.attendance_records
for insert
to authenticated
with check ((select public.is_supervisor()));

create policy attendance_evidence_read_authorized
on public.attendance_evidence
for select
to authenticated
using (
  exists (
    select 1
    from public.attendance_records attendance
    where attendance.id = attendance_evidence.attendance_record_id
      and (
        attendance.employee_id = (select public.current_employee_id())
        or (select public.can_view_sensitive_operations())
      )
  )
);

create policy attendance_evidence_insert_own
on public.attendance_evidence
for insert
to authenticated
with check (
  exists (
    select 1
    from public.attendance_records attendance
    where attendance.id = attendance_evidence.attendance_record_id
      and attendance.employee_id = (select public.current_employee_id())
  )
);

create policy attendance_evidence_manage_supervisor
on public.attendance_evidence
for update
to authenticated
using ((select public.is_supervisor()))
with check ((select public.is_supervisor()));

create policy attendance_risk_flags_read_operations
on public.attendance_risk_flags
for select
to authenticated
using ((select public.can_view_sensitive_operations()));

create policy attendance_risk_flags_insert_supervisor
on public.attendance_risk_flags
for insert
to authenticated
with check ((select public.is_supervisor()));

create policy attendance_risk_flags_update_supervisor
on public.attendance_risk_flags
for update
to authenticated
using ((select public.is_supervisor()))
with check ((select public.is_supervisor()));

create policy attendance_validations_read_authorized
on public.attendance_validations
for select
to authenticated
using (
  exists (
    select 1
    from public.attendance_records attendance
    where attendance.id = attendance_validations.attendance_record_id
      and (
        attendance.employee_id = (select public.current_employee_id())
        or (select public.can_view_sensitive_operations())
      )
  )
);

create policy attendance_corrections_read_authorized
on public.attendance_correction_requests
for select
to authenticated
using (
  requested_by = (select auth.uid())
  or (select public.can_view_sensitive_operations())
);

create policy attendance_corrections_insert_own
on public.attendance_correction_requests
for insert
to authenticated
with check (
  requested_by = (select auth.uid())
  and exists (
    select 1
    from public.attendance_records attendance
    where attendance.id = attendance_correction_requests.attendance_record_id
      and attendance.employee_id = (select public.current_employee_id())
  )
);

create policy leave_entitlements_read_authorized
on public.leave_entitlements
for select
to authenticated
using (
  employee_id = (select public.current_employee_id())
  or (select public.can_view_sensitive_operations())
);

create policy leave_entitlements_insert_supervisor
on public.leave_entitlements
for insert
to authenticated
with check ((select public.is_supervisor()));

create policy leave_entitlements_update_supervisor
on public.leave_entitlements
for update
to authenticated
using ((select public.is_supervisor()))
with check ((select public.is_supervisor()));

create policy leave_requests_read_authorized
on public.leave_requests
for select
to authenticated
using (
  employee_id = (select public.current_employee_id())
  or (select public.can_view_sensitive_operations())
);

create policy leave_requests_insert_own
on public.leave_requests
for insert
to authenticated
with check (
  employee_id = (select public.current_employee_id())
  and status = 'pending'
  and decided_by is null
);

create policy request_attachments_read_authorized
on public.request_attachments
for select
to authenticated
using (
  employee_id = (select public.current_employee_id())
  or (select public.can_view_sensitive_operations())
);

create policy request_attachments_insert_own
on public.request_attachments
for insert
to authenticated
with check (employee_id = (select public.current_employee_id()));

create policy request_attachments_manage_supervisor
on public.request_attachments
for update
to authenticated
using ((select public.is_supervisor()))
with check ((select public.is_supervisor()));

create policy overtime_requests_read_authorized
on public.overtime_requests
for select
to authenticated
using (
  employee_id = (select public.current_employee_id())
  or (select public.can_view_sensitive_operations())
);

create policy overtime_requests_insert_own_or_assigned
on public.overtime_requests
for insert
to authenticated
with check (
  (
    source_type = 'employee_request'
    and employee_id = (select public.current_employee_id())
    and status = 'pending'
    and decided_by is null
  )
  or (
    (select public.is_supervisor())
    and source_type = 'supervisor_assignment'
    and assigned_by = (select auth.uid())
  )
);

create policy approval_events_read_operations
on public.approval_events
for select
to authenticated
using ((select public.can_view_sensitive_operations()));

create or replace function public.can_view_announcement(
  target_announcement_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select public.can_view_sensitive_operations())
    or exists (
      select 1
      from public.announcement_targets target
      where target.announcement_id = target_announcement_id
        and (
          target.target_type = 'all'
          or (
            target.target_type = 'employee'
            and target.target_id = (select public.current_employee_id())
          )
          or (
            target.target_type = 'outlet'
            and exists (
              select 1
              from public.employee_placements placement
              where placement.employee_id =
                (select public.current_employee_id())
                and placement.outlet_id = target.target_id
                and placement.start_date <= current_date
                and (
                  placement.end_date is null
                  or placement.end_date >= current_date
                )
            )
          )
        )
    );
$$;

revoke all on function public.can_view_announcement(uuid) from public;
grant execute on function public.can_view_announcement(uuid) to authenticated;

create policy announcements_read_targeted
on public.announcements
for select
to authenticated
using ((select public.can_view_announcement(id)));

create policy announcements_insert_supervisor
on public.announcements
for insert
to authenticated
with check ((select public.is_supervisor()));

create policy announcements_update_supervisor
on public.announcements
for update
to authenticated
using ((select public.is_supervisor()))
with check ((select public.is_supervisor()));

create policy announcement_targets_read_targeted
on public.announcement_targets
for select
to authenticated
using ((select public.can_view_announcement(announcement_id)));

create policy announcement_targets_insert_supervisor
on public.announcement_targets
for insert
to authenticated
with check ((select public.is_supervisor()));

create policy announcement_targets_update_supervisor
on public.announcement_targets
for update
to authenticated
using ((select public.is_supervisor()))
with check ((select public.is_supervisor()));

create policy announcement_receipts_read_authorized
on public.announcement_receipts
for select
to authenticated
using (
  employee_id = (select public.current_employee_id())
  or (select public.can_view_sensitive_operations())
);

create policy announcement_receipts_write_own
on public.announcement_receipts
for insert
to authenticated
with check (employee_id = (select public.current_employee_id()));

create policy announcement_receipts_update_own
on public.announcement_receipts
for update
to authenticated
using (employee_id = (select public.current_employee_id()))
with check (employee_id = (select public.current_employee_id()));

create policy announcement_receipts_update_supervisor
on public.announcement_receipts
for update
to authenticated
using ((select public.is_supervisor()))
with check ((select public.is_supervisor()));

create policy notifications_read_authorized
on public.notifications
for select
to authenticated
using (
  employee_id = (select public.current_employee_id())
  or (select public.can_view_sensitive_operations())
);

create policy notifications_insert_supervisor
on public.notifications
for insert
to authenticated
with check ((select public.is_supervisor()));

create policy notifications_update_supervisor
on public.notifications
for update
to authenticated
using ((select public.is_supervisor()))
with check ((select public.is_supervisor()));

create policy notification_receipts_read_own
on public.notification_receipts
for select
to authenticated
using (
  exists (
    select 1
    from public.notifications notification
    where notification.id = notification_receipts.notification_id
      and (
        notification.employee_id = (select public.current_employee_id())
        or (select public.can_view_sensitive_operations())
      )
  )
);

create policy notification_receipts_update_own
on public.notification_receipts
for update
to authenticated
using (
  exists (
    select 1
    from public.notifications notification
    where notification.id = notification_receipts.notification_id
      and notification.employee_id = (select public.current_employee_id())
  )
)
with check (
  exists (
    select 1
    from public.notifications notification
    where notification.id = notification_receipts.notification_id
      and notification.employee_id = (select public.current_employee_id())
  )
);

create policy push_subscriptions_manage_own
on public.push_subscriptions
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy audit_logs_read_operations
on public.audit_logs
for select
to authenticated
using ((select public.can_view_sensitive_operations()));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'file_deletion_jobs',
    'data_import_jobs',
    'backup_exports'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select public.can_view_sensitive_operations()))',
      table_name || '_read_operations',
      table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select public.is_supervisor()))',
      table_name || '_insert_supervisor',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select public.is_supervisor())) with check ((select public.is_supervisor()))',
      table_name || '_update_supervisor',
      table_name
    );
  end loop;
end;
$$;

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
begin
  if not public.is_supervisor() then
    raise exception 'Only supervisors can decide leave requests';
  end if;

  if decision is null or decision not in ('approved', 'rejected') then
    raise exception 'Invalid leave decision';
  end if;

  select *
  into previous_request
  from public.leave_requests
  where id = request_id
  for update;

  if not found then
    raise exception 'Leave request not found';
  end if;

  if previous_request.status <> 'pending'
    or previous_request.request_version <> expected_version then
    raise exception 'Leave request has already changed';
  end if;

  if previous_request.employee_id = public.current_employee_id() then
    raise exception 'Self-approval is not allowed';
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
    raise exception 'Leave request has already been decided';
  end if;

  if decision = 'approved' then
    update public.leave_entitlements
    set
      used_days = used_days + previous_request.requested_days,
      reserved_days = greatest(
        0,
        reserved_days - previous_request.requested_days
      )
    where employee_id = previous_request.employee_id
      and leave_type_id = previous_request.leave_type_id
      and year = extract(year from previous_request.starts_on)::integer;
  end if;

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

create or replace function public.decide_overtime_request(
  request_id uuid,
  decision text,
  approved_minutes integer,
  note text,
  expected_version integer
)
returns public.overtime_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_request public.overtime_requests%rowtype;
  decided_request public.overtime_requests%rowtype;
begin
  if not public.is_supervisor() then
    raise exception 'Only supervisors can decide overtime requests';
  end if;

  if decision is null or decision not in ('approved', 'rejected') then
    raise exception 'Invalid overtime decision';
  end if;

  if decision = 'approved' and (
    approved_minutes is null
    or approved_minutes < 60
    or approved_minutes % 30 <> 0
  ) then
    raise exception 'Approved overtime must be at least 60 minutes in 30 minute increments';
  end if;

  select *
  into previous_request
  from public.overtime_requests
  where id = request_id
  for update;

  if not found then
    raise exception 'Overtime request not found';
  end if;

  if previous_request.status <> 'pending'
    or previous_request.request_version <> expected_version then
    raise exception 'Overtime request has already changed';
  end if;

  if previous_request.employee_id = public.current_employee_id() then
    raise exception 'Self-approval is not allowed';
  end if;

  update public.overtime_requests
  set
    status = decision::public.request_status,
    approved_duration_min = case
      when decision = 'approved' then approved_minutes
      else 0
    end,
    request_version = request_version + 1,
    decided_by = (select auth.uid()),
    decided_at = now(),
    decision_note = nullif(trim(note), '')
  where id = request_id
    and status = 'pending'
    and request_version = expected_version
  returning * into decided_request;

  if not found then
    raise exception 'Overtime request has already been decided';
  end if;

  insert into public.approval_events (
    subject_type,
    subject_id,
    actor_id,
    action,
    note,
    subject_version
  )
  values (
    'overtime_request',
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
    'overtime_request',
    request_id,
    to_jsonb(previous_request),
    to_jsonb(decided_request),
    nullif(trim(note), '')
  );

  return decided_request;
end;
$$;

create or replace function public.decide_attendance_correction(
  correction_id uuid,
  decision text,
  note text,
  expected_version integer
)
returns public.attendance_correction_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_correction public.attendance_correction_requests%rowtype;
  decided_correction public.attendance_correction_requests%rowtype;
  previous_attendance public.attendance_records%rowtype;
  corrected_attendance public.attendance_records%rowtype;
  effective_clock_in timestamptz;
  effective_clock_out timestamptz;
begin
  if not public.is_supervisor() then
    raise exception 'Only supervisors can decide attendance corrections';
  end if;

  if decision is null or decision not in ('approved', 'rejected') then
    raise exception 'Invalid attendance correction decision';
  end if;

  select *
  into previous_correction
  from public.attendance_correction_requests
  where id = correction_id
  for update;

  if not found then
    raise exception 'Attendance correction request not found';
  end if;

  if previous_correction.status <> 'pending'
    or previous_correction.request_version <> expected_version then
    raise exception 'Attendance correction request has already changed';
  end if;

  select *
  into previous_attendance
  from public.attendance_records
  where id = previous_correction.attendance_record_id
  for update;

  if not found then
    raise exception 'Attendance record not found';
  end if;

  if previous_correction.requested_by = (select auth.uid())
    or previous_attendance.employee_id = public.current_employee_id() then
    raise exception 'Self-approval is not allowed';
  end if;

  if decision = 'approved' then
    effective_clock_in := coalesce(
      nullif(previous_correction.requested_values ->> 'clock_in_at', '')::timestamptz,
      previous_attendance.clock_in_at
    );
    effective_clock_out := coalesce(
      nullif(previous_correction.requested_values ->> 'clock_out_at', '')::timestamptz,
      previous_attendance.clock_out_at
    );

    if effective_clock_out is null then
      raise exception 'Approved correction must include a checkout time';
    end if;

    if effective_clock_out < effective_clock_in then
      raise exception 'Checkout time cannot be earlier than check-in time';
    end if;

    update public.attendance_records
    set
      clock_in_at = effective_clock_in,
      clock_out_at = effective_clock_out,
      worked_duration_min = floor(
        extract(epoch from (effective_clock_out - effective_clock_in)) / 60
      )::integer,
      attendance_status = 'corrected',
      validation_status = 'pending',
      validation_due_at = now() + interval '3 days',
      record_version = record_version + 1
    where id = previous_attendance.id
    returning * into corrected_attendance;
  else
    corrected_attendance := previous_attendance;
  end if;

  update public.attendance_correction_requests
  set
    status = decision::public.request_status,
    request_version = request_version + 1,
    effective_values = case
      when decision = 'approved' then jsonb_build_object(
        'clock_in_at',
        corrected_attendance.clock_in_at,
        'clock_out_at',
        corrected_attendance.clock_out_at,
        'worked_duration_min',
        corrected_attendance.worked_duration_min
      )
      else previous_correction.before_values
    end,
    decided_by = (select auth.uid()),
    decision_note = nullif(trim(note), ''),
    resolved_at = now()
  where id = correction_id
    and status = 'pending'
    and request_version = expected_version
  returning * into decided_correction;

  if not found then
    raise exception 'Attendance correction request has already been decided';
  end if;

  insert into public.approval_events (
    subject_type,
    subject_id,
    actor_id,
    action,
    note,
    subject_version
  )
  values (
    'attendance_correction_request',
    correction_id,
    (select auth.uid()),
    decision,
    nullif(trim(note), ''),
    decided_correction.request_version
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
    'attendance_correction_request',
    correction_id,
    to_jsonb(previous_correction),
    to_jsonb(decided_correction),
    nullif(trim(note), '')
  );

  return decided_correction;
end;
$$;

create or replace function public.validate_attendance(
  attendance_id uuid,
  decision text,
  note text,
  expected_version integer
)
returns public.attendance_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_attendance public.attendance_records%rowtype;
  validated_attendance public.attendance_records%rowtype;
begin
  if not public.is_supervisor() then
    raise exception 'Only supervisors can validate attendance';
  end if;

  if decision is null
    or decision not in ('approved', 'rejected', 'needs_correction') then
    raise exception 'Invalid attendance decision';
  end if;

  select *
  into previous_attendance
  from public.attendance_records
  where id = attendance_id
  for update;

  if not found then
    raise exception 'Attendance record not found';
  end if;

  if previous_attendance.clock_out_at is null then
    raise exception 'Attendance must be clocked out before validation';
  end if;

  if previous_attendance.validation_status <> 'pending'
    or previous_attendance.record_version <> expected_version then
    raise exception 'Attendance record has already changed';
  end if;

  if previous_attendance.employee_id = public.current_employee_id() then
    raise exception 'Self-validation is not allowed';
  end if;

  update public.attendance_records
  set
    validation_status = decision::public.validation_status,
    record_version = record_version + 1
  where id = attendance_id
    and validation_status = 'pending'
    and record_version = expected_version
  returning * into validated_attendance;

  if not found then
    raise exception 'Attendance has already been validated';
  end if;

  insert into public.attendance_validations (
    attendance_record_id,
    decided_by,
    decision,
    decision_note,
    record_version
  )
  values (
    attendance_id,
    (select auth.uid()),
    decision,
    nullif(trim(note), ''),
    validated_attendance.record_version
  );

  if decision in ('approved', 'rejected') then
    insert into public.file_deletion_jobs (
      evidence_id,
      storage_bucket,
      storage_path,
      deletion_reason,
      scheduled_for
    )
    select
      evidence.id,
      evidence.storage_bucket,
      evidence.storage_path,
      case
        when decision = 'approved' then 'attendance_approved'
        else 'attendance_rejected_retention_limit'
      end,
      case
        when decision = 'approved' then now()
        else now() + interval '30 days'
      end
    from public.attendance_evidence evidence
    where evidence.attendance_record_id = attendance_id
      and evidence.deleted_at is null
    on conflict (storage_bucket, storage_path, deletion_reason)
    do nothing;

    update public.attendance_evidence
    set retention_status = 'scheduled_for_deletion'
    where attendance_record_id = attendance_id
      and deleted_at is null;
  end if;

  insert into public.approval_events (
    subject_type,
    subject_id,
    actor_id,
    action,
    note,
    subject_version
  )
  values (
    'attendance_record',
    attendance_id,
    (select auth.uid()),
    decision,
    nullif(trim(note), ''),
    validated_attendance.record_version
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
    'validate',
    'attendance_record',
    attendance_id,
    to_jsonb(previous_attendance),
    to_jsonb(validated_attendance),
    nullif(trim(note), '')
  );

  return validated_attendance;
end;
$$;

revoke all on function public.decide_leave_request(uuid, text, text, integer)
  from public;
revoke all on function public.decide_overtime_request(uuid, text, integer, text, integer)
  from public;
revoke all on function public.decide_attendance_correction(uuid, text, text, integer)
  from public;
revoke all on function public.validate_attendance(uuid, text, text, integer)
  from public;

grant execute on function public.decide_leave_request(uuid, text, text, integer)
  to authenticated;
grant execute on function public.decide_overtime_request(uuid, text, integer, text, integer)
  to authenticated;
grant execute on function public.decide_attendance_correction(uuid, text, text, integer)
  to authenticated;
grant execute on function public.validate_attendance(uuid, text, text, integer)
  to authenticated;

create view public.v_employee_public_schedule
with (security_barrier = true)
as
select
  employee.full_name as employee_name,
  outlet.name as outlet_name,
  assignment.work_date,
  coalesce(template.shift_type::text, 'off') as shift_type,
  assignment.planned_start,
  assignment.planned_end,
  assignment.status::text as schedule_status,
  assignment.assignment_type
from public.schedule_assignments assignment
join public.roster_versions version
  on version.id = assignment.roster_version_id
join public.roster_periods period
  on period.active_version_id = version.id
join public.employees employee
  on employee.id = assignment.employee_id
join public.outlets outlet
  on outlet.id = assignment.outlet_id
left join public.outlet_shift_templates template
  on template.id = assignment.shift_template_id
where version.status = 'published'
  and employee.archived_at is null;

revoke all on public.v_employee_public_schedule from anon;
revoke all on public.v_employee_public_schedule from public;
grant select on public.v_employee_public_schedule to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'attendance-selfies',
    'attendance-selfies',
    false,
    5242880,
    array['image/jpeg', 'image/webp']
  ),
  (
    'leave-documents',
    'leave-documents',
    false,
    10485760,
    array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]
  ),
  (
    'imports',
    'imports',
    false,
    10485760,
    array[
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  ),
  (
    'exports',
    'exports',
    false,
    20971520,
    array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy attendance_selfies_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'attendance-selfies'
  and (storage.foldername(name))[1] =
    (select public.current_employee_id())::text
);

create policy attendance_selfies_read_authorized
on storage.objects
for select
to authenticated
using (
  bucket_id = 'attendance-selfies'
  and (
    (storage.foldername(name))[1] =
      (select public.current_employee_id())::text
    or (select public.is_supervisor())
  )
);

create policy leave_documents_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'leave-documents'
  and (storage.foldername(name))[1] =
    (select public.current_employee_id())::text
);

create policy leave_documents_read_authorized
on storage.objects
for select
to authenticated
using (
  bucket_id = 'leave-documents'
  and (
    (storage.foldername(name))[1] =
      (select public.current_employee_id())::text
    or (select public.is_supervisor())
  )
);

create policy imports_manage_supervisor
on storage.objects
for all
to authenticated
using (
  bucket_id = 'imports'
  and (select public.is_supervisor())
)
with check (
  bucket_id = 'imports'
  and (select public.is_supervisor())
);

create policy exports_read_operations
on storage.objects
for select
to authenticated
using (
  bucket_id = 'exports'
  and (select public.can_view_sensitive_operations())
);

create policy exports_manage_supervisor
on storage.objects
for all
to authenticated
using (
  bucket_id = 'exports'
  and (select public.is_supervisor())
)
with check (
  bucket_id = 'exports'
  and (select public.is_supervisor())
);
