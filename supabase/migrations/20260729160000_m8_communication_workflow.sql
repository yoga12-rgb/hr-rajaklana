-- M8 communication workspace: targeted announcements, durable read receipts,
-- acknowledgement, and a role-aware in-app notification center.

alter table public.announcements
  add column category text not null default 'Operasional';

alter table public.announcements
  add constraint announcements_category_supported
  check (
    category in (
      'Operasional',
      'Info K3',
      'Event Perusahaan',
      'Kebijakan HR'
    )
  );

create index announcements_active_timeline
  on public.announcements (is_pinned desc, published_at desc)
  where published_at is not null;

revoke insert, update, delete on public.announcements from authenticated;
revoke insert, update, delete on public.announcement_targets from authenticated;
revoke insert, update, delete on public.announcement_receipts from authenticated;
revoke insert, update, delete on public.notifications from authenticated;
revoke insert, update, delete on public.notification_receipts from authenticated;

create or replace function public.get_communication_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_role public.access_role := public.current_access_role();
  viewer_employee_id uuid := public.current_employee_id();
begin
  if viewer_role is null or viewer_employee_id is null then
    raise exception using
      errcode = '42501',
      message = 'Sesi pengguna tidak aktif.';
  end if;

  return jsonb_build_object(
    'role', viewer_role,
    'current_employee_id', viewer_employee_id,
    'unread_count', (
      select count(*)::integer
      from public.notifications notification
      join public.notification_receipts receipt
        on receipt.notification_id = notification.id
      where notification.employee_id = viewer_employee_id
        and receipt.in_app_read_at is null
    ),
    'notifications', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', notification.id,
          'notification_type', notification.notification_type,
          'title', notification.title,
          'body', notification.body,
          'subject_type', notification.subject_type,
          'subject_id', notification.subject_id,
          'payload', notification.payload,
          'created_at', notification.created_at,
          'read_at', receipt.in_app_read_at,
          'acknowledged_at', receipt.acknowledged_at
        )
        order by notification.created_at desc
      )
      from (
        select own_notification.*
        from public.notifications own_notification
        where own_notification.employee_id = viewer_employee_id
        order by own_notification.created_at desc
        limit 100
      ) notification
      join public.notification_receipts receipt
        on receipt.notification_id = notification.id
    ), '[]'::jsonb),
    'announcements', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', announcement.id,
          'title', announcement.title,
          'body', announcement.body,
          'category', announcement.category,
          'is_pinned', announcement.is_pinned,
          'acknowledgement_required',
            announcement.acknowledgement_required,
          'published_at', announcement.published_at,
          'expires_at', announcement.expires_at,
          'target_summary', coalesce((
            select string_agg(target_label.label, ', ' order by target_label.label)
            from (
              select case target.target_type
                when 'all' then 'Seluruh perusahaan'
                when 'outlet' then coalesce(
                  (
                    select outlet.name
                    from public.outlets outlet
                    where outlet.id = target.target_id
                  ),
                  'Outlet tidak tersedia'
                )
                when 'employee' then coalesce(
                  (
                    select employee.full_name
                    from public.employees employee
                    where employee.id = target.target_id
                  ),
                  'Pengguna tidak tersedia'
                )
              end as label
              from public.announcement_targets target
              where target.announcement_id = announcement.id
            ) target_label
          ), 'Target belum ditentukan'),
          'read_at', own_receipt.read_at,
          'acknowledged_at', own_receipt.acknowledged_at,
          'recipient_count', case
            when viewer_role in ('supervisor', 'management') then (
              select count(*)::integer
              from public.announcement_receipts receipt
              where receipt.announcement_id = announcement.id
            )
            else null
          end,
          'read_count', case
            when viewer_role in ('supervisor', 'management') then (
              select count(*)::integer
              from public.announcement_receipts receipt
              where receipt.announcement_id = announcement.id
                and receipt.read_at is not null
            )
            else null
          end,
          'acknowledged_count', case
            when viewer_role in ('supervisor', 'management') then (
              select count(*)::integer
              from public.announcement_receipts receipt
              where receipt.announcement_id = announcement.id
                and receipt.acknowledged_at is not null
            )
            else null
          end,
          'can_acknowledge',
            viewer_role in ('employee', 'supervisor')
            and announcement.acknowledgement_required
            and own_receipt.acknowledged_at is null
        )
        order by
          announcement.is_pinned desc,
          announcement.published_at desc
      )
      from public.announcements announcement
      left join public.announcement_receipts own_receipt
        on own_receipt.announcement_id = announcement.id
        and own_receipt.employee_id = viewer_employee_id
      where public.can_view_announcement(announcement.id)
        and announcement.published_at is not null
        and announcement.published_at <= now()
        and (
          announcement.expires_at is null
          or announcement.expires_at > now()
        )
    ), '[]'::jsonb),
    'target_outlets', case
      when viewer_role = 'supervisor' then coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', outlet.id,
            'name', outlet.name
          )
          order by outlet.name
        )
        from public.outlets outlet
        where outlet.is_active
      ), '[]'::jsonb)
      else '[]'::jsonb
    end,
    'target_employees', case
      when viewer_role = 'supervisor' then coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', employee.id,
            'name', employee.full_name
          )
          order by employee.full_name
        )
        from public.employees employee
        join public.user_accounts account
          on account.employee_id = employee.id
        where employee.archived_at is null
          and account.account_status = 'active'
      ), '[]'::jsonb)
      else '[]'::jsonb
    end
  );
end;
$$;

create or replace function public.create_announcement(
  p_title text,
  p_body text,
  p_category text,
  p_is_pinned boolean,
  p_acknowledgement_required boolean,
  p_target_type text,
  p_target_id uuid default null,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  announcement_row public.announcements%rowtype;
  recipient record;
  notification_id uuid;
  recipient_count integer := 0;
begin
  if not public.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'Hanya supervisor yang dapat membuat pengumuman.';
  end if;

  if length(trim(coalesce(p_title, ''))) < 3
    or length(trim(p_title)) > 160 then
    raise exception using
      errcode = '22023',
      message = 'Judul pengumuman harus 3 sampai 160 karakter.';
  end if;

  if length(trim(coalesce(p_body, ''))) < 3
    or length(trim(p_body)) > 5000 then
    raise exception using
      errcode = '22023',
      message = 'Isi pengumuman harus 3 sampai 5000 karakter.';
  end if;

  if p_category not in (
    'Operasional',
    'Info K3',
    'Event Perusahaan',
    'Kebijakan HR'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Kategori pengumuman tidak didukung.';
  end if;

  if p_target_type not in ('all', 'outlet', 'employee')
    or (p_target_type = 'all' and p_target_id is not null)
    or (p_target_type <> 'all' and p_target_id is null) then
    raise exception using
      errcode = '22023',
      message = 'Target pengumuman tidak valid.';
  end if;

  if p_expires_at is not null and p_expires_at <= now() then
    raise exception using
      errcode = '22023',
      message = 'Waktu kedaluwarsa harus berada di masa depan.';
  end if;

  if p_target_type = 'outlet' and not exists (
    select 1
    from public.outlets outlet
    where outlet.id = p_target_id
      and outlet.is_active
  ) then
    raise exception using
      errcode = '22023',
      message = 'Outlet target aktif tidak ditemukan.';
  end if;

  if p_target_type = 'employee' and not exists (
    select 1
    from public.employees employee
    join public.user_accounts account
      on account.employee_id = employee.id
    where employee.id = p_target_id
      and employee.archived_at is null
      and account.account_status = 'active'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Pengguna target aktif tidak ditemukan.';
  end if;

  insert into public.announcements (
    title,
    body,
    category,
    is_pinned,
    acknowledgement_required,
    published_at,
    expires_at,
    created_by
  )
  values (
    trim(p_title),
    trim(p_body),
    p_category,
    coalesce(p_is_pinned, false),
    coalesce(p_acknowledgement_required, false),
    now(),
    p_expires_at,
    actor_id
  )
  returning * into announcement_row;

  insert into public.announcement_targets (
    announcement_id,
    target_type,
    target_id
  )
  values (
    announcement_row.id,
    p_target_type,
    p_target_id
  );

  for recipient in
    select distinct employee.id as employee_id
    from public.employees employee
    join public.user_accounts account
      on account.employee_id = employee.id
    where employee.archived_at is null
      and account.account_status = 'active'
      and (
        p_target_type = 'all'
        or (
          p_target_type = 'employee'
          and employee.id = p_target_id
        )
        or (
          p_target_type = 'outlet'
          and exists (
            select 1
            from public.employee_placements placement
            where placement.employee_id = employee.id
              and placement.outlet_id = p_target_id
              and placement.is_primary
              and placement.start_date <= current_date
              and (
                placement.end_date is null
                or placement.end_date >= current_date
              )
          )
        )
      )
  loop
    insert into public.announcement_receipts (
      announcement_id,
      employee_id,
      delivered_at
    )
    values (
      announcement_row.id,
      recipient.employee_id,
      now()
    )
    on conflict (announcement_id, employee_id) do nothing;

    insert into public.notifications (
      employee_id,
      notification_type,
      title,
      body,
      subject_type,
      subject_id,
      payload
    )
    values (
      recipient.employee_id,
      'announcement',
      announcement_row.title,
      announcement_row.body,
      'announcement',
      announcement_row.id,
      jsonb_build_object(
        'category', announcement_row.category,
        'is_pinned', announcement_row.is_pinned,
        'acknowledgement_required',
          announcement_row.acknowledgement_required
      )
    )
    returning id into notification_id;

    insert into public.notification_receipts (notification_id)
    values (notification_id);

    recipient_count := recipient_count + 1;
  end loop;

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    after_values,
    reason
  )
  values (
    actor_id,
    'publish',
    'announcement',
    announcement_row.id,
    jsonb_build_object(
      'title', announcement_row.title,
      'category', announcement_row.category,
      'target_type', p_target_type,
      'target_id', p_target_id,
      'recipient_count', recipient_count,
      'acknowledgement_required',
        announcement_row.acknowledgement_required
    ),
    'Publikasi pengumuman'
  );

  return jsonb_build_object(
    'announcement_id', announcement_row.id,
    'recipient_count', recipient_count,
    'published_at', announcement_row.published_at
  );
end;
$$;

create or replace function public.mark_notification_read(
  p_notification_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_role public.access_role := public.current_access_role();
  viewer_employee_id uuid := public.current_employee_id();
  notification_row public.notifications%rowtype;
  read_time timestamptz := now();
begin
  if viewer_role not in ('employee', 'supervisor') then
    raise exception using
      errcode = '42501',
      message = 'Peran ini tidak dapat mengubah status baca.';
  end if;

  select *
  into notification_row
  from public.notifications notification
  where notification.id = p_notification_id
    and notification.employee_id = viewer_employee_id;

  if notification_row.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Notifikasi tidak ditemukan.';
  end if;

  update public.notification_receipts receipt
  set
    in_app_read_at = coalesce(receipt.in_app_read_at, read_time),
    updated_at = now()
  where receipt.notification_id = notification_row.id;

  if notification_row.subject_type = 'announcement'
    and notification_row.subject_id is not null then
    update public.announcement_receipts receipt
    set
      read_at = coalesce(receipt.read_at, read_time),
      updated_at = now()
    where receipt.announcement_id = notification_row.subject_id
      and receipt.employee_id = viewer_employee_id;
  end if;

  return jsonb_build_object(
    'notification_id', notification_row.id,
    'read_at', read_time
  );
end;
$$;

create or replace function public.mark_all_notifications_read()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_role public.access_role := public.current_access_role();
  viewer_employee_id uuid := public.current_employee_id();
  read_time timestamptz := now();
  updated_count integer := 0;
begin
  if viewer_role not in ('employee', 'supervisor') then
    raise exception using
      errcode = '42501',
      message = 'Peran ini tidak dapat mengubah status baca.';
  end if;

  update public.notification_receipts receipt
  set
    in_app_read_at = coalesce(receipt.in_app_read_at, read_time),
    updated_at = now()
  where receipt.in_app_read_at is null
    and exists (
      select 1
      from public.notifications notification
      where notification.id = receipt.notification_id
        and notification.employee_id = viewer_employee_id
    );

  get diagnostics updated_count = row_count;

  update public.announcement_receipts receipt
  set
    read_at = coalesce(receipt.read_at, read_time),
    updated_at = now()
  where receipt.employee_id = viewer_employee_id
    and receipt.read_at is null
    and exists (
      select 1
      from public.announcements announcement
      where announcement.id = receipt.announcement_id
        and public.can_view_announcement(announcement.id)
        and announcement.published_at is not null
        and announcement.published_at <= now()
        and (
          announcement.expires_at is null
          or announcement.expires_at > now()
        )
    );

  return jsonb_build_object(
    'updated_count', updated_count,
    'read_at', read_time
  );
end;
$$;

create or replace function public.acknowledge_announcement(
  p_announcement_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_role public.access_role := public.current_access_role();
  viewer_employee_id uuid := public.current_employee_id();
  acknowledgement_time timestamptz := now();
begin
  if viewer_role not in ('employee', 'supervisor') then
    raise exception using
      errcode = '42501',
      message = 'Peran ini tidak dapat mengonfirmasi pengumuman.';
  end if;

  perform 1
  from public.announcements announcement
  where announcement.id = p_announcement_id
    and announcement.acknowledgement_required
    and announcement.published_at is not null
    and announcement.published_at <= now()
    and (
      announcement.expires_at is null
      or announcement.expires_at > now()
    )
    and public.can_view_announcement(announcement.id);

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Pengumuman yang memerlukan konfirmasi tidak ditemukan.';
  end if;

  insert into public.announcement_receipts (
    announcement_id,
    employee_id,
    delivered_at,
    read_at,
    acknowledged_at
  )
  values (
    p_announcement_id,
    viewer_employee_id,
    acknowledgement_time,
    acknowledgement_time,
    acknowledgement_time
  )
  on conflict (announcement_id, employee_id)
  do update set
    read_at = coalesce(
      public.announcement_receipts.read_at,
      excluded.read_at
    ),
    acknowledged_at = coalesce(
      public.announcement_receipts.acknowledged_at,
      excluded.acknowledged_at
    ),
    updated_at = now();

  update public.notification_receipts receipt
  set
    in_app_read_at = coalesce(
      receipt.in_app_read_at,
      acknowledgement_time
    ),
    acknowledged_at = coalesce(
      receipt.acknowledged_at,
      acknowledgement_time
    ),
    updated_at = now()
  where exists (
    select 1
    from public.notifications notification
    where notification.id = receipt.notification_id
      and notification.employee_id = viewer_employee_id
      and notification.subject_type = 'announcement'
      and notification.subject_id = p_announcement_id
  );

  return jsonb_build_object(
    'announcement_id', p_announcement_id,
    'acknowledged_at', acknowledgement_time
  );
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables publication_table
    where publication_table.pubname = 'supabase_realtime'
      and publication_table.schemaname = 'public'
      and publication_table.tablename = 'announcements'
  ) then
    alter publication supabase_realtime add table public.announcements;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_publication_tables publication_table
    where publication_table.pubname = 'supabase_realtime'
      and publication_table.schemaname = 'public'
      and publication_table.tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

revoke all on function public.get_communication_workspace()
  from public, anon, authenticated;
revoke all on function public.create_announcement(
  text,
  text,
  text,
  boolean,
  boolean,
  text,
  uuid,
  timestamptz
) from public, anon, authenticated;
revoke all on function public.mark_notification_read(uuid)
  from public, anon, authenticated;
revoke all on function public.mark_all_notifications_read()
  from public, anon, authenticated;
revoke all on function public.acknowledge_announcement(uuid)
  from public, anon, authenticated;

grant execute on function public.get_communication_workspace()
  to authenticated;
grant execute on function public.create_announcement(
  text,
  text,
  text,
  boolean,
  boolean,
  text,
  uuid,
  timestamptz
) to authenticated;
grant execute on function public.mark_notification_read(uuid)
  to authenticated;
grant execute on function public.mark_all_notifications_read()
  to authenticated;
grant execute on function public.acknowledge_announcement(uuid)
  to authenticated;
