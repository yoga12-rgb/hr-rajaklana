begin;

set local search_path = extensions, public, pg_catalog;

select extensions.plan(24);

set local role anon;
select extensions.throws_ok(
  $$select public.get_report_workspace(current_date, current_date, null, null)$$,
  '42501',
  null,
  'anonymous cannot execute report workspace'
);
reset role;

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.get_report_workspace(date,date,uuid,uuid)',
    'execute'
  ),
  'authenticated role may enter the role-aware report RPC'
);

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.request_report_export(date,date,uuid,uuid,uuid)',
    'execute'
  ),
  'authenticated role may enter the role-aware export request RPC'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_report_export(uuid)',
    'execute'
  ),
  'authenticated role cannot claim report export jobs'
);

select extensions.ok(
  has_function_privilege(
    'service_role',
    'public.claim_report_export(uuid)',
    'execute'
  ),
  'service role may claim report export jobs'
);

select has_table_privilege(
  current_user,
  'public.job_positions',
  'insert'
) as can_seed_report_fixtures
\gset

\if :can_seed_report_fixtures

insert into public.job_positions (id, code, name, auto_roster_eligible)
values (
  'a1000000-0000-0000-0000-000000000001',
  'REPORT-TEST',
  'Report Test',
  false
);

insert into public.employment_statuses (id, code, name)
values (
  'a2000000-0000-0000-0000-000000000001',
  'REPORT-TEST',
  'Report Test'
);

insert into public.outlets (
  id, code, name, address, latitude, longitude, geofence_radius_m
)
values
  ('a3000000-0000-0000-0000-000000000001', 'REP-01', 'Report Outlet One', 'Test', -6.2, 106.8, 100),
  ('a3000000-0000-0000-0000-000000000002', 'REP-02', 'Report Outlet Two', 'Test', -6.3, 106.9, 100);

insert into public.employees (
  id, nik, full_name, joined_at, employment_status_id, job_position_id
)
values
  ('a4000000-0000-0000-0000-000000000001', 'RK-2093-901', 'Report Employee', current_date, 'a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001'),
  ('a4000000-0000-0000-0000-000000000002', 'RK-2093-902', 'Report Supervisor', current_date, 'a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001'),
  ('a4000000-0000-0000-0000-000000000003', 'RK-2093-903', 'Report Management', current_date, 'a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001');

insert into public.employee_placements (
  employee_id, outlet_id, start_date, is_primary, change_reason
)
values
  ('a4000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', current_date, true, 'Test'),
  ('a4000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000001', current_date, true, 'Test'),
  ('a4000000-0000-0000-0000-000000000003', 'a3000000-0000-0000-0000-000000000002', current_date, true, 'Test');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('a5000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'report-employee@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('a5000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'report-supervisor@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('a5000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'report-management@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.user_accounts (
  user_id, employee_id, access_role, account_status, must_change_password
)
values
  ('a5000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 'employee', 'active', false),
  ('a5000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000002', 'supervisor', 'active', false),
  ('a5000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000003', 'management', 'active', false);

insert into public.attendance_records (
  id, employee_id, outlet_id, work_date, clock_in_at, clock_out_at,
  clock_in_latitude, clock_in_longitude, clock_in_accuracy_m,
  clock_in_distance_m, clock_in_state, clock_out_latitude,
  clock_out_longitude, clock_out_accuracy_m, clock_out_distance_m,
  clock_out_state, attendance_status, validation_status, worked_duration_min
)
values
  (
    'a6000000-0000-0000-0000-000000000001',
    'a4000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-000000000001',
    current_date, now() - interval '8 hours', now(),
    -6.2, 106.8, 10, 0, 'on_time',
    -6.2, 106.8, 10, 0, 'complete', 'completed', 'approved', 480
  ),
  (
    'a6000000-0000-0000-0000-000000000002',
    'a4000000-0000-0000-0000-000000000003',
    'a3000000-0000-0000-0000-000000000002',
    current_date, now() - interval '7 hours', now(),
    -6.3, 106.9, 10, 0, 'late',
    -6.3, 106.9, 10, 0, 'early', 'completed', 'pending', 420
  );

select set_config(
  'request.jwt.claim.sub',
  'a5000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.get_report_workspace(current_date, current_date, null, null)$$,
  '42501',
  'Laporan hanya tersedia untuk supervisor dan management.',
  'employee cannot read operational reports'
);

select extensions.throws_ok(
  $$select public.request_report_export(
    current_date,
    current_date,
    null,
    null,
    'a7000000-0000-0000-0000-000000000001'
  )$$,
  '42501',
  'Ekspor laporan hanya tersedia untuk supervisor dan management.',
  'employee cannot request operational report exports'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  'a5000000-0000-0000-0000-000000000002',
  true
);
set local role authenticated;

select extensions.is(
  public.get_report_workspace(current_date, current_date, null, null)->>'role',
  'supervisor',
  'supervisor opens report workspace'
);

select extensions.is(
  public.request_report_export(
    current_date - 180,
    current_date,
    null,
    null,
    'a7000000-0000-0000-0000-000000000002'
  )->>'status',
  'scheduled',
  'supervisor can schedule a long report export'
);

select extensions.is(
  (
    select count(*)::integer
    from public.backup_exports
    where request_key = 'a7000000-0000-0000-0000-000000000002'
  ),
  1,
  'report export request key is idempotent'
);

select extensions.throws_ok(
  $$select public.request_report_export(
    current_date - 366,
    current_date,
    null,
    null,
    'a7000000-0000-0000-0000-000000000003'
  )$$,
  '22023',
  'Satu ekspor dibatasi maksimal 366 hari.',
  'report export rejects periods longer than 366 days'
);

select extensions.throws_ok(
  $$insert into public.backup_exports (
    export_type,
    period_start,
    period_end,
    requested_by,
    request_key
  ) values (
    'report',
    current_date,
    current_date,
    'a5000000-0000-0000-0000-000000000002',
    'a7000000-0000-0000-0000-000000000004'
  )$$,
  '42501',
  null,
  'supervisor cannot bypass the export request RPC'
);

select extensions.is(
  (
    public.get_report_workspace(current_date, current_date, null, null)
      #>> '{summary,attendance_count}'
  )::integer,
  2,
  'report counts attendance in selected period'
);

select extensions.is(
  (
    public.get_report_workspace(current_date, current_date, null, null)
      #>> '{summary,late_count}'
  )::integer,
  1,
  'report aggregates late attendance'
);

select extensions.is(
  jsonb_array_length(
    public.get_report_workspace(
      current_date,
      current_date,
      'a3000000-0000-0000-0000-000000000001',
      null
    )->'attendance'
  ),
  1,
  'outlet filter limits attendance rows'
);

select extensions.is(
  jsonb_array_length(
    public.get_report_workspace(
      current_date,
      current_date,
      null,
      'a4000000-0000-0000-0000-000000000003'
    )->'attendance'
  ),
  1,
  'employee filter limits attendance rows'
);

select extensions.throws_ok(
  $$select public.get_report_workspace(
    current_date,
    current_date - 1,
    null,
    null
  )$$,
  '22023',
  'Periode laporan tidak valid.',
  'report rejects inverted date range'
);

select extensions.throws_ok(
  $$select public.get_report_workspace(
    current_date - 92,
    current_date,
    null,
    null
  )$$,
  '22023',
  'Laporan interaktif dibatasi maksimal 92 hari.',
  'report rejects periods longer than 92 days'
);

select extensions.is(
  jsonb_array_length(
    public.get_report_workspace(current_date, current_date, null, null)
      #> '{filters,outlets}'
  ),
  2,
  'report exposes outlet filter options'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  'a5000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.is(
  public.get_report_workspace(current_date, current_date, null, null)->>'role',
  'management',
  'management opens read-only report workspace'
);

select extensions.is(
  public.request_report_export(
    current_date - 30,
    current_date,
    null,
    null,
    'a7000000-0000-0000-0000-000000000005'
  )->>'status',
  'scheduled',
  'management can schedule its own report export'
);

select extensions.is(
  jsonb_array_length(public.get_report_export_jobs()),
  1,
  'management export history only contains its own jobs'
);

select extensions.is(
  (
    public.get_report_workspace(current_date, current_date, null, null)
      #>> '{summary,early_checkout_count}'
  )::integer,
  1,
  'management sees the same factual early checkout aggregate'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'public.attendance_records', 'insert'),
  'authenticated client cannot insert attendance outside its RPC workflow'
);

reset role;

\else

select * from extensions.skip(
  'hosted CLI role cannot seed transactional report fixtures',
  19
);

\endif

select * from extensions.finish();

rollback;
