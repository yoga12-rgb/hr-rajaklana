begin;

set local search_path = extensions, public, pg_catalog;

select extensions.plan(62);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.create_employee_master(text,text,text,date,uuid,uuid,uuid,text)',
    'execute'
  ),
  'anonymous cannot create employee master data'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.update_employee_master(uuid,text,text,text,date,uuid,uuid,uuid,date,text)',
    'execute'
  ),
  'anonymous cannot update employee master data'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.archive_employee_master(uuid,text)',
    'execute'
  ),
  'anonymous cannot archive employee master data'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.create_outlet_master(text,text,text,numeric,numeric,integer,text)',
    'execute'
  ),
  'anonymous cannot create outlet master data'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.update_outlet_master(uuid,text,text,text,numeric,numeric,integer,text)',
    'execute'
  ),
  'anonymous cannot update outlet master data'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.set_outlet_active(uuid,boolean,text)',
    'execute'
  ),
  'anonymous cannot change outlet status'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.publish_policy_version(text,jsonb,text)',
    'execute'
  ),
  'anonymous cannot publish policy versions'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.publish_work_policy(jsonb,jsonb,text)',
    'execute'
  ),
  'anonymous cannot publish a combined work policy'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.replace_outlet_shift_template(uuid,public.shift_type,time without time zone,time without time zone,integer,integer,text)',
    'execute'
  ),
  'anonymous cannot replace outlet shift templates'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.replace_outlet_staffing_requirements(uuid,smallint,date,jsonb,text)',
    'execute'
  ),
  'anonymous cannot replace outlet staffing requirements'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.policy_versions',
    'insert'
  ),
  'authenticated clients cannot insert policy versions directly'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.policy_versions',
    'update'
  ),
  'authenticated clients cannot rewrite policy history directly'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.outlet_shift_templates',
    'insert'
  ),
  'authenticated clients cannot insert shift templates directly'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.outlet_shift_templates',
    'update'
  ),
  'authenticated clients cannot rewrite shift template history directly'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.outlet_staffing_requirements',
    'insert'
  ),
  'authenticated clients cannot insert staffing requirements directly'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.outlet_staffing_requirements',
    'update'
  ),
  'authenticated clients cannot rewrite staffing requirement history directly'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.outlet_staffing_requirements',
    'delete'
  ),
  'authenticated clients cannot delete staffing requirement history directly'
);

select has_table_privilege(
  current_user,
  'public.job_positions',
  'insert'
) as can_seed_master_fixtures
\gset

\if :can_seed_master_fixtures

insert into public.job_positions (id, code, name)
values (
  '51000000-0000-0000-0000-000000000001',
  'MASTER-TEST',
  'Master Test'
);

insert into public.employment_statuses (id, code, name)
values (
  '52000000-0000-0000-0000-000000000001',
  'MASTER-TEST',
  'Master Test'
);

insert into public.outlets (
  id,
  code,
  name,
  address,
  latitude,
  longitude
)
values
  (
    '53000000-0000-0000-0000-000000000001',
    'MASTER-A',
    'Master Outlet A',
    'Alamat A',
    -6.2,
    106.8
  ),
  (
    '53000000-0000-0000-0000-000000000002',
    'MASTER-B',
    'Master Outlet B',
    'Alamat B',
    -6.3,
    106.9
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
    '54000000-0000-0000-0000-000000000001',
    'RK-2098-001',
    'Master Employee',
    '2098-01-01',
    '52000000-0000-0000-0000-000000000001',
    '51000000-0000-0000-0000-000000000001'
  ),
  (
    '54000000-0000-0000-0000-000000000002',
    'RK-2098-002',
    'Master Supervisor',
    '2098-01-01',
    '52000000-0000-0000-0000-000000000001',
    '51000000-0000-0000-0000-000000000001'
  ),
  (
    '54000000-0000-0000-0000-000000000003',
    'RK-2098-003',
    'Master Management',
    '2098-01-01',
    '52000000-0000-0000-0000-000000000001',
    '51000000-0000-0000-0000-000000000001'
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
    '55000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'master-employee@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '55000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'master-supervisor@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '55000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'master-management@example.invalid',
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
    '55000000-0000-0000-0000-000000000001',
    '54000000-0000-0000-0000-000000000001',
    'employee',
    'active',
    false
  ),
  (
    '55000000-0000-0000-0000-000000000002',
    '54000000-0000-0000-0000-000000000002',
    'supervisor',
    'active',
    false
  ),
  (
    '55000000-0000-0000-0000-000000000003',
    '54000000-0000-0000-0000-000000000003',
    'management',
    'active',
    false
  );

select set_config(
  'request.jwt.claim.sub',
  '55000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.create_employee_master(
    'RK-2098-010',
    'Blocked Employee Create',
    '',
    '2098-02-01',
    '52000000-0000-0000-0000-000000000001',
    '51000000-0000-0000-0000-000000000001',
    '53000000-0000-0000-0000-000000000001',
    'Penempatan awal'
  )$$,
  '42501',
  'Aksi ini hanya dapat dilakukan supervisor.',
  'employee cannot create employee master data'
);

select extensions.throws_ok(
  $$select public.archive_employee_master(
    '54000000-0000-0000-0000-000000000003',
    'Blocked archive'
  )$$,
  '42501',
  'Aksi ini hanya dapat dilakukan supervisor.',
  'employee cannot archive employee master data'
);

select extensions.throws_ok(
  $$select public.publish_policy_version(
    'attendance',
    '{"late_tolerance_minutes": 20}'::jsonb,
    'Blocked policy update'
  )$$,
  '42501',
  'Aksi ini hanya dapat dilakukan supervisor.',
  'employee cannot publish policy versions'
);

select extensions.throws_ok(
  $$select public.replace_outlet_staffing_requirements(
    '53000000-0000-0000-0000-000000000001',
    4::smallint,
    '2098-04-01',
    '[{"shift_type":"morning","minimum_staff":1}]'::jsonb,
    'Blocked staffing update'
  )$$,
  '42501',
  'Aksi ini hanya dapat dilakukan supervisor.',
  'employee cannot replace outlet staffing requirements'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '55000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.create_employee_master(
    'RK-2098-011',
    'Blocked Management Create',
    '',
    '2098-02-01',
    '52000000-0000-0000-0000-000000000001',
    '51000000-0000-0000-0000-000000000001',
    '53000000-0000-0000-0000-000000000001',
    'Penempatan awal'
  )$$,
  '42501',
  'Aksi ini hanya dapat dilakukan supervisor.',
  'management remains read-only for master data'
);

select extensions.throws_ok(
  $$select public.replace_outlet_staffing_requirements(
    '53000000-0000-0000-0000-000000000001',
    4::smallint,
    '2098-04-01',
    '[{"shift_type":"morning","minimum_staff":1}]'::jsonb,
    'Blocked management staffing update'
  )$$,
  '42501',
  'Aksi ini hanya dapat dilakukan supervisor.',
  'management cannot replace outlet staffing requirements'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '55000000-0000-0000-0000-000000000002',
  true
);
set local role authenticated;

select public.create_employee_master(
  'RK-2098-010',
  'Created Employee',
  '081200000000',
  '2098-02-01',
  '52000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000001',
  '53000000-0000-0000-0000-000000000001',
  'Penempatan awal'
) as created_employee_id
\gset

select extensions.ok(
  :'created_employee_id'::uuid is not null,
  'supervisor creates an employee atomically'
);
select extensions.is(
  (
    select count(*)::integer
    from public.employee_placements
    where employee_id = :'created_employee_id'::uuid
      and outlet_id = '53000000-0000-0000-0000-000000000001'
      and end_date is null
  ),
  1,
  'employee creation also creates the primary placement'
);
select extensions.is(
  (
    select count(*)::integer
    from public.audit_logs
    where entity_id = :'created_employee_id'::uuid
      and action = 'create_employee_master'
  ),
  1,
  'employee creation writes an audit event'
);

select extensions.lives_ok(
  format(
    $$select public.update_employee_master(
      %L,
      'RK-2098-010',
      'Updated Employee',
      '081211111111',
      '2098-02-01',
      '52000000-0000-0000-0000-000000000001',
      '51000000-0000-0000-0000-000000000001',
      '53000000-0000-0000-0000-000000000002',
      '2098-03-01',
      'Pindah outlet'
    )$$,
    :'created_employee_id'
  ),
  'supervisor updates employee and placement'
);
select extensions.is(
  (
    select count(*)::integer
    from public.employee_placements
    where employee_id = :'created_employee_id'::uuid
  ),
  2,
  'outlet change preserves placement history'
);
select extensions.is(
  (
    select outlet_id
    from public.employee_placements
    where employee_id = :'created_employee_id'::uuid
      and is_primary
      and end_date is null
  ),
  '53000000-0000-0000-0000-000000000002'::uuid,
  'outlet change installs the new primary placement'
);

select extensions.lives_ok(
  format(
    $$select public.update_employee_master(
      %L,
      'RK-2098-010',
      'Updated Employee',
      '081211111111',
      '2098-02-01',
      '52000000-0000-0000-0000-000000000001',
      '51000000-0000-0000-0000-000000000001',
      '53000000-0000-0000-0000-000000000002',
      '2098-03-05',
      'Koreksi tanggal efektif'
    )$$,
    :'created_employee_id'
  ),
  'supervisor corrects the effective date without changing outlet'
);
select extensions.is(
  (
    select start_date
    from public.employee_placements
    where employee_id = :'created_employee_id'::uuid
      and outlet_id = '53000000-0000-0000-0000-000000000002'
      and end_date is null
  ),
  '2098-03-05'::date,
  'same-outlet update changes the active placement start date'
);
select extensions.is(
  (
    select end_date
    from public.employee_placements
    where employee_id = :'created_employee_id'::uuid
      and outlet_id = '53000000-0000-0000-0000-000000000001'
  ),
  '2098-03-04'::date,
  'effective date correction keeps the previous placement boundary contiguous'
);

select extensions.lives_ok(
  format(
    $$select public.archive_employee_master(%L, 'Karyawan tidak aktif')$$,
    :'created_employee_id'
  ),
  'supervisor archives employee without hard delete'
);
select extensions.ok(
  (
    select archived_at is not null
    from public.employees
    where id = :'created_employee_id'::uuid
  ),
  'archived employee record remains available'
);
select extensions.is(
  (
    select count(*)::integer
    from public.employee_placements
    where employee_id = :'created_employee_id'::uuid
      and end_date is null
  ),
  0,
  'archive closes the active placement'
);
select extensions.is(
  (
    select count(*)::integer
    from public.audit_logs
    where entity_id = :'created_employee_id'::uuid
      and action = 'archive_employee_master'
  ),
  1,
  'archive writes an audit event'
);

select public.create_outlet_master(
  'MASTER-C',
  'Master Outlet C',
  'Alamat C',
  -6.4,
  107.0,
  100,
  'Membuat outlet pengujian'
) as created_outlet_id
\gset

select extensions.ok(
  :'created_outlet_id'::uuid is not null,
  'supervisor creates an outlet'
);
select extensions.is(
  (
    select count(*)::integer
    from public.audit_logs
    where entity_id = :'created_outlet_id'::uuid
      and action = 'create_outlet_master'
  ),
  1,
  'outlet creation writes an audit event'
);
select extensions.lives_ok(
  format(
    $$select public.update_outlet_master(
      %L,
      'MASTER-C',
      'Master Outlet Updated',
      'Alamat C Baru',
      -6.41,
      107.01,
      200,
      'Koreksi geofence'
    )$$,
    :'created_outlet_id'
  ),
  'supervisor updates outlet and geofence'
);
select extensions.is(
  (
    select geofence_radius_m
    from public.outlets
    where id = :'created_outlet_id'::uuid
  ),
  200,
  'updated outlet stores the new geofence radius'
);

insert into public.employee_placements (
  employee_id,
  outlet_id,
  start_date,
  is_primary,
  change_reason,
  set_by
)
values (
  '54000000-0000-0000-0000-000000000001',
  :'created_outlet_id'::uuid,
  '2098-01-01',
  true,
  'Fixture penempatan aktif',
  '55000000-0000-0000-0000-000000000002'
);

select extensions.throws_ok(
  format(
    $$select public.set_outlet_active(
      %L,
      false,
      'Mencoba nonaktif'
    )$$,
    :'created_outlet_id'
  ),
  '23503',
  'Outlet masih memiliki penempatan karyawan aktif.',
  'outlet with active placements cannot be deactivated'
);

update public.employee_placements
set end_date = '2098-01-02'
where outlet_id = :'created_outlet_id'::uuid;

select extensions.lives_ok(
  format(
    $$select public.set_outlet_active(
      %L,
      false,
      'Outlet berhenti beroperasi'
    )$$,
    :'created_outlet_id'
  ),
  'supervisor deactivates an unused outlet'
);
select extensions.is(
  (
    select is_active
    from public.outlets
    where id = :'created_outlet_id'::uuid
  ),
  false,
  'deactivation keeps outlet as an inactive historical record'
);
select extensions.lives_ok(
  format(
    $$select public.set_outlet_active(
      %L,
      true,
      'Outlet beroperasi kembali'
    )$$,
    :'created_outlet_id'
  ),
  'supervisor can reactivate an outlet'
);
select extensions.is(
  (
    select count(*)::integer
    from public.audit_logs
    where entity_id = :'created_outlet_id'::uuid
      and action in (
        'create_outlet_master',
        'update_outlet_master',
        'deactivate_outlet',
        'activate_outlet'
      )
  ),
  4,
  'outlet lifecycle writes complete audit events'
);

select public.publish_policy_version(
  'attendance',
  '{
    "late_tolerance_minutes": 20,
    "clock_in_selfie_required": true
  }'::jsonb,
  'Kalibrasi toleransi pengujian'
) as published_policy_id
\gset

select extensions.ok(
  :'published_policy_id'::uuid is not null,
  'supervisor publishes a policy version'
);
select extensions.is(
  (
    select version_number
    from public.policy_versions
    where id = :'published_policy_id'::uuid
  ),
  2,
  'published policy increments its version number'
);
select extensions.is(
  (
    select (configuration->>'clock_in_early_minutes')::integer
    from public.policy_versions
    where id = :'published_policy_id'::uuid
  ),
  60,
  'policy publishing preserves unchanged configuration'
);
select extensions.ok(
  (
    select effective_until is not null
    from public.policy_versions
    where policy_type = 'attendance'
      and version_number = 1
  ),
  'policy publishing closes the previous effective version'
);
select extensions.is(
  (
    select count(*)::integer
    from public.audit_logs
    where entity_id = :'published_policy_id'::uuid
      and action = 'publish_policy_version'
  ),
  1,
  'policy publishing writes an audit event'
);
select extensions.throws_ok(
  $$select public.publish_policy_version(
    'attendance',
    '{"late_tolerance_minutes": 181}'::jsonb,
    'Invalid tolerance'
  )$$,
  '22023',
  'Konfigurasi kebijakan presensi tidak valid.',
  'policy publishing rejects an invalid tolerance'
);

select public.replace_outlet_shift_template(
  '53000000-0000-0000-0000-000000000001',
  'morning',
  '07:00',
  '15:00',
  15,
  15,
  'Template awal pengujian'
) as first_shift_template_id
\gset

select extensions.ok(
  :'first_shift_template_id'::uuid is not null,
  'supervisor creates an outlet shift template'
);

select public.replace_outlet_shift_template(
  '53000000-0000-0000-0000-000000000001',
  'morning',
  '06:30',
  '14:30',
  20,
  10,
  'Perubahan jam operasional'
) as second_shift_template_id
\gset

select extensions.is(
  (
    select id
    from public.outlet_shift_templates
    where outlet_id = '53000000-0000-0000-0000-000000000001'
      and shift_type = 'morning'
      and is_active
  ),
  :'second_shift_template_id'::uuid,
  'replacement installs exactly the new active shift template'
);
select extensions.ok(
  (
    select not is_active
    from public.outlet_shift_templates
    where id = :'first_shift_template_id'::uuid
  ),
  'replacement retains the previous shift template as inactive history'
);
select extensions.is(
  (
    select count(*)::integer
    from public.audit_logs
    where action = 'replace_outlet_shift_template'
      and entity_id in (
        :'first_shift_template_id'::uuid,
        :'second_shift_template_id'::uuid
      )
  ),
  2,
  'shift template replacements write audit events'
);

select public.replace_outlet_shift_template(
  '53000000-0000-0000-0000-000000000001',
  'middle',
  '12:00',
  '20:00',
  15,
  15,
  'Template middle pengujian'
);

select public.replace_outlet_shift_template(
  '53000000-0000-0000-0000-000000000001',
  'night',
  '15:00',
  '23:00',
  15,
  15,
  'Template malam pengujian'
);

select extensions.lives_ok(
  $$select public.replace_outlet_staffing_requirements(
    '53000000-0000-0000-0000-000000000001',
    4::smallint,
    '2098-04-01',
    '[
      {"shift_type":"morning","minimum_staff":1},
      {"shift_type":"middle","minimum_staff":1},
      {"shift_type":"night","minimum_staff":1}
    ]'::jsonb,
    'Kebutuhan awal empat kasir'
  )$$,
  'supervisor saves a complete staffing requirement set'
);
select extensions.is(
  (
    select count(*)::integer
    from public.outlet_staffing_requirements requirement
    where requirement.outlet_id = '53000000-0000-0000-0000-000000000001'
      and requirement.cashier_count = 4
      and requirement.effective_from = '2098-04-01'
  ),
  3,
  'staffing requirement set covers every active shift template'
);
select extensions.is(
  (
    select sum(requirement.minimum_staff)::integer
    from public.outlet_staffing_requirements requirement
    where requirement.outlet_id = '53000000-0000-0000-0000-000000000001'
      and requirement.cashier_count = 4
      and requirement.effective_from = '2098-04-01'
  ),
  3,
  'staffing requirement set stores the minimum total'
);
select extensions.is(
  (
    select count(*)::integer
    from public.audit_logs audit
    where audit.entity_id = '53000000-0000-0000-0000-000000000001'
      and audit.action = 'replace_outlet_staffing_requirements'
  ),
  1,
  'staffing requirement replacement writes an audit event'
);
select extensions.lives_ok(
  $$select public.replace_outlet_staffing_requirements(
    '53000000-0000-0000-0000-000000000001',
    4::smallint,
    '2098-05-01',
    '[
      {"shift_type":"morning","minimum_staff":1},
      {"shift_type":"middle","minimum_staff":1},
      {"shift_type":"night","minimum_staff":2}
    ]'::jsonb,
    'Kebutuhan empat kasir periode berikutnya'
  )$$,
  'supervisor schedules the next staffing requirement version'
);
select extensions.is(
  (
    select max(requirement.effective_until)
    from public.outlet_staffing_requirements requirement
    where requirement.outlet_id = '53000000-0000-0000-0000-000000000001'
      and requirement.cashier_count = 4
      and requirement.effective_from = '2098-04-01'
  ),
  '2098-04-30'::date,
  'next staffing version closes the previous effective range'
);
select extensions.throws_ok(
  $$select public.replace_outlet_staffing_requirements(
    '53000000-0000-0000-0000-000000000001',
    4::smallint,
    '2098-06-01',
    '[
      {"shift_type":"morning","minimum_staff":2},
      {"shift_type":"middle","minimum_staff":2},
      {"shift_type":"night","minimum_staff":1}
    ]'::jsonb,
    'Total kebutuhan tidak valid'
  )$$,
  '22023',
  'Total minimum staf seluruh shift tidak boleh melebihi jumlah kasir.',
  'staffing requirement rejects an impossible minimum total'
);

\else

select * from extensions.skip(
  'hosted CLI role cannot seed transactional master data fixtures',
  45
);

\endif

select * from extensions.finish();

rollback;
