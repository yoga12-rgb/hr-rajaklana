-- M8 asynchronous XLSX exports. Interactive reports stay bounded to 92 days;
-- this queue supports a larger, server-generated snapshot without exposing the
-- service role or public Storage objects.

alter table public.backup_exports
  add column if not exists outlet_id uuid references public.outlets(id) on delete restrict,
  add column if not exists employee_id uuid references public.employees(id) on delete restrict,
  add column if not exists request_key uuid,
  add column if not exists started_at timestamptz,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_error text,
  add column if not exists file_size_bytes bigint,
  add column if not exists mime_type text;

alter table public.backup_exports
  drop constraint if exists backup_exports_attempt_count_check,
  add constraint backup_exports_attempt_count_check
    check (attempt_count between 0 and 3),
  drop constraint if exists backup_exports_file_size_check,
  add constraint backup_exports_file_size_check
    check (file_size_bytes is null or file_size_bytes >= 0),
  drop constraint if exists backup_exports_report_request_key_check,
  add constraint backup_exports_report_request_key_check
    check (export_type <> 'report' or request_key is not null);

create unique index if not exists backup_exports_request_key_unique
  on public.backup_exports (requested_by, request_key)
  where request_key is not null;

create index if not exists backup_exports_requester_created
  on public.backup_exports (requested_by, created_at desc);

drop policy if exists backup_exports_read_operations
  on public.backup_exports;
drop policy if exists backup_exports_insert_supervisor
  on public.backup_exports;
drop policy if exists backup_exports_update_supervisor
  on public.backup_exports;

create policy backup_exports_read_authorized
on public.backup_exports
for select
to authenticated
using (
  requested_by = (select auth.uid())
  or (select public.is_supervisor())
);

drop policy if exists exports_read_operations
  on storage.objects;

create policy exports_read_authorized
on storage.objects
for select
to authenticated
using (
  bucket_id = 'exports'
  and (
    (select public.is_supervisor())
    or exists (
      select 1
      from public.backup_exports report_export
      where report_export.storage_path = storage.objects.name
        and report_export.requested_by = (select auth.uid())
        and report_export.status = 'completed'
    )
  )
);

create or replace function public.request_report_export(
  p_period_start date,
  p_period_end date,
  p_outlet_id uuid default null,
  p_employee_id uuid default null,
  p_request_key uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_role public.access_role := public.current_access_role();
  requested_export public.backup_exports;
begin
  if viewer_role not in ('supervisor', 'management') then
    raise exception using
      errcode = '42501',
      message = 'Ekspor laporan hanya tersedia untuk supervisor dan management.';
  end if;

  if p_period_start is null
    or p_period_end is null
    or p_period_end < p_period_start then
    raise exception using
      errcode = '22023',
      message = 'Periode ekspor tidak valid.';
  end if;

  if p_period_end - p_period_start > 365 then
    raise exception using
      errcode = '22023',
      message = 'Satu ekspor dibatasi maksimal 366 hari.';
  end if;

  if p_outlet_id is not null and not exists (
    select 1 from public.outlets outlet where outlet.id = p_outlet_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'Outlet ekspor tidak ditemukan.';
  end if;

  if p_employee_id is not null and not exists (
    select 1 from public.employees employee where employee.id = p_employee_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'Karyawan ekspor tidak ditemukan.';
  end if;

  insert into public.backup_exports (
    export_type,
    period_start,
    period_end,
    outlet_id,
    employee_id,
    request_key,
    requested_by,
    status,
    mime_type
  )
  values (
    'report',
    p_period_start,
    p_period_end,
    p_outlet_id,
    p_employee_id,
    p_request_key,
    auth.uid(),
    'scheduled',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
  on conflict (requested_by, request_key)
    where request_key is not null
  do update set request_key = excluded.request_key
  returning * into requested_export;

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    after_values
  )
  values (
    auth.uid(),
    'report_export_requested',
    'backup_export',
    requested_export.id,
    jsonb_build_object(
      'period_start', requested_export.period_start,
      'period_end', requested_export.period_end,
      'outlet_id', requested_export.outlet_id,
      'employee_id', requested_export.employee_id
    )
  );

  return to_jsonb(requested_export);
end;
$$;

create or replace function public.get_report_export_jobs()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_access_role() not in ('supervisor', 'management') then
    raise exception using
      errcode = '42501',
      message = 'Ekspor laporan hanya tersedia untuk supervisor dan management.';
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(report_export) order by report_export.created_at desc)
    from (
      select *
      from public.backup_exports
      where export_type = 'report'
        and requested_by = auth.uid()
      order by created_at desc
      limit 10
    ) report_export
  ), '[]'::jsonb);
end;
$$;

create or replace function public.retry_report_export(p_export_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_role public.access_role := public.current_access_role();
  retried_export public.backup_exports;
begin
  if viewer_role not in ('supervisor', 'management') then
    raise exception using errcode = '42501', message = 'Akses ditolak.';
  end if;

  update public.backup_exports
  set
    status = 'scheduled',
    started_at = null,
    completed_at = null,
    last_error = null
  where id = p_export_id
    and export_type = 'report'
    and requested_by = auth.uid()
    and status = 'failed'
    and attempt_count < 3
  returning * into retried_export;

  if retried_export.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Job ekspor tidak dapat diulang.';
  end if;

  return to_jsonb(retried_export);
end;
$$;

create or replace function public.claim_report_export(p_export_id uuid)
returns public.backup_exports
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_export public.backup_exports;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Akses worker ditolak.';
  end if;

  update public.backup_exports
  set
    status = 'processing',
    started_at = now(),
    completed_at = null,
    last_error = null,
    attempt_count = attempt_count + 1
  where id = p_export_id
    and export_type = 'report'
    and status = 'scheduled'
    and attempt_count < 3
  returning * into claimed_export;

  if claimed_export.id is null then
    raise exception using errcode = 'P0002', message = 'Job ekspor tidak tersedia.';
  end if;

  return claimed_export;
end;
$$;

create or replace function public.complete_report_export(
  p_export_id uuid,
  p_storage_path text,
  p_checksum text,
  p_file_size_bytes bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Akses worker ditolak.';
  end if;

  update public.backup_exports
  set
    status = 'completed',
    storage_path = p_storage_path,
    checksum = p_checksum,
    file_size_bytes = p_file_size_bytes,
    completed_at = now(),
    last_error = null
  where id = p_export_id
    and status = 'processing';

  if not found then
    raise exception using errcode = 'P0002', message = 'Job ekspor tidak aktif.';
  end if;

  insert into public.audit_logs (
    action,
    entity_type,
    entity_id,
    after_values,
    reason
  )
  values (
    'report_export_completed',
    'backup_export',
    p_export_id,
    jsonb_build_object(
      'storage_path', p_storage_path,
      'checksum', p_checksum,
      'file_size_bytes', p_file_size_bytes
    ),
    'server_worker'
  );
end;
$$;

create or replace function public.fail_report_export(
  p_export_id uuid,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Akses worker ditolak.';
  end if;

  update public.backup_exports
  set
    status = 'failed',
    completed_at = now(),
    last_error = left(coalesce(nullif(trim(p_error), ''), 'Worker ekspor gagal.'), 500)
  where id = p_export_id
    and status = 'processing';

  if found then
    insert into public.audit_logs (
      action,
      entity_type,
      entity_id,
      after_values,
      reason
    )
    values (
      'report_export_failed',
      'backup_export',
      p_export_id,
      jsonb_build_object('error', left(coalesce(p_error, ''), 500)),
      'server_worker'
    );
  end if;
end;
$$;

revoke all on function public.request_report_export(date, date, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.request_report_export(date, date, uuid, uuid, uuid)
  to authenticated;

revoke all on function public.get_report_export_jobs()
  from public, anon, authenticated;
grant execute on function public.get_report_export_jobs()
  to authenticated;

revoke all on function public.retry_report_export(uuid)
  from public, anon, authenticated;
grant execute on function public.retry_report_export(uuid)
  to authenticated;

revoke all on function public.claim_report_export(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_report_export(uuid)
  to service_role;

revoke all on function public.complete_report_export(uuid, text, text, bigint)
  from public, anon, authenticated;
grant execute on function public.complete_report_export(uuid, text, text, bigint)
  to service_role;

revoke all on function public.fail_report_export(uuid, text)
  from public, anon, authenticated;
grant execute on function public.fail_report_export(uuid, text)
  to service_role;
