begin;

set local search_path = extensions, public, pg_catalog;

select extensions.plan(30);

select extensions.ok(
  not has_function_privilege('anon', 'public.get_attendance_workspace()', 'execute'),
  'anonymous cannot load attendance workspace'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.clock_in_attendance(uuid,uuid,numeric,numeric,numeric,timestamptz,boolean,jsonb,text)',
    'execute'
  ),
  'anonymous cannot clock in'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.clock_out_attendance(uuid,numeric,numeric,numeric,timestamptz,boolean)',
    'execute'
  ),
  'anonymous cannot clock out'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.preview_attendance_geofence(uuid,numeric,numeric,numeric,timestamptz)',
    'execute'
  ),
  'anonymous cannot preview attendance geofence'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.attendance_records', 'insert'),
  'clients cannot insert attendance records directly'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.attendance_records', 'update'),
  'clients cannot update attendance records directly'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.file_deletion_jobs', 'update'),
  'clients cannot update retention jobs directly'
);
select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.complete_attendance_file_deletion_job(uuid,timestamptz)',
    'execute'
  ),
  'clients cannot finalize retention jobs'
);
select has_table_privilege(current_user, 'public.job_positions', 'insert')
  as can_seed_attendance_fixtures
\gset

\if :can_seed_attendance_fixtures

insert into public.job_positions (id, code, name, auto_roster_eligible)
values
  ('71000000-0000-0000-0000-000000000001', 'ATT-CASHIER', 'Kasir Attendance Test', true),
  ('71000000-0000-0000-0000-000000000002', 'ATT-SUP', 'Supervisor Attendance Test', false);

insert into public.employment_statuses (id, code, name)
values ('72000000-0000-0000-0000-000000000001', 'ATT-ACTIVE', 'Attendance Active');

insert into public.outlets (
  id, code, name, address, latitude, longitude, geofence_radius_m
)
values (
  '73000000-0000-0000-0000-000000000001',
  'ATT-A',
  'Attendance Outlet A',
  'Alamat Attendance',
  -6.200000,
  106.800000,
  100
);

insert into public.employees (
  id, nik, full_name, joined_at, employment_status_id, job_position_id
)
values
  (
    '74000000-0000-0000-0000-000000000001',
    'RK-2096-901',
    'Attendance Cashier',
    current_date,
    '72000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001'
  ),
  (
    '74000000-0000-0000-0000-000000000002',
    'RK-2096-902',
    'Attendance Supervisor',
    current_date,
    '72000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000002'
  ),
  (
    '74000000-0000-0000-0000-000000000003',
    'RK-2096-903',
    'Attendance Management',
    current_date,
    '72000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000002'
  );

insert into public.employee_placements (
  employee_id, outlet_id, start_date, is_primary, change_reason
)
values
  ('74000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', current_date, true, 'Test'),
  ('74000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000001', current_date, true, 'Test'),
  ('74000000-0000-0000-0000-000000000003', '73000000-0000-0000-0000-000000000001', current_date, true, 'Test');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('75000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'att-cashier@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('75000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'att-supervisor@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('75000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'att-management@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.user_accounts (
  user_id, employee_id, access_role, account_status, must_change_password
)
values
  ('75000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', 'employee', 'active', false),
  ('75000000-0000-0000-0000-000000000002', '74000000-0000-0000-0000-000000000002', 'supervisor', 'active', false),
  ('75000000-0000-0000-0000-000000000003', '74000000-0000-0000-0000-000000000003', 'management', 'active', false);

insert into public.outlet_shift_templates (
  id, outlet_id, shift_type, starts_at, ends_at
)
values (
  '76000000-0000-0000-0000-000000000001',
  '73000000-0000-0000-0000-000000000001',
  'morning',
  ((now() at time zone 'Asia/Jakarta') - interval '1 hour')::time,
  ((now() at time zone 'Asia/Jakarta') + interval '7 hours')::time
);

insert into public.roster_periods (
  id, month_start, status, publish_deadline
)
values (
  '77000000-0000-0000-0000-000000000001',
  date_trunc('month', current_date)::date,
  'published',
  current_date
);

insert into public.roster_versions (
  id, roster_period_id, version_number, status, created_by, published_at, published_by
)
values (
  '78000000-0000-0000-0000-000000000001',
  '77000000-0000-0000-0000-000000000001',
  1,
  'draft',
  '75000000-0000-0000-0000-000000000002',
  null,
  null
);

insert into public.schedule_assignments (
  id, roster_version_id, employee_id, outlet_id, shift_template_id,
  work_date, planned_start, planned_end, planned_duration_min
)
values (
  '79000000-0000-0000-0000-000000000001',
  '78000000-0000-0000-0000-000000000001',
  '74000000-0000-0000-0000-000000000001',
  '73000000-0000-0000-0000-000000000001',
  '76000000-0000-0000-0000-000000000001',
  (now() at time zone 'Asia/Jakarta')::date,
  ((now() at time zone 'Asia/Jakarta') - interval '1 hour')::time,
  ((now() at time zone 'Asia/Jakarta') + interval '7 hours')::time,
  480
);

update public.roster_versions
set
  status = 'published',
  published_at = now(),
  published_by = '75000000-0000-0000-0000-000000000002'
where id = '78000000-0000-0000-0000-000000000001';

update public.roster_periods
set active_version_id = '78000000-0000-0000-0000-000000000001'
where id = '77000000-0000-0000-0000-000000000001';

select set_config('request.jwt.claim.sub', '75000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select extensions.throws_ok(
  $$select public.clock_in_attendance(
    '7a000000-0000-0000-0000-000000000003',
    '73000000-0000-0000-0000-000000000001',
    -6.2, 106.8, 10, now(), false, null, null
  )$$,
  '42501',
  'Akun ini tidak dapat melakukan presensi.',
  'management cannot clock in'
);
select extensions.throws_ok(
  $$select public.preview_attendance_geofence(
    '73000000-0000-0000-0000-000000000001',
    -6.2, 106.8, 10, now()
  )$$,
  '42501',
  'Akun ini tidak dapat memeriksa geofence presensi.',
  'management cannot preview attendance geofence'
);

reset role;
select set_config('request.jwt.claim.sub', '75000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select extensions.is(
  (
    public.preview_attendance_geofence(
      '73000000-0000-0000-0000-000000000001',
      -6.2, 106.8, 10, now()
    )->>'within_geofence'
  )::boolean,
  true,
  'supervisor receives a server-calculated geofence preview'
);
select extensions.throws_ok(
  $$select public.clock_in_attendance(
    '7a000000-0000-0000-0000-000000000001',
    '73000000-0000-0000-0000-000000000001',
    -6.2, 106.8, 10, now(), false, null, null
  )$$,
  '23514',
  'Selfie dari kamera wajib tersedia saat clock-in.',
  'cashier clock-in requires a live selfie'
);
select extensions.is(
  count(*)::integer,
  0,
  'rejected cashier clock-in creates no record'
) from public.attendance_records
where employee_id = '74000000-0000-0000-0000-000000000001';

reset role;
select set_config('request.jwt.claim.sub', '75000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select extensions.throws_ok(
  $$select public.clock_in_attendance(
    '7a000000-0000-0000-0000-000000000002',
    '73000000-0000-0000-0000-000000000001',
    -6.21, 106.81, 10, now(), false, null, null
  )$$,
  '22023',
  null,
  'clock-in outside the outlet geofence is rejected'
);
select extensions.throws_ok(
  $$select public.clock_in_attendance(
    '7a000000-0000-0000-0000-000000000002',
    '73000000-0000-0000-0000-000000000001',
    -6.2, 106.8, 150, now(), false, null, null
  )$$,
  '22023',
  null,
  'clock-in with poor GPS accuracy is rejected'
);
select extensions.lives_ok(
  $$select public.clock_in_attendance(
    '7a000000-0000-0000-0000-000000000002',
    '73000000-0000-0000-0000-000000000001',
    -6.2, 106.8, 10, now(), true, null, 'Supervisor test'
  )$$,
  'supervisor can clock in at an active outlet without schedule or selfie'
);
select extensions.is(
  (select clock_in_state from public.attendance_records where id = '7a000000-0000-0000-0000-000000000002'),
  'flexible',
  'supervisor clock-in is marked flexible'
);
select extensions.lives_ok(
  $$select public.clock_in_attendance(
    '7a000000-0000-0000-0000-000000000002',
    '73000000-0000-0000-0000-000000000001',
    -6.2, 106.8, 10, now(), true, null, 'Retry'
  )$$,
  'retry with the same event id is idempotent'
);
select extensions.is(
  count(*)::integer,
  1,
  'idempotent retry creates one open session'
) from public.attendance_records
where employee_id = '74000000-0000-0000-0000-000000000002';
select extensions.lives_ok(
  $$select public.clock_out_attendance(
    '7a000000-0000-0000-0000-000000000002',
    -6.2, 106.8, 10, now(), false
  )$$,
  'clock-out closes the session without selfie'
);
select extensions.is(
  (select attendance_status::text from public.attendance_records where id = '7a000000-0000-0000-0000-000000000002'),
  'completed',
  'clock-out marks attendance completed'
);
select extensions.ok(
  (select worked_duration_min is not null from public.attendance_records where id = '7a000000-0000-0000-0000-000000000002'),
  'clock-out calculates worked duration'
);

reset role;
insert into public.attendance_records (
  id,
  employee_id,
  outlet_id,
  work_date,
  clock_in_at,
  clock_out_at,
  clock_in_latitude,
  clock_in_longitude,
  clock_in_accuracy_m,
  clock_in_distance_m,
  clock_in_state,
  clock_out_latitude,
  clock_out_longitude,
  clock_out_accuracy_m,
  clock_out_distance_m,
  clock_out_state,
  attendance_status,
  worked_duration_min
)
values (
  '7a000000-0000-0000-0000-000000000004',
  '74000000-0000-0000-0000-000000000001',
  '73000000-0000-0000-0000-000000000001',
  current_date,
  now() - interval '8 hours',
  now(),
  -6.2,
  106.8,
  10,
  0,
  'on_time',
  -6.2,
  106.8,
  10,
  0,
  'complete',
  'completed',
  480
);

insert into public.attendance_evidence (
  id,
  attendance_record_id,
  evidence_type,
  storage_path,
  mime_type,
  size_bytes
)
values (
  '7b000000-0000-0000-0000-000000000001',
  '7a000000-0000-0000-0000-000000000004',
  'clock_in_selfie',
  '74000000-0000-0000-0000-000000000001/2096/01/01/evidence.jpg',
  'image/jpeg',
  1024
);

select extensions.ok(
  exists (
    select 1
    from public.attendance_evidence evidence
    join public.file_deletion_jobs job on job.evidence_id = evidence.id
    where evidence.id = '7b000000-0000-0000-0000-000000000001'
      and evidence.retention_status = 'scheduled_for_deletion'
      and job.status = 'scheduled'
      and job.deletion_reason = 'attendance_selfie_seven_day_retention'
      and job.scheduled_for = evidence.uploaded_at + interval '7 days'
  ),
  'clock-in selfie atomically receives a seven-day retention job'
);

select set_config('request.jwt.claim.sub', '75000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select extensions.throws_ok(
  $$select public.validate_attendance(
    '7a000000-0000-0000-0000-000000000004',
    'approved',
    'Tidak berwenang',
    1
  )$$,
  'P0001',
  'Only supervisors can validate attendance',
  'employee cannot validate attendance'
);

reset role;
select set_config('request.jwt.claim.sub', '75000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select extensions.is(
  (
    public.validate_attendance(
      '7a000000-0000-0000-0000-000000000004',
      'approved',
      'Data presensi sesuai',
      1
    )
  ).validation_status::text,
  'approved',
  'supervisor validates completed employee attendance'
);
select extensions.ok(
  exists (
    select 1
    from public.file_deletion_jobs
    where evidence_id = '7b000000-0000-0000-0000-000000000001'
      and status = 'scheduled'
      and deletion_reason = 'attendance_selfie_seven_day_retention'
      and not exists (
        select 1
        from public.file_deletion_jobs obsolete_job
        where obsolete_job.evidence_id
          = '7b000000-0000-0000-0000-000000000001'
          and obsolete_job.deletion_reason in (
            'attendance_approved',
            'attendance_rejected_retention_limit'
          )
      )
  ),
  'approval preserves the original seven-day selfie retention schedule'
);
select extensions.throws_ok(
  $$select public.validate_attendance(
    '7a000000-0000-0000-0000-000000000004',
    'rejected',
    'Keputusan kedua',
    1
  )$$,
  'P0001',
  'Attendance record has already changed',
  'attendance validation is first-write-wins'
);

reset role;
update public.file_deletion_jobs
set
  status = 'processing',
  attempt_count = 1
where evidence_id = '7b000000-0000-0000-0000-000000000001';

select id as deletion_job_id
from public.file_deletion_jobs
where evidence_id = '7b000000-0000-0000-0000-000000000001'
\gset

select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;
select extensions.lives_ok(
  format(
    $$select public.complete_attendance_file_deletion_job(%L, now())$$,
    :'deletion_job_id'
  ),
  'service worker finalizes deletion metadata and audit atomically'
);

reset role;
select extensions.ok(
  (
    select evidence.retention_status = 'deleted'
      and evidence.deleted_at is not null
      and job.status = 'completed'
      and job.completed_at is not null
      and exists (
        select 1
        from public.audit_logs audit
        where audit.entity_type = 'file_deletion_job'
          and audit.entity_id = job.id
          and audit.action = 'delete_storage_object'
      )
    from public.attendance_evidence evidence
    join public.file_deletion_jobs job on job.evidence_id = evidence.id
    where evidence.id = '7b000000-0000-0000-0000-000000000001'
  ),
  'completed deletion preserves atomic job, evidence, and audit state'
);

select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;
select extensions.lives_ok(
  format(
    $$select public.complete_attendance_file_deletion_job(%L, now())$$,
    :'deletion_job_id'
  ),
  'repeating deletion completion is idempotent'
);

\else

select extensions.skip(22, 'database role cannot seed attendance fixtures');

\endif

select * from extensions.finish();
rollback;
