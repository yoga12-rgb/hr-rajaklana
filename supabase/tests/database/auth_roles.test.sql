begin;

set local search_path = extensions, public, pg_catalog;

select extensions.plan(14);

select extensions.ok(
  not has_table_privilege('anon', 'public.user_accounts', 'select'),
  'anonymous cannot read user accounts'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.is_supervisor()', 'execute'),
  'anonymous cannot execute role helpers'
);

select has_table_privilege(
  current_user,
  'public.job_positions',
  'insert'
) as can_seed_role_fixtures
\gset

\if :can_seed_role_fixtures

insert into public.job_positions (
  id,
  code,
  name,
  auto_roster_eligible
)
values (
  '10000000-0000-0000-0000-000000000001',
  'AUTH-TEST',
  'Auth Test',
  false
);

insert into public.employment_statuses (
  id,
  code,
  name
)
values (
  '20000000-0000-0000-0000-000000000001',
  'AUTH-TEST',
  'Auth Test'
);

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
    '30000000-0000-0000-0000-000000000001',
    'RK-2099-001',
    'Auth Employee',
    '2099-01-01',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    'RK-2099-002',
    'Auth Supervisor',
    '2099-01-01',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    'RK-2099-003',
    'Auth Management',
    '2099-01-01',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001'
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
    '40000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'employee-auth-test@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'supervisor-auth-test@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'management-auth-test@example.invalid',
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
    '40000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'employee',
    'active',
    false
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002',
    'supervisor',
    'active',
    false
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000003',
    'management',
    'active',
    false
  );

select set_config(
  'request.jwt.claim.sub',
  '40000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select extensions.is(
  public.current_access_role(),
  'employee'::public.access_role,
  'employee role resolves from active account'
);
select extensions.is(
  public.is_supervisor(),
  false,
  'employee is not a supervisor'
);
select extensions.is(
  public.can_view_sensitive_operations(),
  false,
  'employee cannot view sensitive operations'
);
select extensions.is(
  (select count(*)::integer from public.employees),
  1,
  'employee can only read their own employee record'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '40000000-0000-0000-0000-000000000002',
  true
);
set local role authenticated;

select extensions.is(
  public.current_access_role(),
  'supervisor'::public.access_role,
  'supervisor role resolves from active account'
);
select extensions.is(
  public.is_supervisor(),
  true,
  'supervisor receives mutation authority'
);
select extensions.is(
  public.can_view_sensitive_operations(),
  true,
  'supervisor can view sensitive operations'
);
select extensions.is(
  (select count(*)::integer from public.employees),
  3,
  'supervisor can read all employee records'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '40000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.is(
  public.current_access_role(),
  'management'::public.access_role,
  'management role resolves from active account'
);
select extensions.is(
  public.is_supervisor(),
  false,
  'management remains read-only'
);
select extensions.is(
  public.can_view_sensitive_operations(),
  true,
  'management can view sensitive operations'
);
select extensions.is(
  (select count(*)::integer from public.employees),
  3,
  'management can read all employee records'
);

reset role;

\else

select * from extensions.skip(
  'hosted CLI role cannot seed transactional auth fixtures',
  12
);

\endif

select * from extensions.finish();

rollback;
