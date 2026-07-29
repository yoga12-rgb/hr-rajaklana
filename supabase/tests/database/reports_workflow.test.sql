begin;

set local search_path = extensions, public, pg_catalog;

select extensions.plan(14);

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
  12
);

\endif

select * from extensions.finish();

rollback;
