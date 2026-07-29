begin;

set local search_path = extensions, public, pg_catalog;

select extensions.plan(11);

set local role anon;
select extensions.throws_ok(
  $$select public.get_operational_health_workspace()$$,
  '42501',
  null,
  'anonymous cannot execute operational health workspace'
);
reset role;

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.get_operational_health_workspace()',
    'execute'
  ),
  'authenticated role may enter the role-aware health RPC'
);

set local role service_role;
select extensions.throws_ok(
  $$select public.get_operational_health_workspace()$$,
  '42501',
  null,
  'service role does not bypass the account role check'
);
reset role;

select has_table_privilege(
  current_user,
  'public.job_positions',
  'insert'
) as can_seed_operational_health_fixtures
\gset

\if :can_seed_operational_health_fixtures

insert into public.job_positions (id, code, name, auto_roster_eligible)
values (
  'b1000000-0000-0000-0000-000000000001',
  'OPS-HEALTH',
  'Operational Health Test',
  false
);

insert into public.employment_statuses (id, code, name)
values (
  'b2000000-0000-0000-0000-000000000001',
  'OPS-HEALTH',
  'Operational Health Test'
);

insert into public.employees (
  id, nik, full_name, joined_at, employment_status_id, job_position_id
)
values
  ('b3000000-0000-0000-0000-000000000001', 'RK-2094-901', 'Ops Employee', current_date, 'b2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001'),
  ('b3000000-0000-0000-0000-000000000002', 'RK-2094-902', 'Ops Supervisor', current_date, 'b2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001'),
  ('b3000000-0000-0000-0000-000000000003', 'RK-2094-903', 'Ops Management', current_date, 'b2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('b4000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ops-employee@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('b4000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'ops-supervisor@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('b4000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'ops-management@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.user_accounts (
  user_id, employee_id, access_role, account_status, must_change_password
)
values
  ('b4000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', 'employee', 'active', false),
  ('b4000000-0000-0000-0000-000000000002', 'b3000000-0000-0000-0000-000000000002', 'supervisor', 'active', false),
  ('b4000000-0000-0000-0000-000000000003', 'b3000000-0000-0000-0000-000000000003', 'management', 'active', false);

insert into public.audit_logs (
  actor_user_id,
  action,
  entity_type,
  after_values,
  reason
)
values (
  'b4000000-0000-0000-0000-000000000002',
  'operational_health_test',
  'test_entity',
  '{"storage_path":"must-not-leak","secret":"must-not-leak"}',
  'must-not-leak'
);

select set_config(
  'request.jwt.claim.sub',
  'b4000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.get_operational_health_workspace()$$,
  '42501',
  'Kesehatan operasional hanya tersedia untuk supervisor dan management.',
  'employee cannot read operational health'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  'b4000000-0000-0000-0000-000000000002',
  true
);
set local role authenticated;

select extensions.is(
  public.get_operational_health_workspace()->>'role',
  'supervisor',
  'supervisor opens operational health workspace'
);

select extensions.ok(
  public.get_operational_health_workspace()
    ?& array['retention', 'report_exports', 'roster_generation', 'audit'],
  'workspace contains every monitored operational area'
);

select extensions.is(
  public.get_operational_health_workspace()
    #>> '{audit,recent_events,0,action}',
  'operational_health_test',
  'redacted audit timeline contains the latest action'
);

select extensions.ok(
  not (
    public.get_operational_health_workspace()
      #> '{audit,recent_events,0}'
  ) ?| array[
    'actor_user_id',
    'after_values',
    'before_values',
    'reason',
    'storage_path',
    'last_error'
  ],
  'audit event omits identifiers, payloads, paths, and errors'
);

select extensions.is(
  (
    public.get_operational_health_workspace()
      #>> '{retention,last_cron_stale}'
  )::boolean,
  true,
  'missing automatic cron remains visible as stale verification'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  'b4000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.is(
  public.get_operational_health_workspace()->>'role',
  'management',
  'management opens the same read-only health workspace'
);

select extensions.is(
  (
    public.get_operational_health_workspace()
      #>> '{application_backups,provider_backup_verified}'
  )::boolean,
  false,
  'application never claims provider backup verification automatically'
);

reset role;

\else

select * from extensions.skip(
  'hosted CLI role cannot seed operational health fixtures',
  8
);

\endif

select * from extensions.finish();

rollback;
