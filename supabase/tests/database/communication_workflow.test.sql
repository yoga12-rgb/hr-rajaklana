begin;

set local search_path = extensions, public, pg_catalog;

select extensions.plan(24);

set local role anon;
select extensions.throws_ok(
  'select public.get_communication_workspace()',
  '42501',
  null,
  'anonymous cannot open communication workspace'
);
reset role;

select extensions.ok(
  not has_table_privilege('authenticated', 'public.announcements', 'insert'),
  'authenticated users cannot bypass announcement RPC'
);

select has_table_privilege(
  current_user,
  'public.job_positions',
  'insert'
) as can_seed_communication_fixtures
\gset

\if :can_seed_communication_fixtures

insert into public.job_positions (id, code, name, auto_roster_eligible)
values (
  '91000000-0000-0000-0000-000000000001',
  'COMM-TEST',
  'Communication Test',
  false
);

insert into public.employment_statuses (id, code, name)
values (
  '92000000-0000-0000-0000-000000000001',
  'COMM-TEST',
  'Communication Test'
);

insert into public.outlets (
  id, code, name, address, latitude, longitude, geofence_radius_m
)
values (
  '93000000-0000-0000-0000-000000000001',
  'COMM-01',
  'Area Komunikasi',
  'Alamat pengujian',
  -6.200000,
  106.800000,
  100
);

insert into public.employees (
  id, nik, full_name, joined_at, employment_status_id, job_position_id
)
values
  (
    '94000000-0000-0000-0000-000000000001',
    'RK-2094-901',
    'Communication Employee One',
    current_date,
    '92000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001'
  ),
  (
    '94000000-0000-0000-0000-000000000002',
    'RK-2094-902',
    'Communication Employee Two',
    current_date,
    '92000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001'
  ),
  (
    '94000000-0000-0000-0000-000000000003',
    'RK-2094-903',
    'Communication Supervisor',
    current_date,
    '92000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001'
  ),
  (
    '94000000-0000-0000-0000-000000000004',
    'RK-2094-904',
    'Communication Management',
    current_date,
    '92000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001'
  );

insert into public.employee_placements (
  employee_id, outlet_id, start_date, is_primary, change_reason
)
select
  employee_id,
  '93000000-0000-0000-0000-000000000001',
  current_date,
  true,
  'Pengujian komunikasi'
from unnest(array[
  '94000000-0000-0000-0000-000000000001'::uuid,
  '94000000-0000-0000-0000-000000000002'::uuid,
  '94000000-0000-0000-0000-000000000003'::uuid,
  '94000000-0000-0000-0000-000000000004'::uuid
]) as employee_id;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('95000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'comm-employee-one@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('95000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'comm-employee-two@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('95000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'comm-supervisor@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('95000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'comm-management@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.user_accounts (
  user_id, employee_id, access_role, account_status, must_change_password
)
values
  ('95000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000001', 'employee', 'active', false),
  ('95000000-0000-0000-0000-000000000002', '94000000-0000-0000-0000-000000000002', 'employee', 'active', false),
  ('95000000-0000-0000-0000-000000000003', '94000000-0000-0000-0000-000000000003', 'supervisor', 'active', false),
  ('95000000-0000-0000-0000-000000000004', '94000000-0000-0000-0000-000000000004', 'management', 'active', false);

select set_config(
  'request.jwt.claim.sub',
  '95000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.is(
  (public.create_announcement(
    'Pengumuman Semua',
    'Informasi untuk seluruh perusahaan.',
    'Operasional',
    true,
    true,
    'all',
    null,
    null
  )->>'recipient_count')::integer,
  4,
  'all target materializes every active account as a recipient'
);

select extensions.is(
  (public.create_announcement(
    'Pengumuman Khusus',
    'Informasi khusus employee one.',
    'Info K3',
    false,
    false,
    'employee',
    '94000000-0000-0000-0000-000000000001',
    null
  )->>'recipient_count')::integer,
  1,
  'employee target materializes only the selected recipient'
);

reset role;

select extensions.is(
  (
    select count(*)::integer
    from public.announcement_targets
    where announcement_id = (
      select id from public.announcements where title = 'Pengumuman Semua'
    )
  ),
  1,
  'announcement stores one explicit target'
);

select extensions.is(
  (
    select count(*)::integer
    from public.announcement_receipts
    where announcement_id = (
      select id from public.announcements where title = 'Pengumuman Semua'
    )
  ),
  4,
  'all announcement stores durable recipient receipts'
);

select extensions.is(
  (
    select count(*)::integer
    from public.notifications
    where subject_id = (
      select id from public.announcements where title = 'Pengumuman Semua'
    )
  ),
  4,
  'all announcement creates one in-app notification per recipient'
);

select extensions.is(
  (
    select count(*)::integer
    from public.notification_receipts receipt
    join public.notifications notification
      on notification.id = receipt.notification_id
    where notification.subject_id = (
      select id from public.announcements where title = 'Pengumuman Semua'
    )
  ),
  4,
  'created notifications have durable read receipts'
);

select set_config(
  'request.jwt.claim.sub',
  '95000000-0000-0000-0000-000000000003',
  true
);
set local role authenticated;

select extensions.is(
  public.get_communication_workspace()->>'role',
  'supervisor',
  'supervisor workspace resolves its role'
);

select extensions.is(
  jsonb_array_length(public.get_communication_workspace()->'target_employees'),
  4,
  'supervisor receives active employee target options'
);

select extensions.is(
  jsonb_array_length(public.get_communication_workspace()->'target_outlets'),
  1,
  'supervisor receives active outlet target options'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '95000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select extensions.is(
  jsonb_array_length(public.get_communication_workspace()->'announcements'),
  2,
  'selected employee sees all and employee-targeted announcements'
);

select extensions.is(
  (public.get_communication_workspace()->>'unread_count')::integer,
  2,
  'selected employee sees durable unread notification count'
);

select extensions.lives_ok(
  format(
    'select public.mark_notification_read(%L::uuid)',
    (
      select id
      from public.notifications
      where employee_id = '94000000-0000-0000-0000-000000000001'
        and subject_id = (
          select id from public.announcements where title = 'Pengumuman Semua'
        )
    )
  ),
  'employee can mark an own notification as read'
);

select extensions.ok(
  (
    select receipt.in_app_read_at is not null
    from public.notification_receipts receipt
    join public.notifications notification
      on notification.id = receipt.notification_id
    where notification.employee_id = '94000000-0000-0000-0000-000000000001'
      and notification.subject_id = (
        select id from public.announcements where title = 'Pengumuman Semua'
      )
  ),
  'mark read persists notification receipt'
);

select extensions.lives_ok(
  format(
    'select public.acknowledge_announcement(%L::uuid)',
    (select id from public.announcements where title = 'Pengumuman Semua')
  ),
  'employee can acknowledge a visible required announcement'
);

select extensions.ok(
  (
    select acknowledged_at is not null
    from public.announcement_receipts
    where employee_id = '94000000-0000-0000-0000-000000000001'
      and announcement_id = (
        select id from public.announcements where title = 'Pengumuman Semua'
      )
  ),
  'acknowledgement persists on announcement receipt'
);

select extensions.throws_ok(
  $$select public.create_announcement(
    'Tidak Sah', 'Tidak Sah', 'Operasional', false, false, 'all', null, null
  )$$,
  '42501',
  'Hanya supervisor yang dapat membuat pengumuman.',
  'employee cannot create an announcement'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '95000000-0000-0000-0000-000000000002',
  true
);
set local role authenticated;

select extensions.is(
  jsonb_array_length(public.get_communication_workspace()->'announcements'),
  1,
  'unselected employee cannot see another employee targeted announcement'
);

select extensions.throws_ok(
  format(
    'select public.mark_notification_read(%L::uuid)',
    (
      select id
      from public.notifications
      where employee_id = '94000000-0000-0000-0000-000000000001'
      limit 1
    )
  ),
  'P0002',
  'Notifikasi tidak ditemukan.',
  'employee cannot mark another employee notification'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '95000000-0000-0000-0000-000000000004',
  true
);
set local role authenticated;

select extensions.is(
  public.get_communication_workspace()->>'role',
  'management',
  'management can open a read-only communication workspace'
);

select extensions.throws_ok(
  $$select public.create_announcement(
    'Tidak Sah', 'Tidak Sah', 'Operasional', false, false, 'all', null, null
  )$$,
  '42501',
  'Hanya supervisor yang dapat membuat pengumuman.',
  'management cannot create an announcement'
);

select extensions.throws_ok(
  'select public.mark_all_notifications_read()',
  '42501',
  'Peran ini tidak dapat mengubah status baca.',
  'management cannot mutate notification receipts'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'public.notifications', 'insert'),
  'authenticated users cannot bypass notification workflow'
);

reset role;

\else

select * from extensions.skip(
  'hosted CLI role cannot seed transactional communication fixtures',
  22
);

\endif

select * from extensions.finish();

rollback;
