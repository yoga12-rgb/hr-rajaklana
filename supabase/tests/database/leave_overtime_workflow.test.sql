begin;

set local search_path = extensions, public, pg_catalog;

select extensions.plan(112);

select extensions.ok(
  not has_function_privilege('anon', 'public.get_leave_workspace()', 'execute'),
  'anonymous cannot read the leave workspace'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.save_leave_type(uuid,text,text,boolean,integer,boolean,boolean,integer,boolean,text)',
    'execute'
  ),
  'anonymous cannot manage leave types'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.submit_leave_request(uuid,uuid,date,date,text,jsonb)',
    'execute'
  ),
  'anonymous cannot submit leave'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.cancel_leave_request(uuid,integer,text)',
    'execute'
  ),
  'anonymous cannot cancel leave'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.decide_leave_request(uuid,text,text,integer)',
    'execute'
  ),
  'anonymous cannot decide leave'
);
select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.sync_approved_leave_to_roster(uuid)',
    'execute'
  ),
  'authenticated clients cannot invoke leave-roster synchronization directly'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.amend_pending_leave_request(uuid,integer,date,date,text)',
    'execute'
  ),
  'anonymous cannot amend pending leave'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.submit_leave_change_request(uuid,integer,text,date,date,text)',
    'execute'
  ),
  'anonymous cannot request an approved leave change'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.cancel_leave_change_request(uuid,integer,text)',
    'execute'
  ),
  'anonymous cannot cancel a leave change request'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.decide_leave_change_request(uuid,integer,text,text)',
    'execute'
  ),
  'anonymous cannot decide a leave change request'
);
select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.reconcile_changed_leave_roster(uuid,date,date,date,date)',
    'execute'
  ),
  'authenticated clients cannot invoke leave roster reconciliation directly'
);
select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_constraint constraint_row
    where constraint_row.conrelid = 'public.leave_requests'::regclass
      and constraint_row.conname = 'leave_requests_no_active_overlap'
      and constraint_row.contype = 'x'
  ),
  'database exclusion constraint closes concurrent active leave overlap races'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.get_overtime_workspace()',
    'execute'
  ),
  'anonymous cannot read the overtime workspace'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.submit_overtime_request(date,time without time zone,time without time zone,text)',
    'execute'
  ),
  'anonymous cannot submit overtime'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.assign_overtime_request(uuid,date,time without time zone,time without time zone,text)',
    'execute'
  ),
  'anonymous cannot assign overtime'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.cancel_overtime_request(uuid,integer,text)',
    'execute'
  ),
  'anonymous cannot cancel overtime'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.refresh_overtime_actual(uuid)',
    'execute'
  ),
  'anonymous cannot refresh overtime actual duration'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.decide_overtime_request(uuid,text,integer,text,integer)',
    'execute'
  ),
  'anonymous cannot decide overtime'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.leave_types', 'insert'),
  'authenticated clients cannot insert leave types directly'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.leave_entitlements', 'update'),
  'authenticated clients cannot update leave balances directly'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.leave_requests', 'insert'),
  'authenticated clients cannot insert leave requests directly'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.request_attachments', 'insert'),
  'authenticated clients cannot insert leave attachment metadata directly'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.overtime_requests', 'insert'),
  'authenticated clients cannot insert overtime directly'
);

select has_table_privilege(
  current_user,
  'public.employees',
  'insert'
) as can_seed_workforce_fixtures
\gset

\if :can_seed_workforce_fixtures

create function pg_temp.workspace_leave_change_id(
  p_leave_request_id uuid,
  p_status text default null
)
returns uuid
language sql
stable
as $$
  select (change_request->>'id')::uuid
  from jsonb_array_elements(
    public.get_leave_workspace()->'change_requests'
  ) change_request
  where change_request->>'leave_request_id' = p_leave_request_id::text
    and (
      p_status is null
      or change_request->>'status' = p_status
    )
  order by change_request->>'created_at' desc
  limit 1
$$;

insert into public.employees (
  id,
  nik,
  full_name,
  joined_at,
  employment_status_id,
  job_position_id
)
values
  (
    '71000000-0000-0000-0000-000000000001',
    'RK-2098-001',
    'Leave Employee',
    current_date - 365,
    (select id from public.employment_statuses where code = 'permanent'),
    (select id from public.job_positions where code = 'cashier')
  ),
  (
    '71000000-0000-0000-0000-000000000002',
    'RK-2098-002',
    'Leave Colleague',
    current_date - 365,
    (select id from public.employment_statuses where code = 'permanent'),
    (select id from public.job_positions where code = 'cashier')
  ),
  (
    '71000000-0000-0000-0000-000000000003',
    'RK-2098-003',
    'Leave Supervisor',
    current_date - 365,
    (select id from public.employment_statuses where code = 'permanent'),
    (
      select id
      from public.job_positions
      where code = 'sales_hr_supervisor'
    )
  ),
  (
    '71000000-0000-0000-0000-000000000004',
    'RK-2098-004',
    'Leave Management',
    current_date - 365,
    (select id from public.employment_statuses where code = 'permanent'),
    (select id from public.job_positions where code = 'management')
  );

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '72000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'leave-employee@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '72000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'leave-colleague@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '72000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'leave-supervisor@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '72000000-0000-0000-0000-000000000004',
    'authenticated',
    'authenticated',
    'leave-management@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.user_accounts (
  user_id,
  employee_id,
  access_role,
  account_status,
  must_change_password
)
values
  (
    '72000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001',
    'employee',
    'active',
    false
  ),
  (
    '72000000-0000-0000-0000-000000000002',
    '71000000-0000-0000-0000-000000000002',
    'employee',
    'active',
    false
  ),
  (
    '72000000-0000-0000-0000-000000000003',
    '71000000-0000-0000-0000-000000000003',
    'supervisor',
    'active',
    false
  ),
  (
    '72000000-0000-0000-0000-000000000004',
    '71000000-0000-0000-0000-000000000004',
    'management',
    'active',
    false
  );

select extensions.is(
  (
    select granted_days
    from public.leave_entitlements
    where employee_id = '71000000-0000-0000-0000-000000000001'
      and year = extract(year from current_date)::integer
  ),
  12::numeric,
  'new employees automatically receive the annual entitlement'
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000004',
  true
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.submit_leave_request(
    '73000000-0000-0000-0000-000000000099',
    (select id from public.leave_types where code = 'annual'),
    current_date + 10,
    current_date + 11,
    'Management cannot submit',
    null
  )$$,
  '42501',
  'Pengguna tidak dapat membuat pengajuan cuti.',
  'management cannot submit leave'
);

select extensions.throws_ok(
  $$select public.cancel_leave_request(
    '73000000-0000-0000-0000-000000000099',
    1,
    'Management cancellation'
  )$$,
  '42501',
  'Pengguna tidak dapat membatalkan pengajuan cuti.',
  'management cannot cancel a pending leave'
);

select extensions.throws_ok(
  $$select public.cancel_leave_change_request(
    '73000000-0000-0000-0000-000000000099',
    1,
    'Management cancellation'
  )$$,
  '42501',
  'Pengguna tidak dapat membatalkan permintaan perubahan cuti.',
  'management cannot cancel an approved leave change request'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000099',
  true
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.cancel_leave_change_request(
    '73000000-0000-0000-0000-000000000099',
    1,
    'Missing profile cancellation'
  )$$,
  '42501',
  'Pengguna tidak dapat membatalkan permintaan perubahan cuti.',
  'authenticated claim without an employee profile cannot cancel a leave change'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select extensions.is(
  public.get_leave_workspace()->>'role',
  'employee',
  'leave workspace exposes the authenticated role'
);

select extensions.lives_ok(
  $$select public.submit_leave_request(
    '73000000-0000-0000-0000-000000000001',
    (select id from public.leave_types where code = 'annual'),
    current_date + 10,
    current_date + 11,
    'Annual leave to cancel',
    null
  )$$,
  'employee can submit annual leave'
);

reset role;
select extensions.is(
  (
    select status::text
    from public.leave_requests
    where id = '73000000-0000-0000-0000-000000000001'
  ),
  'pending',
  'new leave request is pending'
);
select extensions.is(
  (
    select reserved_days
    from public.leave_entitlements
    where employee_id = '71000000-0000-0000-0000-000000000001'
      and leave_type_id = (
        select id from public.leave_types where code = 'annual'
      )
      and year = extract(year from current_date)::integer
  ),
  2::numeric,
  'annual leave submission reserves balance'
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.submit_leave_request(
    '73000000-0000-0000-0000-000000000002',
    (select id from public.leave_types where code = 'annual'),
    current_date + 11,
    current_date + 12,
    'Overlapping annual leave',
    null
  )$$,
  '23P01',
  'Rentang tanggal berbenturan dengan pengajuan aktif lain.',
  'overlapping leave is rejected'
);

select extensions.lives_ok(
  $$select public.cancel_leave_request(
    '73000000-0000-0000-0000-000000000001',
    1,
    'Rencana berubah'
  )$$,
  'employee can cancel own pending leave'
);

reset role;
select extensions.is(
  (
    select reserved_days
    from public.leave_entitlements
    where employee_id = '71000000-0000-0000-0000-000000000001'
      and leave_type_id = (
        select id from public.leave_types where code = 'annual'
      )
      and year = extract(year from current_date)::integer
  ),
  0::numeric,
  'leave cancellation releases reserved balance'
);
select extensions.is(
  (
    select status::text
    from public.leave_requests
    where id = '73000000-0000-0000-0000-000000000001'
  ),
  'cancelled',
  'cancelled leave is final'
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.submit_leave_request(
    '73000000-0000-0000-0000-000000000003',
    (select id from public.leave_types where code = 'sick'),
    current_date,
    current_date + 1,
    'Sick without document',
    null
  )$$,
  '23514',
  'Dokumen pendukung wajib dilampirkan untuk pengajuan ini.',
  'multi-day sick leave requires a document'
);

select extensions.lives_ok(
  $$select public.submit_leave_request(
    '73000000-0000-0000-0000-000000000004',
    (select id from public.leave_types where code = 'annual'),
    current_date + 20,
    current_date + 22,
    'Annual leave approval',
    null
  )$$,
  'employee can submit leave for approval'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000004',
  true
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.decide_leave_request(
    '73000000-0000-0000-0000-000000000004',
    'approved',
    'Management decision',
    1
  )$$,
  '42501',
  'Hanya supervisor yang dapat memutuskan pengajuan cuti.',
  'management cannot decide leave'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.lives_ok(
  $$select public.submit_leave_request(
    '73000000-0000-0000-0000-000000000005',
    (select id from public.leave_types where code = 'annual'),
    current_date + 40,
    current_date + 40,
    'Supervisor own leave',
    null
  )$$,
  'supervisor can submit own leave'
);

select extensions.throws_ok(
  $$select public.decide_leave_request(
    '73000000-0000-0000-0000-000000000005',
    'approved',
    'Own decision',
    1
  )$$,
  '42501',
  'Supervisor tidak dapat memutuskan pengajuan sendiri.',
  'supervisor cannot decide own leave'
);

select extensions.lives_ok(
  $$select public.decide_leave_request(
    '73000000-0000-0000-0000-000000000004',
    'approved',
    'Saldo dan jadwal valid',
    1
  )$$,
  'supervisor can approve another employee leave'
);

reset role;
select extensions.is(
  (
    select status::text
    from public.leave_requests
    where id = '73000000-0000-0000-0000-000000000004'
  ),
  'approved',
  'approved leave status is stored'
);
select extensions.is(
  (
    select used_days::text || ':' || reserved_days::text
    from public.leave_entitlements
    where employee_id = '71000000-0000-0000-0000-000000000001'
      and leave_type_id = (
        select id from public.leave_types where code = 'annual'
      )
      and year = extract(year from current_date)::integer
  ),
  '3.00:0.00',
  'approval moves reserved annual leave into used balance'
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.decide_leave_request(
    '73000000-0000-0000-0000-000000000004',
    'rejected',
    'Late second decision',
    1
  )$$,
  '40001',
  'Pengajuan cuti sudah diputuskan atau berubah.',
  'first leave decision wins'
);

reset role;
select extensions.ok(
  exists (
    select 1
    from public.notifications
    where employee_id = '71000000-0000-0000-0000-000000000001'
      and subject_id = '73000000-0000-0000-0000-000000000004'
      and notification_type = 'leave_request_decided'
  ),
  'leave decision creates an employee notification'
);

insert into public.outlets (
  id,
  code,
  name,
  address,
  latitude,
  longitude,
  geofence_radius_m
)
values (
  '74000000-0000-0000-0000-000000000001',
  'LEAVE-ROSTER',
  'Leave Roster Outlet',
  'Test address',
  -7.500000,
  112.200000,
  100
);

insert into public.employee_placements (
  id,
  employee_id,
  outlet_id,
  start_date,
  is_primary,
  change_reason
)
values (
  '74000000-0000-0000-0000-000000000002',
  '71000000-0000-0000-0000-000000000001',
  '74000000-0000-0000-0000-000000000001',
  current_date - 365,
  true,
  'Leave roster fixture'
);

insert into public.outlet_shift_templates (
  id,
  outlet_id,
  shift_type,
  starts_at,
  ends_at,
  is_active
)
values (
  '74000000-0000-0000-0000-000000000003',
  '74000000-0000-0000-0000-000000000001',
  'night',
  '14:00',
  '22:00',
  true
);

insert into public.roster_periods (
  id,
  month_start,
  status,
  publish_deadline
)
values (
  '74000000-0000-0000-0000-000000000004',
  date_trunc('month', current_date + interval '2 months')::date,
  'preparing',
  date_trunc('month', current_date + interval '2 months')::date - 7
);

insert into public.roster_versions (
  id,
  roster_period_id,
  version_number,
  status,
  created_by
)
values (
  '74000000-0000-0000-0000-000000000005',
  '74000000-0000-0000-0000-000000000004',
  1,
  'draft',
  '72000000-0000-0000-0000-000000000003'
);

insert into public.schedule_assignments (
  id,
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
  '74000000-0000-0000-0000-000000000006',
  '74000000-0000-0000-0000-000000000005',
  '71000000-0000-0000-0000-000000000001',
  '74000000-0000-0000-0000-000000000001',
  '74000000-0000-0000-0000-000000000003',
  date_trunc('month', current_date + interval '2 months')::date + 10,
  'primary',
  '14:00',
  '22:00',
  480,
  'scheduled'
);

update public.roster_versions
set
  status = 'published',
  published_at = now(),
  published_by = '72000000-0000-0000-0000-000000000003'
where id = '74000000-0000-0000-0000-000000000005';

update public.roster_periods
set
  status = 'published',
  active_version_id = '74000000-0000-0000-0000-000000000005'
where id = '74000000-0000-0000-0000-000000000004';

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select extensions.lives_ok(
  $$select public.submit_leave_request(
    '74000000-0000-0000-0000-000000000007',
    (select id from public.leave_types where code = 'sick'),
    date_trunc('month', current_date + interval '2 months')::date + 10,
    date_trunc('month', current_date + interval '2 months')::date + 10,
    'Cuti dengan dampak roster',
    null
  )$$,
  'employee can submit leave that overlaps a published roster'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.lives_ok(
  $$select public.decide_leave_request(
    '74000000-0000-0000-0000-000000000007',
    'approved',
    'Disetujui dan membutuhkan backup',
    1
  )$$,
  'leave approval synchronizes the affected roster atomically'
);

reset role;
select extensions.is(
  (
    select assignment.status::text
    from public.schedule_assignments assignment
    where assignment.id = '74000000-0000-0000-0000-000000000006'
  ),
  'scheduled',
  'published roster assignment remains immutable'
);
select extensions.is(
  (
    select assignment.status::text
    from public.schedule_assignments assignment
    join public.roster_versions version
      on version.id = assignment.roster_version_id
    where version.roster_period_id = '74000000-0000-0000-0000-000000000004'
      and version.status = 'draft'
      and assignment.employee_id = '71000000-0000-0000-0000-000000000001'
      and assignment.work_date =
        date_trunc('month', current_date + interval '2 months')::date + 10
  ),
  'leave',
  'editable roster draft is automatically marked as leave'
);
select extensions.ok(
  exists (
    select 1
    from public.notifications notification
    where notification.notification_type = 'roster_backup_required'
      and notification.subject_id = '74000000-0000-0000-0000-000000000007'
      and notification.payload->>'action' = 'assign_backup'
      and notification.payload->>'outlet_id' =
        '74000000-0000-0000-0000-000000000001'
      and notification.payload->>'shift_type' = 'night'
  ),
  'leave approval creates an actionable backup notification'
);

insert into public.employees (
  id,
  nik,
  full_name,
  joined_at,
  employment_status_id,
  job_position_id
)
values (
  '71000000-0000-0000-0000-000000000005',
  'RK-2098-005',
  'Leave Backup Fixture',
  current_date - 365,
  (select id from public.employment_statuses where code = 'permanent'),
  (select id from public.job_positions where code = 'cashier')
);

insert into public.employee_placements (
  employee_id,
  outlet_id,
  start_date,
  is_primary,
  change_reason
)
values
  (
    '71000000-0000-0000-0000-000000000002',
    '74000000-0000-0000-0000-000000000001',
    current_date - 365,
    true,
    'Backup alert threshold fixture'
  ),
  (
    '71000000-0000-0000-0000-000000000005',
    '74000000-0000-0000-0000-000000000001',
    current_date - 365,
    true,
    'Backup alert threshold fixture'
  );

insert into public.schedule_assignments (
  roster_version_id,
  employee_id,
  outlet_id,
  shift_template_id,
  work_date,
  planned_start,
  planned_end,
  planned_duration_min,
  status
)
select
  version.id,
  employee_id,
  '74000000-0000-0000-0000-000000000001',
  '74000000-0000-0000-0000-000000000003',
  date_trunc('month', current_date + interval '2 months')::date + 10,
  '14:00',
  '22:00',
  480,
  'scheduled'
from public.roster_versions version
cross join (
  values
    ('71000000-0000-0000-0000-000000000002'::uuid),
    ('71000000-0000-0000-0000-000000000005'::uuid)
) employee(employee_id)
where version.roster_period_id = '74000000-0000-0000-0000-000000000004'
  and version.status = 'draft';

select public.workforce_notify_supervisors(
  'roster_backup_required',
  'Backup tidak diperlukan',
  'Dua kasir masih tersedia.',
  'roster_backup_need',
  '74000000-0000-0000-0000-000000000008',
  jsonb_build_object(
    'roster_version_id', (
      select version.id
      from public.roster_versions version
      where version.roster_period_id =
        '74000000-0000-0000-0000-000000000004'
        and version.status = 'draft'
    ),
    'outlet_id', '74000000-0000-0000-0000-000000000001',
    'work_date',
      date_trunc('month', current_date + interval '2 months')::date + 10
  )
);

select extensions.ok(
  not exists (
    select 1
    from public.notifications notification
    where notification.subject_id = '74000000-0000-0000-0000-000000000008'
  ),
  'backup notification is suppressed when two cashiers remain available'
);
select extensions.ok(
  exists (
    select 1
    from public.audit_logs audit
    where audit.action = 'sync_approved_leave_to_roster'
      and audit.entity_id = '74000000-0000-0000-0000-000000000007'
      and (audit.after_values->>'affected_schedule_count')::integer = 1
  ),
  'leave-roster synchronization is audited'
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select extensions.lives_ok(
  $$select public.submit_leave_change_request(
    '74000000-0000-0000-0000-000000000007',
    2,
    'reschedule',
    date_trunc('month', current_date + interval '2 months')::date + 11,
    date_trunc('month', current_date + interval '2 months')::date + 11,
    'Tanggal operasional berubah'
  )$$,
  'employee can request a future approved leave reschedule'
);

select extensions.is(
  (
    select concat_ws(
      ':',
      change_request->>'change_type',
      change_request->>'status',
      change_request->>'proposed_days',
      change_request->>'source_leave_version'
    )
    from jsonb_array_elements(
      public.get_leave_workspace()->'change_requests'
    ) change_request
    where change_request->>'leave_request_id' =
      '74000000-0000-0000-0000-000000000007'
      and change_request->>'status' = 'pending'
  ),
  'reschedule:pending:1.00:2',
  'approved leave change stores an immutable source snapshot'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000004',
  true
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.decide_leave_change_request(
    pg_temp.workspace_leave_change_id(
      '74000000-0000-0000-0000-000000000007',
      'pending'
    ),
    1,
    'approved',
    'Management decision'
  )$$,
  '42501',
  'Hanya supervisor yang dapat memutuskan perubahan cuti.',
  'management cannot decide an approved leave change'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.lives_ok(
  $$select public.decide_leave_change_request(
    pg_temp.workspace_leave_change_id(
      '74000000-0000-0000-0000-000000000007',
      'pending'
    ),
    1,
    'approved',
    'Roster lama dipulihkan dan tanggal baru diterapkan'
  )$$,
  'another supervisor can approve a future leave reschedule'
);

reset role;
select extensions.is(
  (
    select concat_ws(
      ':',
      request.status,
      request.request_version,
      request.starts_on,
      request.ends_on
    )
    from public.leave_requests request
    where request.id = '74000000-0000-0000-0000-000000000007'
  ),
  concat_ws(
    ':',
    'approved',
    '3',
    date_trunc('month', current_date + interval '2 months')::date + 11,
    date_trunc('month', current_date + interval '2 months')::date + 11
  ),
  'approved leave keeps its identity and advances to the replacement dates'
);

select extensions.is(
  (
    select assignment.status::text
    from public.schedule_assignments assignment
    where assignment.id = '74000000-0000-0000-0000-000000000006'
  ),
  'scheduled',
  'published assignment stays immutable after approved leave reschedule'
);

select extensions.is(
  (
    select string_agg(
      assignment.work_date::text || ':' || assignment.status::text,
      ','
      order by assignment.work_date
    )
    from public.schedule_assignments assignment
    join public.roster_versions version
      on version.id = assignment.roster_version_id
    where version.roster_period_id =
      '74000000-0000-0000-0000-000000000004'
      and version.status = 'draft'
      and assignment.employee_id =
        '71000000-0000-0000-0000-000000000001'
      and assignment.work_date in (
        date_trunc('month', current_date + interval '2 months')::date + 10,
        date_trunc('month', current_date + interval '2 months')::date + 11
      )
  ),
  concat_ws(
    ',',
    (
      date_trunc('month', current_date + interval '2 months')::date + 10
    )::text || ':scheduled',
    (
      date_trunc('month', current_date + interval '2 months')::date + 11
    )::text || ':leave'
  ),
  'draft restores the old shift and marks the replacement date as leave'
);

select extensions.is(
  (
    select string_agg(
      impact.work_date::text || ':' || impact.state,
      ','
      order by impact.work_date
    )
    from public.leave_roster_impacts impact
    where impact.leave_request_id =
      '74000000-0000-0000-0000-000000000007'
      and impact.work_date in (
        date_trunc('month', current_date + interval '2 months')::date + 10,
        date_trunc('month', current_date + interval '2 months')::date + 11
      )
  ),
  concat_ws(
    ',',
    (
      date_trunc('month', current_date + interval '2 months')::date + 10
    )::text || ':reverted',
    (
      date_trunc('month', current_date + interval '2 months')::date + 11
    )::text || ':applied'
  ),
  'roster provenance records reverted and newly applied leave dates'
);

select extensions.ok(
  exists (
    select 1
    from public.notifications notification
    join public.leave_change_requests change_request
      on change_request.leave_request_id = notification.subject_id
      and change_request.id::text =
        notification.payload->>'change_request_id'
    where notification.notification_type = 'roster_backup_required'
      and notification.subject_id =
        '74000000-0000-0000-0000-000000000007'
      and notification.payload->>'work_date' = (
        date_trunc('month', current_date + interval '2 months')::date + 10
      )::text
      and notification.payload->>'superseded' = 'true'
      and notification.title = 'Kebutuhan backup perlu ditinjau ulang'
      and change_request.status = 'approved'
  ),
  'approved reschedule preserves and supersedes the old actionable backup alert'
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.decide_leave_change_request(
    pg_temp.workspace_leave_change_id(
      '74000000-0000-0000-0000-000000000007'
    ),
    1,
    'rejected',
    'Keputusan kedua terlambat'
  )$$,
  '40001',
  'Permintaan perubahan sudah diputuskan atau berubah.',
  'first approved leave change decision wins'
);

reset role;
select extensions.ok(
  exists (
    select 1
    from public.notifications notification
    where notification.employee_id =
      '71000000-0000-0000-0000-000000000001'
      and notification.notification_type = 'leave_change_decided'
      and notification.subject_type = 'leave_change_request'
  ),
  'leave change decision creates an employee notification'
);

update public.leave_types
set is_active = false
where code = 'sick';

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select extensions.lives_ok(
  $$select public.submit_leave_change_request(
    '74000000-0000-0000-0000-000000000007',
    3,
    'cancel',
    null,
    null,
    'Membatalkan cuti lama'
  )$$,
  'future approved leave can still request cancellation after its type is inactive'
);

select extensions.lives_ok(
  $$select public.cancel_leave_change_request(
    pg_temp.workspace_leave_change_id(
      '74000000-0000-0000-0000-000000000007',
      'pending'
    ),
    1,
    'Pembatalan tidak jadi'
  )$$,
  'owner can withdraw the inactive-type cancellation request'
);

reset role;
update public.leave_types
set is_active = true
where code = 'sick';

insert into public.roster_periods (
  id,
  month_start,
  status,
  publish_deadline
)
values (
  '74000000-0000-0000-0000-000000000099',
  date_trunc('month', current_date + interval '3 months')::date,
  'closed',
  date_trunc('month', current_date + interval '3 months')::date - 7
);

insert into public.leave_change_requests (
  id,
  leave_request_id,
  employee_id,
  leave_type_id,
  change_type,
  source_leave_version,
  old_starts_on,
  old_ends_on,
  old_requested_days,
  proposed_starts_on,
  proposed_ends_on,
  proposed_days,
  reason
)
values (
  '74000000-0000-0000-0000-000000000098',
  '74000000-0000-0000-0000-000000000007',
  '71000000-0000-0000-0000-000000000001',
  (select id from public.leave_types where code = 'sick'),
  'reschedule',
  3,
  date_trunc('month', current_date + interval '2 months')::date + 11,
  date_trunc('month', current_date + interval '2 months')::date + 11,
  1,
  date_trunc('month', current_date + interval '3 months')::date + 10,
  date_trunc('month', current_date + interval '3 months')::date + 10,
  1,
  'Closed roster decision fixture'
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.decide_leave_change_request(
    '74000000-0000-0000-0000-000000000098',
    1,
    'approved',
    'Mencoba periode tertutup'
  )$$,
  '23514',
  'Tanggal cuti pengganti berada pada periode roster yang sudah ditutup.',
  'approved reschedule cannot silently skip a closed replacement roster period'
);

reset role;
delete from public.leave_change_requests
where id = '74000000-0000-0000-0000-000000000098';
delete from public.roster_periods
where id = '74000000-0000-0000-0000-000000000099';

update public.leave_entitlements
set
  used_days = 1,
  reserved_days = 1
where employee_id = '71000000-0000-0000-0000-000000000002'
  and leave_type_id = (select id from public.leave_types where code = 'annual')
  and year = extract(year from current_date)::integer;

insert into public.leave_requests (
  id,
  employee_id,
  leave_type_id,
  starts_on,
  ends_on,
  requested_days,
  reason,
  status,
  decided_by,
  decided_at
)
values (
  '74000000-0000-0000-0000-000000000096',
  '71000000-0000-0000-0000-000000000002',
  (select id from public.leave_types where code = 'annual'),
  current_date,
  current_date,
  1,
  'Stale approved leave fixture',
  'approved',
  '72000000-0000-0000-0000-000000000003',
  now()
);

insert into public.leave_change_requests (
  id,
  leave_request_id,
  employee_id,
  leave_type_id,
  change_type,
  source_leave_version,
  old_starts_on,
  old_ends_on,
  old_requested_days,
  proposed_starts_on,
  proposed_ends_on,
  proposed_days,
  reason,
  reserved_delta_days,
  reserved_year
)
values (
  '74000000-0000-0000-0000-000000000095',
  '74000000-0000-0000-0000-000000000096',
  '71000000-0000-0000-0000-000000000002',
  (select id from public.leave_types where code = 'annual'),
  'reschedule',
  1,
  current_date,
  current_date,
  1,
  current_date + 1,
  current_date + 2,
  2,
  'Stale change reservation fixture',
  1,
  extract(year from current_date)::integer
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.lives_ok(
  $$select public.decide_leave_change_request(
    '74000000-0000-0000-0000-000000000095',
    1,
    'rejected',
    'Tanggal perubahan sudah lewat'
  )$$,
  'supervisor can reject a stale leave change to release its reservation'
);

reset role;
select extensions.is(
  (
    select concat_ws(
      ':',
      entitlement.used_days,
      entitlement.reserved_days,
      change_request.status
    )
    from public.leave_entitlements entitlement
    join public.leave_change_requests change_request
      on change_request.employee_id = entitlement.employee_id
      and change_request.leave_type_id = entitlement.leave_type_id
    where change_request.id =
      '74000000-0000-0000-0000-000000000095'
      and entitlement.year = extract(year from current_date)::integer
  ),
  '1.00:0.00:rejected',
  'stale rejection releases delta reservation without altering used balance'
);

insert into public.outlets (
  id,
  code,
  name,
  address,
  latitude,
  longitude,
  geofence_radius_m
)
values (
  '74000000-0000-0000-0000-000000000097',
  'LEAVE-MANUAL',
  'Leave Manual Edit Outlet',
  'Manual provenance fixture',
  -7.510000,
  112.210000,
  100
);

update public.schedule_assignments assignment
set outlet_id = '74000000-0000-0000-0000-000000000097'
from public.roster_versions version
where version.id = assignment.roster_version_id
  and version.roster_period_id =
    '74000000-0000-0000-0000-000000000004'
  and version.status = 'draft'
  and assignment.employee_id =
    '71000000-0000-0000-0000-000000000001'
  and assignment.work_date =
    date_trunc('month', current_date + interval '2 months')::date + 11
  and assignment.status = 'leave';

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select extensions.lives_ok(
  $$select public.submit_leave_change_request(
    '74000000-0000-0000-0000-000000000007',
    3,
    'cancel',
    null,
    null,
    'Membatalkan setelah koreksi manual roster'
  )$$,
  'employee can request cancellation after a manual draft edit'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.lives_ok(
  $$select public.decide_leave_change_request(
    pg_temp.workspace_leave_change_id(
      '74000000-0000-0000-0000-000000000007',
      'pending'
    ),
    1,
    'approved',
    'Jadwal manual harus dipertahankan untuk review'
  )$$,
  'supervisor can approve cancellation without overwriting a manual draft edit'
);

reset role;
select extensions.is(
  (
    select concat_ws(
      ':',
      outlet.code,
      assignment.status,
      impact.state
    )
    from public.schedule_assignments assignment
    join public.roster_versions version
      on version.id = assignment.roster_version_id
    join public.outlets outlet on outlet.id = assignment.outlet_id
    join public.leave_roster_impacts impact
      on impact.leave_request_id =
        '74000000-0000-0000-0000-000000000007'
      and impact.roster_period_id = version.roster_period_id
      and impact.work_date = assignment.work_date
    where version.status = 'draft'
      and assignment.employee_id =
        '71000000-0000-0000-0000-000000000001'
      and assignment.work_date =
        date_trunc('month', current_date + interval '2 months')::date + 11
  ),
  'LEAVE-MANUAL:leave:review_required',
  'semantic provenance mismatch preserves manual assignment and requires review'
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select extensions.lives_ok(
  $$select public.submit_leave_request(
    '73000000-0000-0000-0000-000000000006',
    (select id from public.leave_types where code = 'annual'),
    current_date + 30,
    current_date + 30,
    'Annual leave rejection',
    null
  )$$,
  'employee can submit another non-overlapping leave'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.lives_ok(
  $$select public.decide_leave_request(
    '73000000-0000-0000-0000-000000000006',
    'rejected',
    'Kebutuhan operasional',
    1
  )$$,
  'supervisor can reject leave with a note'
);

reset role;
select extensions.is(
  (
    select used_days::text || ':' || reserved_days::text
    from public.leave_entitlements
    where employee_id = '71000000-0000-0000-0000-000000000001'
      and leave_type_id = (
        select id from public.leave_types where code = 'annual'
      )
      and year = extract(year from current_date)::integer
  ),
  '3.00:0.00',
  'rejection releases reservation without changing used balance'
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select extensions.lives_ok(
  $$select public.submit_leave_change_request(
    '73000000-0000-0000-0000-000000000004',
    2,
    'reschedule',
    current_date + 20,
    current_date + 23,
    'Menambah satu hari cuti'
  )$$,
  'annual leave reschedule can reserve a positive day delta'
);

reset role;
select extensions.is(
  (
    select used_days::text || ':' || reserved_days::text
    from public.leave_entitlements
    where employee_id = '71000000-0000-0000-0000-000000000001'
      and leave_type_id = (
        select id from public.leave_types where code = 'annual'
      )
      and year = extract(year from current_date)::integer
  ),
  '3.00:1.00',
  'longer approved leave change reserves only the positive delta'
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select extensions.lives_ok(
  $$select public.cancel_leave_change_request(
    pg_temp.workspace_leave_change_id(
      '73000000-0000-0000-0000-000000000004',
      'pending'
    ),
    1,
    'Tanggal lama tetap digunakan'
  )$$,
  'employee can withdraw a pending approved-leave change'
);

reset role;
select extensions.is(
  (
    select used_days::text || ':' || reserved_days::text
    from public.leave_entitlements
    where employee_id = '71000000-0000-0000-0000-000000000001'
      and leave_type_id = (
        select id from public.leave_types where code = 'annual'
      )
      and year = extract(year from current_date)::integer
  ),
  '3.00:0.00',
  'withdrawing a leave change releases its delta reservation'
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select extensions.lives_ok(
  $$select public.submit_leave_change_request(
    '73000000-0000-0000-0000-000000000004',
    2,
    'reschedule',
    current_date + 20,
    current_date + 23,
    'Mengajukan kembali tanggal baru'
  )$$,
  'employee can submit a replacement change after withdrawing the first'
);

reset role;
insert into public.leave_requests (
  id,
  employee_id,
  leave_type_id,
  starts_on,
  ends_on,
  requested_days,
  reason
)
values (
  '73000000-0000-0000-0000-000000000098',
  '71000000-0000-0000-0000-000000000001',
  (select id from public.leave_types where code = 'sick'),
  current_date + 23,
  current_date + 23,
  1,
  'Conflict created after change submission'
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.decide_leave_change_request(
    pg_temp.workspace_leave_change_id(
      '73000000-0000-0000-0000-000000000004',
      'pending'
    ),
    1,
    'approved',
    'Konflik belum terlihat saat submit'
  )$$,
  '23P01',
  'Tanggal cuti pengganti kini berbenturan dengan pengajuan aktif lain.',
  'leave change approval rechecks overlap under the decision lock'
);

reset role;
delete from public.leave_requests
where id = '73000000-0000-0000-0000-000000000098';

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.lives_ok(
  $$select public.decide_leave_change_request(
    pg_temp.workspace_leave_change_id(
      '73000000-0000-0000-0000-000000000004',
      'pending'
    ),
    1,
    'approved',
    'Saldo tambahan tersedia'
  )$$,
  'supervisor can approve a longer annual leave change atomically'
);

reset role;
select extensions.is(
  (
    select concat_ws(
      ':',
      entitlement.used_days,
      entitlement.reserved_days,
      request.request_version,
      request.requested_days
    )
    from public.leave_entitlements entitlement
    join public.leave_requests request
      on request.employee_id = entitlement.employee_id
      and request.leave_type_id = entitlement.leave_type_id
    where request.id = '73000000-0000-0000-0000-000000000004'
      and entitlement.year = extract(year from current_date)::integer
  ),
  '4.00:0.00:3:4.00',
  'approval moves the delta reservation to used balance and versions the leave'
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select extensions.lives_ok(
  $$select public.submit_leave_change_request(
    '73000000-0000-0000-0000-000000000004',
    3,
    'cancel',
    null,
    null,
    'Rencana cuti dibatalkan'
  )$$,
  'employee can request cancellation of future approved leave'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.lives_ok(
  $$select public.decide_leave_change_request(
    pg_temp.workspace_leave_change_id(
      '73000000-0000-0000-0000-000000000004',
      'pending'
    ),
    1,
    'approved',
    'Pembatalan disetujui'
  )$$,
  'supervisor can approve cancellation of future approved leave'
);

reset role;
select extensions.is(
  (
    select concat_ws(
      ':',
      entitlement.used_days,
      entitlement.reserved_days,
      request.status,
      request.request_version
    )
    from public.leave_entitlements entitlement
    join public.leave_requests request
      on request.employee_id = entitlement.employee_id
      and request.leave_type_id = entitlement.leave_type_id
    where request.id = '73000000-0000-0000-0000-000000000004'
      and entitlement.year = extract(year from current_date)::integer
  ),
  '0.00:0.00:cancelled:4',
  'approved cancellation releases used balance and preserves versioned history'
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.lives_ok(
  $$select public.amend_pending_leave_request(
    '73000000-0000-0000-0000-000000000005',
    1,
    current_date + 41,
    current_date + 42,
    'Menggeser cuti supervisor'
  )$$,
  'owner can amend dates of a pending leave request'
);

reset role;
select extensions.is(
  (
    select concat_ws(
      ':',
      request.request_version,
      request.requested_days,
      entitlement.reserved_days
    )
    from public.leave_requests request
    join public.leave_entitlements entitlement
      on entitlement.employee_id = request.employee_id
      and entitlement.leave_type_id = request.leave_type_id
      and entitlement.year = extract(year from request.starts_on)::integer
    where request.id = '73000000-0000-0000-0000-000000000005'
  ),
  '2:2.00:2.00',
  'pending amendment atomically versions dates and adjusts reservation'
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.submit_overtime_request(
    current_date + 50,
    '17:00',
    '17:45',
    'Invalid short overtime'
  )$$,
  '22023',
  'Durasi lembur minimal 60 menit dan harus dalam kelipatan 30 menit.',
  'invalid overtime duration is rejected'
);

select extensions.lives_ok(
  $$select public.submit_overtime_request(
    current_date + 50,
    '17:00',
    '18:30',
    'Customer service support'
  )$$,
  'employee can submit valid overtime'
);

reset role;
select extensions.is(
  (
    select planned_duration_min
    from public.overtime_requests
    where employee_id = '71000000-0000-0000-0000-000000000001'
      and overtime_date = current_date + 50
  ),
  90,
  'planned overtime duration is calculated by the database'
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.submit_overtime_request(
    current_date + 50,
    '19:00',
    '20:00',
    'Duplicate overtime'
  )$$,
  '23505',
  'Sudah ada pengajuan lembur aktif pada tanggal tersebut.',
  'duplicate active overtime date is rejected'
);

reset role;

insert into public.outlets (
  id,
  code,
  name,
  address,
  latitude,
  longitude
)
values (
  '7e000000-0000-0000-0000-000000000001',
  'LEAVE-TEST',
  'Leave Test Outlet',
  'Leave Test Address',
  -6.2,
  106.8
);

insert into public.outlet_shift_templates (
  id,
  outlet_id,
  shift_type,
  starts_at,
  ends_at
)
values (
  '75000000-0000-0000-0000-000000000001',
  '7e000000-0000-0000-0000-000000000001',
  'morning',
  '09:00',
  '17:00'
);

insert into public.roster_periods (
  id,
  month_start,
  status,
  publish_deadline
)
values (
  '76000000-0000-0000-0000-000000000001',
  date_trunc('month', current_date + 50)::date,
  'draft',
  date_trunc('month', current_date + 50)::date - 7
);

insert into public.roster_versions (
  id,
  roster_period_id,
  version_number,
  status,
  change_summary,
  created_by
)
values (
  '77000000-0000-0000-0000-000000000001',
  '76000000-0000-0000-0000-000000000001',
  1,
  'draft',
  'Overtime actual fixture',
  '72000000-0000-0000-0000-000000000003'
);

insert into public.schedule_assignments (
  id,
  roster_version_id,
  employee_id,
  outlet_id,
  shift_template_id,
  work_date,
  planned_start,
  planned_end,
  planned_duration_min,
  status
)
values (
  '78000000-0000-0000-0000-000000000001',
  '77000000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000001',
  '7e000000-0000-0000-0000-000000000001',
  '75000000-0000-0000-0000-000000000001',
  current_date + 50,
  '09:00',
  '17:00',
  480,
  'scheduled'
);

insert into public.attendance_records (
  id,
  employee_id,
  schedule_assignment_id,
  outlet_id,
  work_date,
  clock_in_at,
  clock_out_at,
  clock_in_latitude,
  clock_in_longitude,
  clock_in_accuracy_m,
  clock_out_latitude,
  clock_out_longitude,
  clock_out_accuracy_m,
  worked_duration_min,
  attendance_status
)
values (
  '79000000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000001',
  '78000000-0000-0000-0000-000000000001',
  '7e000000-0000-0000-0000-000000000001',
  current_date + 50,
  ((current_date + 50 + time '09:00') at time zone 'Asia/Jakarta'),
  ((current_date + 50 + time '19:10') at time zone 'Asia/Jakarta'),
  -6.2,
  106.8,
  5,
  -6.2,
  106.8,
  5,
  610,
  'completed'
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select extensions.lives_ok(
  $$select public.refresh_overtime_actual(
    (
      select id
      from public.overtime_requests
      where employee_id = '71000000-0000-0000-0000-000000000001'
        and overtime_date = current_date + 50
    )
  )$$,
  'employee can refresh actual overtime from completed attendance'
);

reset role;
select extensions.is(
  (
    select actual_duration_min
    from public.overtime_requests
    where employee_id = '71000000-0000-0000-0000-000000000001'
      and overtime_date = current_date + 50
  ),
  120,
  'actual overtime is rounded down to a 30 minute increment'
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000004',
  true
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.submit_overtime_request(
    current_date + 51,
    '17:00',
    '18:00',
    'Management overtime'
  )$$,
  '42501',
  'Pengguna tidak dapat membuat pengajuan lembur.',
  'management cannot submit overtime'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.lives_ok(
  $$select public.submit_overtime_request(
    current_date + 52,
    '17:00',
    '18:00',
    'Supervisor own overtime'
  )$$,
  'supervisor can submit own overtime'
);

select extensions.throws_ok(
  $$select public.decide_overtime_request(
    (
      select id
      from public.overtime_requests
      where employee_id = '71000000-0000-0000-0000-000000000003'
        and overtime_date = current_date + 52
    ),
    'approved',
    60,
    'Own overtime decision',
    1
  )$$,
  '42501',
  'Supervisor tidak dapat memutuskan lemburnya sendiri.',
  'supervisor cannot decide own overtime'
);

select extensions.lives_ok(
  $$select public.decide_overtime_request(
    (
      select id
      from public.overtime_requests
      where employee_id = '71000000-0000-0000-0000-000000000001'
        and overtime_date = current_date + 50
    ),
    'approved',
    120,
    'Durasi disetujui',
    1
  )$$,
  'supervisor can approve another employee overtime'
);

reset role;
select extensions.is(
  (
    select status::text || ':' || approved_duration_min::text
    from public.overtime_requests
    where employee_id = '71000000-0000-0000-0000-000000000001'
      and overtime_date = current_date + 50
  ),
  'approved:120',
  'approved overtime stores status and approved duration'
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.decide_overtime_request(
    (
      select id
      from public.overtime_requests
      where employee_id = '71000000-0000-0000-0000-000000000001'
        and overtime_date = current_date + 50
    ),
    'rejected',
    0,
    'Late second decision',
    1
  )$$,
  '40001',
  'Pengajuan lembur sudah diputuskan atau berubah.',
  'first overtime decision wins'
);

reset role;
select extensions.ok(
  exists (
    select 1
    from public.notifications
    where employee_id = '71000000-0000-0000-0000-000000000001'
      and notification_type = 'overtime_request_decided'
  ),
  'overtime decision creates an employee notification'
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.lives_ok(
  $$select public.assign_overtime_request(
    '71000000-0000-0000-0000-000000000002',
    current_date + 60,
    '18:00',
    '20:00',
    'Operational closing support'
  )$$,
  'supervisor can assign overtime'
);

reset role;
select extensions.is(
  (
    select source_type
    from public.overtime_requests
    where employee_id = '71000000-0000-0000-0000-000000000002'
      and overtime_date = current_date + 60
  ),
  'supervisor_assignment',
  'assigned overtime keeps its source'
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000004',
  true
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.assign_overtime_request(
    '71000000-0000-0000-0000-000000000002',
    current_date + 61,
    '18:00',
    '19:00',
    'Management assignment'
  )$$,
  '42501',
  'Hanya supervisor yang dapat menugaskan lembur.',
  'management cannot assign overtime'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.lives_ok(
  $$select public.cancel_overtime_request(
    (
      select id
      from public.overtime_requests
      where employee_id = '71000000-0000-0000-0000-000000000002'
        and overtime_date = current_date + 60
    ),
    1,
    'Penugasan tidak diperlukan'
  )$$,
  'assigning supervisor can cancel pending assignment'
);

reset role;
select extensions.is(
  (
    select status::text
    from public.overtime_requests
    where employee_id = '71000000-0000-0000-0000-000000000002'
      and overtime_date = current_date + 60
  ),
  'cancelled',
  'cancelled overtime assignment is final'
);

select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select extensions.ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_overtime_workspace()->'requests'
    ) request
    where request->>'employee_id'
      <> '71000000-0000-0000-0000-000000000001'
  ),
  'employee overtime workspace contains only own requests'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000004',
  true
);
set local role authenticated;

select extensions.ok(
  jsonb_array_length(public.get_overtime_workspace()->'requests') >= 3,
  'management can read the operational overtime list'
);

select extensions.throws_ok(
  $$select public.save_leave_type(
    null,
    'study',
    'Cuti Belajar',
    false,
    7,
    false,
    false,
    null,
    true,
    'Management change'
  )$$,
  '42501',
  'Aksi ini hanya dapat dilakukan supervisor.',
  'management cannot manage leave types'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '72000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.save_leave_type(
    (select id from public.leave_types where code = 'sick'),
    'sick',
    'Sakit',
    true,
    0,
    true,
    false,
    1,
    true,
    'Mengubah dampak saldo historis'
  )$$,
  '23514',
  'Jenis cuti yang sudah dipakai tidak dapat mengubah aturan saldo tahunan.',
  'used leave type cannot change historical annual-balance semantics'
);

select extensions.lives_ok(
  $$select public.save_leave_type(
    null,
    'study',
    'Cuti Belajar',
    false,
    7,
    false,
    false,
    null,
    true,
    'Menambah jenis cuti pilot'
  )$$,
  'supervisor can create an audited leave type'
);

reset role;
select extensions.ok(
  exists (
    select 1
    from public.leave_types
    where code = 'study'
      and name = 'Cuti Belajar'
      and is_active
  ),
  'new leave type is persisted'
);

\else

select extensions.skip(
  'Hosted role cannot seed workforce fixtures; transactional workflow tests run locally.',
  89
);

\endif

select * from extensions.finish();

rollback;
