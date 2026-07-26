begin;

set local search_path = extensions, public, pg_catalog;

select extensions.plan(19);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.dry_run_employee_import(text,jsonb)',
    'execute'
  ),
  'anonymous cannot run employee import validation'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.commit_employee_import(uuid,jsonb,text)',
    'execute'
  ),
  'anonymous cannot commit employee imports'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.data_import_jobs',
    'insert'
  ),
  'authenticated clients cannot insert import jobs directly'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.data_import_jobs',
    'update'
  ),
  'authenticated clients cannot rewrite import jobs directly'
);

select has_table_privilege(
  current_user,
  'public.job_positions',
  'insert'
) as can_seed_import_fixtures
\gset

\if :can_seed_import_fixtures

insert into public.job_positions (id, code, name)
values (
  '61000000-0000-0000-0000-000000000001',
  'IMPORT-POSITION',
  'Import Position'
);

insert into public.employment_statuses (id, code, name)
values (
  '62000000-0000-0000-0000-000000000001',
  'IMPORT-STATUS',
  'Import Status'
);

insert into public.outlets (
  id,
  code,
  name,
  address,
  latitude,
  longitude
)
values (
  '63000000-0000-0000-0000-000000000001',
  'IMPORT-OUTLET',
  'Import Outlet',
  'Alamat Import',
  -6.2,
  106.8
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
    '64000000-0000-0000-0000-000000000001',
    'RK-2097-001',
    'Import Employee Actor',
    '2097-01-01',
    '62000000-0000-0000-0000-000000000001',
    '61000000-0000-0000-0000-000000000001'
  ),
  (
    '64000000-0000-0000-0000-000000000002',
    'RK-2097-002',
    'Import Supervisor Actor',
    '2097-01-01',
    '62000000-0000-0000-0000-000000000001',
    '61000000-0000-0000-0000-000000000001'
  ),
  (
    '64000000-0000-0000-0000-000000000003',
    'RK-2097-003',
    'Import Management Actor',
    '2097-01-01',
    '62000000-0000-0000-0000-000000000001',
    '61000000-0000-0000-0000-000000000001'
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
    '65000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'import-employee@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '65000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'import-supervisor@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '65000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'import-management@example.invalid',
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
    '65000000-0000-0000-0000-000000000001',
    '64000000-0000-0000-0000-000000000001',
    'employee',
    'active',
    false
  ),
  (
    '65000000-0000-0000-0000-000000000002',
    '64000000-0000-0000-0000-000000000002',
    'supervisor',
    'active',
    false
  ),
  (
    '65000000-0000-0000-0000-000000000003',
    '64000000-0000-0000-0000-000000000003',
    'management',
    'active',
    false
  );

select set_config(
  'request.jwt.claim.sub',
  '65000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.dry_run_employee_import(
    'blocked.xlsx',
    '[{"nik":"RK-2098-101"}]'::jsonb
  )$$,
  '42501',
  'Aksi ini hanya dapat dilakukan supervisor.',
  'employee cannot validate an employee import'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '65000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.dry_run_employee_import(
    'blocked.xlsx',
    '[{"nik":"RK-2098-102"}]'::jsonb
  )$$,
  '42501',
  'Aksi ini hanya dapat dilakukan supervisor.',
  'management cannot validate an employee import'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '65000000-0000-0000-0000-000000000002',
  true
);
set local role authenticated;

select public.dry_run_employee_import(
  'invalid-import.xlsx',
  '[
    {
      "nik": "SALAH",
      "full_name": "",
      "phone": "",
      "joined_at": "2098-02-30",
      "employment_status_code": "UNKNOWN",
      "job_position_code": "UNKNOWN",
      "outlet_code": "UNKNOWN"
    }
  ]'::jsonb
) as invalid_result
\gset

select extensions.is(
  (:'invalid_result'::jsonb->>'failed_rows')::integer,
  1,
  'dry-run counts an invalid row'
);
select extensions.ok(
  jsonb_array_length(
    :'invalid_result'::jsonb->'validation_errors'->0->'errors'
  ) >= 6,
  'dry-run reports field-level validation errors'
);
select extensions.is(
  (
    select count(*)::integer
    from public.data_import_jobs
    where id = (:'invalid_result'::jsonb->>'job_id')::uuid
      and import_type = 'employee_dry_run'
  ),
  1,
  'dry-run persists its validation summary'
);

select public.dry_run_employee_import(
  'valid-import.xlsx',
  '[
    {
      "nik": "RK-2098-101",
      "full_name": "Imported One",
      "phone": "081200000101",
      "joined_at": "2098-01-10",
      "employment_status_code": "IMPORT-STATUS",
      "job_position_code": "IMPORT-POSITION",
      "outlet_code": "IMPORT-OUTLET",
      "change_reason": "Impor awal"
    },
    {
      "nik": "RK-2098-102",
      "full_name": "Imported Two",
      "phone": "",
      "joined_at": "2098-01-11",
      "employment_status_code": "IMPORT-STATUS",
      "job_position_code": "IMPORT-POSITION",
      "outlet_code": "IMPORT-OUTLET",
      "change_reason": "Impor awal"
    }
  ]'::jsonb
) as valid_result
\gset

select extensions.is(
  (:'valid_result'::jsonb->>'failed_rows')::integer,
  0,
  'valid dry-run has no failed rows'
);
select extensions.is(
  (:'valid_result'::jsonb->>'success_rows')::integer,
  2,
  'valid dry-run counts all importable rows'
);
select extensions.is(
  length(:'valid_result'::jsonb->>'payload_checksum'),
  64,
  'dry-run stores a SHA-256 payload checksum'
);

select extensions.throws_ok(
  format(
    $$select public.commit_employee_import(
      %L,
      '[{"nik":"RK-2098-999"}]'::jsonb,
      'Changed rows'
    )$$,
    :'valid_result'::jsonb->>'job_id'
  ),
  '22023',
  'Isi data berubah setelah dry-run. Jalankan validasi ulang.',
  'commit rejects rows that differ from the dry-run payload'
);

select public.commit_employee_import(
  (:'valid_result'::jsonb->>'job_id')::uuid,
  '[
    {
      "nik": "RK-2098-101",
      "full_name": "Imported One",
      "phone": "081200000101",
      "joined_at": "2098-01-10",
      "employment_status_code": "IMPORT-STATUS",
      "job_position_code": "IMPORT-POSITION",
      "outlet_code": "IMPORT-OUTLET",
      "change_reason": "Impor awal"
    },
    {
      "nik": "RK-2098-102",
      "full_name": "Imported Two",
      "phone": "",
      "joined_at": "2098-01-11",
      "employment_status_code": "IMPORT-STATUS",
      "job_position_code": "IMPORT-POSITION",
      "outlet_code": "IMPORT-OUTLET",
      "change_reason": "Impor awal"
    }
  ]'::jsonb,
  'Impor fixture valid'
) as commit_result
\gset

select extensions.is(
  (:'commit_result'::jsonb->>'imported_rows')::integer,
  2,
  'commit imports every validated row'
);
select extensions.is(
  (
    select count(*)::integer
    from public.employees
    where nik in ('RK-2098-101', 'RK-2098-102')
  ),
  2,
  'commit creates employee records'
);
select extensions.is(
  (
    select count(*)::integer
    from public.employee_placements placement
    join public.employees employee on employee.id = placement.employee_id
    where employee.nik in ('RK-2098-101', 'RK-2098-102')
      and placement.outlet_id = '63000000-0000-0000-0000-000000000001'
      and placement.end_date is null
  ),
  2,
  'commit creates active primary placements'
);
select extensions.is(
  (
    select count(*)::integer
    from public.data_import_jobs
    where id = (:'commit_result'::jsonb->>'job_id')::uuid
      and committed_from = (:'valid_result'::jsonb->>'job_id')::uuid
  ),
  1,
  'commit job links back to its dry-run'
);
select extensions.is(
  (
    select count(*)::integer
    from public.audit_logs
    where entity_id = (:'commit_result'::jsonb->>'job_id')::uuid
      and action = 'commit_employee_import'
  ),
  1,
  'commit writes an import audit event'
);
select extensions.throws_ok(
  format(
    $$select public.commit_employee_import(
      %L,
      %L::jsonb,
      'Duplicate commit'
    )$$,
    :'valid_result'::jsonb->>'job_id',
    '[
      {
        "nik": "RK-2098-101",
        "full_name": "Imported One",
        "phone": "081200000101",
        "joined_at": "2098-01-10",
        "employment_status_code": "IMPORT-STATUS",
        "job_position_code": "IMPORT-POSITION",
        "outlet_code": "IMPORT-OUTLET",
        "change_reason": "Impor awal"
      },
      {
        "nik": "RK-2098-102",
        "full_name": "Imported Two",
        "phone": "",
        "joined_at": "2098-01-11",
        "employment_status_code": "IMPORT-STATUS",
        "job_position_code": "IMPORT-POSITION",
        "outlet_code": "IMPORT-OUTLET",
        "change_reason": "Impor awal"
      }
    ]'
  ),
  '23505',
  'Hasil dry-run ini sudah pernah diimpor.',
  'a dry-run cannot be committed twice'
);

\else

select * from extensions.skip(
  'hosted CLI role cannot seed employee import fixtures',
  15
);

\endif

select * from extensions.finish();

rollback;
