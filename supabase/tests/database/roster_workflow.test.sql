begin;

set local search_path = extensions, public, pg_catalog;

select extensions.plan(38);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.save_manual_roster_assignment(date,uuid,date,uuid,public.shift_type,public.schedule_status,text,text,date,boolean)',
    'execute'
  ),
  'anonymous cannot save manual roster assignments'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.get_monthly_roster(date)',
    'execute'
  ),
  'anonymous cannot read roster through the RPC'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.publish_manual_roster(uuid,text)',
    'execute'
  ),
  'anonymous cannot publish a roster'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.acknowledge_monthly_roster(date)',
    'execute'
  ),
  'anonymous cannot acknowledge a roster'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.roster_periods', 'insert'),
  'authenticated clients cannot insert roster periods directly'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.roster_versions', 'insert'),
  'authenticated clients cannot insert roster versions directly'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.schedule_assignments',
    'update'
  ),
  'authenticated clients cannot update schedule assignments directly'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.employee_off_days',
    'insert'
  ),
  'authenticated clients cannot insert off days directly'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.backup_assignments',
    'insert'
  ),
  'authenticated clients cannot insert backup assignments directly'
);
select extensions.ok(
  not has_table_privilege(
    'authenticated',
    'public.schedule_acknowledgements',
    'insert'
  ),
  'authenticated clients cannot insert acknowledgements directly'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.get_shift_swap_options(uuid)',
    'execute'
  ),
  'anonymous cannot list shift swap options'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.request_shift_swap(uuid,uuid,text)',
    'execute'
  ),
  'anonymous cannot request a shift swap'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.decide_shift_swap_colleague(uuid,text,text)',
    'execute'
  ),
  'anonymous cannot decide a shift swap as colleague'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.decide_shift_swap_supervisor(uuid,text,text)',
    'execute'
  ),
  'anonymous cannot decide a shift swap as supervisor'
);

select has_table_privilege(
  current_user,
  'public.job_positions',
  'insert'
) as can_seed_roster_fixtures
\gset

\if :can_seed_roster_fixtures

insert into public.job_positions (
  id,
  code,
  name,
  auto_roster_eligible
)
values
  (
    '61000000-0000-0000-0000-000000000001',
    'ROSTER-CASHIER',
    'Kasir Roster Test',
    true
  ),
  (
    '61000000-0000-0000-0000-000000000002',
    'ROSTER-SUPERVISOR',
    'Supervisor Roster Test',
    false
  );

insert into public.employment_statuses (id, code, name)
values (
  '62000000-0000-0000-0000-000000000001',
  'ROSTER-ACTIVE',
  'Roster Active'
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
    '63000000-0000-0000-0000-000000000001',
    'ROSTER-A',
    'Roster Outlet A',
    'Alamat Roster A',
    -6.2,
    106.8
  ),
  (
    '63000000-0000-0000-0000-000000000002',
    'ROSTER-B',
    'Roster Outlet B',
    'Alamat Roster B',
    -6.3,
    106.9
  );

insert into public.outlet_shift_templates (
  id,
  outlet_id,
  shift_type,
  starts_at,
  ends_at
)
values
  (
    '64000000-0000-0000-0000-000000000001',
    '63000000-0000-0000-0000-000000000001',
    'morning',
    '07:00',
    '15:00'
  ),
  (
    '64000000-0000-0000-0000-000000000002',
    '63000000-0000-0000-0000-000000000001',
    'middle',
    '12:00',
    '20:00'
  ),
  (
    '64000000-0000-0000-0000-000000000003',
    '63000000-0000-0000-0000-000000000001',
    'night',
    '15:00',
    '23:00'
  ),
  (
    '64000000-0000-0000-0000-000000000004',
    '63000000-0000-0000-0000-000000000002',
    'morning',
    '08:00',
    '16:00'
  ),
  (
    '64000000-0000-0000-0000-000000000005',
    '63000000-0000-0000-0000-000000000002',
    'middle',
    '11:00',
    '19:00'
  ),
  (
    '64000000-0000-0000-0000-000000000006',
    '63000000-0000-0000-0000-000000000002',
    'night',
    '14:00',
    '22:00'
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
    '65000000-0000-0000-0000-000000000001',
    'RK-2097-001',
    'Roster Cashier',
    '2097-01-01',
    '62000000-0000-0000-0000-000000000001',
    '61000000-0000-0000-0000-000000000001'
  ),
  (
    '65000000-0000-0000-0000-000000000002',
    'RK-2097-002',
    'Roster Supervisor',
    '2097-01-01',
    '62000000-0000-0000-0000-000000000001',
    '61000000-0000-0000-0000-000000000002'
  ),
  (
    '65000000-0000-0000-0000-000000000003',
    'RK-2097-003',
    'Roster Management',
    '2097-01-01',
    '62000000-0000-0000-0000-000000000001',
    '61000000-0000-0000-0000-000000000002'
  ),
  (
    '65000000-0000-0000-0000-000000000004',
    'RK-2097-004',
    'Roster Colleague',
    '2097-01-01',
    '62000000-0000-0000-0000-000000000001',
    '61000000-0000-0000-0000-000000000001'
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
    '65000000-0000-0000-0000-000000000001',
    '63000000-0000-0000-0000-000000000001',
    '2097-01-01',
    true,
    'Roster fixture'
  ),
  (
    '65000000-0000-0000-0000-000000000002',
    '63000000-0000-0000-0000-000000000001',
    '2097-01-01',
    true,
    'Roster fixture'
  ),
  (
    '65000000-0000-0000-0000-000000000003',
    '63000000-0000-0000-0000-000000000001',
    '2097-01-01',
    true,
    'Roster fixture'
  ),
  (
    '65000000-0000-0000-0000-000000000004',
    '63000000-0000-0000-0000-000000000001',
    '2097-01-01',
    true,
    'Roster fixture'
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
    '66000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'roster-employee@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '66000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'roster-supervisor@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '66000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'roster-management@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '66000000-0000-0000-0000-000000000004',
    'authenticated',
    'authenticated',
    'roster-colleague@example.invalid',
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
    '66000000-0000-0000-0000-000000000001',
    '65000000-0000-0000-0000-000000000001',
    'employee',
    'active',
    false
  ),
  (
    '66000000-0000-0000-0000-000000000002',
    '65000000-0000-0000-0000-000000000002',
    'supervisor',
    'active',
    false
  ),
  (
    '66000000-0000-0000-0000-000000000003',
    '65000000-0000-0000-0000-000000000003',
    'management',
    'active',
    false
  ),
  (
    '66000000-0000-0000-0000-000000000004',
    '65000000-0000-0000-0000-000000000004',
    'employee',
    'active',
    false
  );

select set_config(
  'request.jwt.claim.sub',
  '66000000-0000-0000-0000-000000000002',
  true
);
set local role authenticated;

select extensions.ok(
  public.get_monthly_roster('2097-02-01')->'period' = 'null'::jsonb
    and jsonb_array_length(
      public.get_monthly_roster('2097-02-01')->'employees'
    ) = 4,
  'supervisor can select employees before the monthly roster period exists'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '66000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.save_manual_roster_assignment(
    '2097-02-01',
    '65000000-0000-0000-0000-000000000001',
    '2097-02-01',
    '63000000-0000-0000-0000-000000000001',
    'morning',
    'scheduled',
    'primary',
    'Blocked employee change'
  )$$,
  'P0001',
  'Hanya supervisor yang dapat mengubah roster',
  'employee cannot save a roster assignment'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '66000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.save_manual_roster_assignment(
    '2097-02-01',
    '65000000-0000-0000-0000-000000000001',
    '2097-02-01',
    '63000000-0000-0000-0000-000000000001',
    'morning',
    'scheduled',
    'primary',
    'Blocked management change'
  )$$,
  'P0001',
  'Hanya supervisor yang dapat mengubah roster',
  'management remains read-only for roster changes'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '66000000-0000-0000-0000-000000000002',
  true
);
set local role authenticated;

select extensions.lives_ok(
  $$select public.save_manual_roster_assignment(
    '2097-02-01',
    '65000000-0000-0000-0000-000000000001',
    '2097-02-01',
    '63000000-0000-0000-0000-000000000001',
    'morning',
    'scheduled',
    'primary',
    'Menyusun jadwal awal'
  )$$,
  'supervisor creates the first manual draft assignment'
);

select extensions.is(
  jsonb_array_length(
    public.get_monthly_roster('2097-02-01')->'assignments'
  ),
  1,
  'saving an assignment creates a draft version and schedule row'
);

select extensions.throws_ok(
  $$select public.save_manual_roster_assignment(
    '2097-02-01',
    '65000000-0000-0000-0000-000000000001',
    '2097-02-08',
    null,
    null,
    'off',
    'primary',
    'Invalid borrowed off',
    (date_trunc('week', '2097-02-08'::date) + interval '3 weeks')::date,
    true
  )$$,
  'P0001',
  'Off day hanya dapat dipinjam dari pekan bersebelahan',
  'off allocation cannot be borrowed from a non-adjacent week'
);

select extensions.lives_ok(
  $$select public.save_manual_roster_assignment(
    '2097-02-01',
    '65000000-0000-0000-0000-000000000001',
    '2097-02-08',
    null,
    null,
    'off',
    'primary',
    'Meminjam off pekan berikutnya',
    (date_trunc('week', '2097-02-08'::date) + interval '1 week')::date,
    true
  )$$,
  'supervisor can borrow an off allocation from an adjacent week'
);

select extensions.ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_monthly_roster('2097-02-01')->'off_days'
    ) off_day
    where (off_day->>'employee_id')::uuid
      = '65000000-0000-0000-0000-000000000001'
      and (off_day->>'source_week_start')::date
        = (date_trunc('week', '2097-02-08'::date) + interval '1 week')::date
      and (off_day->>'borrowed_from_adjacent_week')::boolean
  ),
  'borrowed off day is recorded in the allocation ledger'
);

select extensions.lives_ok(
  $$select public.save_manual_roster_assignment(
    '2097-02-01',
    '65000000-0000-0000-0000-000000000001',
    '2097-02-02',
    '63000000-0000-0000-0000-000000000002',
    'morning',
    'scheduled',
    'backup',
    'Membantu outlet lain'
  )$$,
  'supervisor can create a manual backup assignment'
);

select extensions.is(
  (
    select count(*)::integer
    from jsonb_array_elements(
      public.get_monthly_roster('2097-02-01')->'assignments'
    ) assignment
    where assignment->>'assignment_type' = 'backup'
      and (assignment->>'outlet_id')::uuid
        = '63000000-0000-0000-0000-000000000002'
  ),
  1,
  'backup assignment preserves origin and destination outlets'
);

select (
  public.get_monthly_roster('2097-02-01')->'version'->>'id'
) as draft_version_id
\gset

select extensions.throws_ok(
  format(
    $$select public.publish_manual_roster(%L, 'Roster belum lengkap')$$,
    :'draft_version_id'
  ),
  'P0001',
  'Roster belum lengkap: 3 dari 84 penugasan harian terisi',
  'incomplete monthly roster cannot be published'
);

reset role;

insert into public.schedule_assignments (
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
select
  :'draft_version_id'::uuid,
  employee_id,
  '63000000-0000-0000-0000-000000000001',
  '64000000-0000-0000-0000-000000000001',
  work_date,
  'primary',
  '07:00',
  '15:00',
  480,
  'scheduled'
from (
  select
    employee.id as employee_id,
    day_value::date as work_date
  from public.employees employee
  cross join generate_series(
    '2097-02-01'::date,
    '2097-02-28'::date,
    interval '1 day'
  ) day_value
  where employee.id in (
    '65000000-0000-0000-0000-000000000001',
    '65000000-0000-0000-0000-000000000002',
    '65000000-0000-0000-0000-000000000004'
  )
) expected
on conflict (roster_version_id, employee_id, work_date)
do update set
  outlet_id = excluded.outlet_id,
  shift_template_id = excluded.shift_template_id,
  assignment_type = excluded.assignment_type,
  planned_start = excluded.planned_start,
  planned_end = excluded.planned_end,
  planned_duration_min = excluded.planned_duration_min,
  status = excluded.status;

insert into public.employee_off_days (
  roster_period_id,
  employee_id,
  off_date,
  source_week_start,
  set_by
)
select
  period.id,
  cashier.employee_id,
  greatest('2097-02-01'::date, week_start),
  week_start,
  '66000000-0000-0000-0000-000000000002'
from public.roster_periods period
cross join (
  values
    ('65000000-0000-0000-0000-000000000001'::uuid),
    ('65000000-0000-0000-0000-000000000004'::uuid)
) cashier(employee_id)
cross join (
  select distinct date_trunc('week', day_value)::date as week_start
  from generate_series(
    '2097-02-01'::date,
    '2097-02-28'::date,
    interval '1 day'
  ) day_value
) weeks
where period.month_start = '2097-02-01'
on conflict (roster_period_id, employee_id, source_week_start)
do update set
  off_date = excluded.off_date,
  borrowed_from_adjacent_week = false,
  override_reason = null,
  set_by = excluded.set_by;

update public.schedule_assignments assignment
set
  shift_template_id = null,
  planned_start = null,
  planned_end = null,
  planned_duration_min = 0,
  status = 'off'
from public.employee_off_days off_day
where assignment.roster_version_id = :'draft_version_id'::uuid
  and assignment.employee_id = off_day.employee_id
  and assignment.work_date = off_day.off_date;

insert into public.schedule_overrides (
  schedule_assignment_id,
  before_values,
  after_values,
  reason,
  changed_by
)
select
  assignment.id,
  '{}'::jsonb,
  to_jsonb(assignment),
  'Override fixture untuk validasi pola off',
  '66000000-0000-0000-0000-000000000002'
from public.schedule_assignments assignment
where assignment.roster_version_id = :'draft_version_id'::uuid;

update public.schedule_assignments
set
  shift_template_id = '64000000-0000-0000-0000-000000000003',
  planned_start = '15:00',
  planned_end = '23:00'
where roster_version_id = :'draft_version_id'::uuid
  and employee_id = '65000000-0000-0000-0000-000000000004'
  and work_date = '2097-02-05';

select set_config(
  'request.jwt.claim.sub',
  '66000000-0000-0000-0000-000000000002',
  true
);
set local role authenticated;

select extensions.lives_ok(
  format(
    $$select public.publish_manual_roster(%L, 'Publikasi roster lengkap')$$,
    :'draft_version_id'
  ),
  'complete roster publishes atomically'
);

select extensions.ok(
  public.get_monthly_roster('2097-02-01')->'period'->>'status' = 'published'
    and (
      public.get_monthly_roster('2097-02-01')
        ->'period'->>'active_version_id'
    )::uuid = :'draft_version_id'::uuid,
  'publication activates the version on the roster period'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '66000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select extensions.is(
  jsonb_array_length(
    public.get_monthly_roster('2097-02-01')->'employees'
  ),
  0,
  'employee roster response does not expose management employee identifiers'
);

select extensions.lives_ok(
  $$select public.acknowledge_monthly_roster('2097-02-01')$$,
  'employee can acknowledge the active monthly roster'
);

reset role;

select extensions.is(
  (
    select count(*)::integer
    from public.schedule_acknowledgements acknowledgement
    join public.schedule_assignments assignment
      on assignment.id = acknowledgement.schedule_assignment_id
    where acknowledgement.employee_id
      = '65000000-0000-0000-0000-000000000001'
      and assignment.roster_version_id = :'draft_version_id'::uuid
  ),
  28,
  'acknowledgement records every own assignment in the active version'
);

select set_config(
  'request.jwt.claim.sub',
  '66000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select (
  select assignment->>'id'
  from jsonb_array_elements(
    public.get_monthly_roster('2097-02-01')->'assignments'
  ) assignment
  where (assignment->>'is_own')::boolean
    and (assignment->>'work_date')::date = '2097-02-03'
) as requester_schedule_id
\gset

select (
  select option->>'schedule_id'
  from jsonb_array_elements(
    public.get_shift_swap_options(:'requester_schedule_id'::uuid)
  ) option
  where option->>'employee_name' = 'Roster Colleague'
    and (option->>'work_date')::date = '2097-02-05'
) as colleague_schedule_id
\gset

select (
  public.request_shift_swap(
    :'requester_schedule_id'::uuid,
    :'colleague_schedule_id'::uuid,
    'Bertukar jadwal untuk kebutuhan pribadi'
  )->>'request_id'
) as swap_request_id
\gset

select extensions.ok(
  :'swap_request_id'::uuid is not null,
  'employee can request a swap with an eligible cashier in the same outlet'
);

select extensions.throws_ok(
  format(
    $$select public.request_shift_swap(%L, %L, 'Permintaan duplikat')$$,
    :'requester_schedule_id',
    :'colleague_schedule_id'
  ),
  '23505',
  null,
  'one requester schedule cannot have two open swap requests'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '66000000-0000-0000-0000-000000000004',
  true
);
set local role authenticated;

select extensions.is(
  (
    public.decide_shift_swap_colleague(
      :'swap_request_id'::uuid,
      'accept',
      'Saya menyetujui pertukaran'
    )->>'status'
  ),
  'pending_supervisor',
  'colleague acceptance advances the request to supervisor review'
);

select extensions.throws_ok(
  format(
    $$select public.decide_shift_swap_colleague(%L, 'reject', 'Terlambat')$$,
    :'swap_request_id'
  ),
  'P0001',
  'Permintaan pertukaran sudah diputuskan atau berubah',
  'colleague decision is first-write-wins'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '66000000-0000-0000-0000-000000000002',
  true
);
set local role authenticated;

select extensions.is(
  (
    public.decide_shift_swap_supervisor(
      :'swap_request_id'::uuid,
      'approve',
      'Pertukaran valid dan kebutuhan outlet tetap aman'
    )->>'status'
  ),
  'approved',
  'supervisor approval publishes a new roster version atomically'
);

select extensions.is(
  (
    public.get_monthly_roster('2097-02-01')
      ->'version'->>'version_number'
  )::integer,
  2,
  'approved swap activates roster version two'
);

select extensions.ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.get_monthly_roster('2097-02-01')->'assignments'
    ) assignment
    where (assignment->>'employee_id')::uuid
      = '65000000-0000-0000-0000-000000000001'
      and (assignment->>'work_date')::date = '2097-02-03'
      and assignment->>'shift_type' = 'night'
  ),
  'new roster version applies the colleague shift to the requester'
);

select extensions.throws_ok(
  format(
    $$select public.decide_shift_swap_supervisor(
      %L,
      'reject',
      'Keputusan kedua'
    )$$,
    :'swap_request_id'
  ),
  'P0001',
  'Permintaan pertukaran tidak menunggu keputusan supervisor',
  'supervisor decision is first-write-wins'
);

\else

select extensions.skip(
  'fixture creation requires local postgres privileges',
  24
);

\endif

select * from extensions.finish();

rollback;
