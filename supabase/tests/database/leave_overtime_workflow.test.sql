begin;

set local search_path = extensions, public, pg_catalog;

select extensions.plan(70);

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
  53
);

\endif

select * from extensions.finish();

rollback;
