alter table public.overtime_requests
  add column if not exists planned_start_time time,
  add column if not exists planned_end_time time;

alter table public.overtime_requests
  drop constraint if exists overtime_requests_planned_time_range;

alter table public.overtime_requests
  add constraint overtime_requests_planned_time_range check (
    (planned_start_time is null and planned_end_time is null)
    or (
      planned_start_time is not null
      and planned_end_time is not null
      and planned_start_time <> planned_end_time
    )
  );

revoke insert, update, delete on public.leave_types from authenticated;
revoke insert, update, delete on public.leave_entitlements from authenticated;
revoke insert, update, delete on public.leave_requests from authenticated;
revoke insert, update, delete on public.request_attachments from authenticated;
revoke insert, update, delete on public.overtime_requests from authenticated;

create or replace function public.workforce_notify_employee(
  p_employee_id uuid,
  p_notification_type text,
  p_title text,
  p_body text,
  p_subject_type text,
  p_subject_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_id uuid;
begin
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
    p_employee_id,
    trim(p_notification_type),
    trim(p_title),
    trim(p_body),
    nullif(trim(p_subject_type), ''),
    p_subject_id,
    coalesce(p_payload, '{}'::jsonb)
  )
  returning id into notification_id;

  insert into public.notification_receipts (notification_id)
  values (notification_id);

  return notification_id;
end;
$$;

create or replace function public.workforce_notify_supervisors(
  p_notification_type text,
  p_title text,
  p_body text,
  p_subject_type text,
  p_subject_id uuid,
  p_payload jsonb default '{}'::jsonb,
  p_excluded_employee_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  supervisor record;
begin
  for supervisor in
    select account.employee_id
    from public.user_accounts account
    join public.employees employee
      on employee.id = account.employee_id
    where account.access_role = 'supervisor'
      and account.account_status = 'active'
      and employee.archived_at is null
      and account.employee_id is distinct from p_excluded_employee_id
  loop
    perform public.workforce_notify_employee(
      supervisor.employee_id,
      p_notification_type,
      p_title,
      p_body,
      p_subject_type,
      p_subject_id,
      p_payload
    );
  end loop;
end;
$$;

create or replace function public.ensure_annual_leave_entitlement(
  p_employee_id uuid,
  p_year integer
)
returns public.leave_entitlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  annual_type_id uuid;
  entitlement_days integer := 12;
  entitlement public.leave_entitlements%rowtype;
begin
  if p_year not between 2000 and 2200 then
    raise exception using
      errcode = '22023',
      message = 'Tahun saldo cuti tidak valid.';
  end if;

  select leave_type.id
  into annual_type_id
  from public.leave_types leave_type
  where leave_type.code = 'annual'
  limit 1;

  if annual_type_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'Jenis Cuti Tahunan belum tersedia.';
  end if;

  select coalesce(
    (
      select (policy.configuration->>'annual_entitlement_days')::integer
      from public.policy_versions policy
      where policy.policy_type = 'leave'
        and policy.effective_from <= now()
        and (
          policy.effective_until is null
          or policy.effective_until > now()
        )
      order by policy.version_number desc
      limit 1
    ),
    12
  )
  into entitlement_days;

  insert into public.leave_entitlements (
    employee_id,
    leave_type_id,
    year,
    granted_days
  )
  values (
    p_employee_id,
    annual_type_id,
    p_year,
    entitlement_days
  )
  on conflict (employee_id, leave_type_id, year) do nothing;

  select *
  into entitlement
  from public.leave_entitlements
  where employee_id = p_employee_id
    and leave_type_id = annual_type_id
    and year = p_year;

  return entitlement;
end;
$$;

create or replace function public.provision_employee_annual_leave()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.ensure_annual_leave_entitlement(
    new.id,
    extract(year from current_date)::integer
  );
  return new;
end;
$$;

drop trigger if exists employees_provision_annual_leave on public.employees;
create trigger employees_provision_annual_leave
after insert on public.employees
for each row execute function public.provision_employee_annual_leave();

do $$
declare
  employee record;
begin
  for employee in
    select id
    from public.employees
    where archived_at is null
  loop
    perform public.ensure_annual_leave_entitlement(
      employee.id,
      extract(year from current_date)::integer
    );
  end loop;
end;
$$;

create or replace function public.get_leave_workspace()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_id uuid := public.current_employee_id();
  requester_role public.access_role := public.current_access_role();
begin
  if requester_id is null or requester_role is null then
    raise exception using
      errcode = '42501',
      message = 'Sesi pengguna tidak memiliki profil karyawan aktif.';
  end if;

  perform public.ensure_annual_leave_entitlement(
    requester_id,
    extract(year from current_date)::integer
  );

  return jsonb_build_object(
    'role',
    requester_role,
    'current_employee_id',
    requester_id,
    'leave_types',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', leave_type.id,
            'code', leave_type.code,
            'name', leave_type.name,
            'deducts_annual_balance', leave_type.deducts_annual_balance,
            'minimum_notice_days', leave_type.minimum_notice_days,
            'same_day_allowed', leave_type.same_day_allowed,
            'requires_document', leave_type.requires_document,
            'document_required_after_days',
              leave_type.document_required_after_days,
            'is_active', leave_type.is_active
          )
          order by leave_type.name
        )
        from public.leave_types leave_type
        where leave_type.is_active
          or requester_role in ('supervisor', 'management')
      ),
      '[]'::jsonb
    ),
    'balances',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', entitlement.id,
            'employee_id', entitlement.employee_id,
            'employee_name', employee.full_name,
            'leave_type_id', entitlement.leave_type_id,
            'leave_type_name', leave_type.name,
            'year', entitlement.year,
            'granted_days', entitlement.granted_days,
            'used_days', entitlement.used_days,
            'reserved_days', entitlement.reserved_days,
            'expired_days', entitlement.expired_days,
            'available_days',
              greatest(
                0,
                entitlement.granted_days
                  - entitlement.used_days
                  - entitlement.reserved_days
                  - entitlement.expired_days
              )
          )
          order by employee.full_name, leave_type.name, entitlement.year desc
        )
        from public.leave_entitlements entitlement
        join public.employees employee
          on employee.id = entitlement.employee_id
        join public.leave_types leave_type
          on leave_type.id = entitlement.leave_type_id
        where entitlement.employee_id = requester_id
          or requester_role in ('supervisor', 'management')
      ),
      '[]'::jsonb
    ),
    'requests',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', request.id,
            'employee_id', request.employee_id,
            'employee_name', employee.full_name,
            'position_name', position.name,
            'leave_type_id', request.leave_type_id,
            'leave_type_name', leave_type.name,
            'starts_on', request.starts_on,
            'ends_on', request.ends_on,
            'requested_days', request.requested_days,
            'reason', request.reason,
            'status', request.status,
            'request_version', request.request_version,
            'decision_note', request.decision_note,
            'created_at', request.created_at,
            'decided_at', request.decided_at,
            'can_decide',
              requester_role = 'supervisor'
              and request.employee_id <> requester_id
              and request.status = 'pending',
            'attachments',
              coalesce(
                (
                  select jsonb_agg(
                    jsonb_build_object(
                      'id', attachment.id,
                      'document_type', attachment.document_type,
                      'mime_type', attachment.mime_type,
                      'size_bytes', attachment.size_bytes,
                      'storage_bucket', attachment.storage_bucket,
                      'storage_path', attachment.storage_path,
                      'retention_until', attachment.retention_until,
                      'deleted_at', attachment.deleted_at
                    )
                    order by attachment.created_at
                  )
                  from public.request_attachments attachment
                  where attachment.subject_type = 'leave_request'
                    and attachment.subject_id = request.id
                    and (
                      request.employee_id = requester_id
                      or requester_role = 'supervisor'
                    )
                ),
                '[]'::jsonb
              )
          )
          order by request.created_at desc
        )
        from public.leave_requests request
        join public.employees employee
          on employee.id = request.employee_id
        join public.job_positions position
          on position.id = employee.job_position_id
        join public.leave_types leave_type
          on leave_type.id = request.leave_type_id
        where request.employee_id = requester_id
          or requester_role in ('supervisor', 'management')
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.save_leave_type(
  p_leave_type_id uuid,
  p_code text,
  p_name text,
  p_deducts_annual_balance boolean,
  p_minimum_notice_days integer,
  p_same_day_allowed boolean,
  p_requires_document boolean,
  p_document_required_after_days integer,
  p_is_active boolean,
  p_reason text
)
returns public.leave_types
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_row public.leave_types%rowtype;
  saved_row public.leave_types%rowtype;
  normalized_code text := lower(trim(p_code));
begin
  if not public.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'Aksi ini hanya dapat dilakukan supervisor.';
  end if;

  if normalized_code !~ '^[a-z][a-z0-9_]{1,39}$'
    or length(trim(p_name)) < 3
    or p_minimum_notice_days not between 0 and 90
    or (
      p_document_required_after_days is not null
      and p_document_required_after_days < 0
    )
    or length(trim(p_reason)) < 3 then
    raise exception using
      errcode = '22023',
      message = 'Data jenis cuti atau alasan perubahan tidak valid.';
  end if;

  if p_leave_type_id is null then
    insert into public.leave_types (
      code,
      name,
      deducts_annual_balance,
      minimum_notice_days,
      same_day_allowed,
      requires_document,
      document_required_after_days,
      is_active
    )
    values (
      normalized_code,
      trim(p_name),
      p_deducts_annual_balance,
      p_minimum_notice_days,
      p_same_day_allowed,
      p_requires_document,
      p_document_required_after_days,
      p_is_active
    )
    returning * into saved_row;
  else
    select *
    into before_row
    from public.leave_types
    where id = p_leave_type_id
    for update;

    if not found then
      raise exception using
        errcode = 'P0002',
        message = 'Jenis cuti tidak ditemukan.';
    end if;

    if not p_is_active and exists (
      select 1
      from public.leave_requests request
      where request.leave_type_id = p_leave_type_id
        and request.status = 'pending'
    ) then
      raise exception using
        errcode = '23514',
        message = 'Jenis cuti dengan pengajuan pending tidak dapat dinonaktifkan.';
    end if;

    if before_row.code = 'annual'
      and (
        normalized_code <> 'annual'
        or not p_deducts_annual_balance
        or not p_is_active
      ) then
      raise exception using
        errcode = '23514',
        message = 'Cuti Tahunan adalah jenis sistem dan wajib tetap aktif.';
    end if;

    update public.leave_types
    set
      code = normalized_code,
      name = trim(p_name),
      deducts_annual_balance = p_deducts_annual_balance,
      minimum_notice_days = p_minimum_notice_days,
      same_day_allowed = p_same_day_allowed,
      requires_document = p_requires_document,
      document_required_after_days = p_document_required_after_days,
      is_active = p_is_active
    where id = p_leave_type_id
    returning * into saved_row;
  end if;

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    before_values,
    after_values,
    reason
  )
  values (
    (select auth.uid()),
    case when p_leave_type_id is null then 'create' else 'update' end,
    'leave_type',
    saved_row.id,
    case when p_leave_type_id is null then null else to_jsonb(before_row) end,
    to_jsonb(saved_row),
    trim(p_reason)
  );

  return saved_row;
end;
$$;

create or replace function public.submit_leave_request(
  p_request_id uuid,
  p_leave_type_id uuid,
  p_starts_on date,
  p_ends_on date,
  p_reason text,
  p_attachment jsonb
)
returns public.leave_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_id uuid := public.current_employee_id();
  requester_name text;
  leave_type public.leave_types%rowtype;
  entitlement public.leave_entitlements%rowtype;
  requested_days integer;
  document_required boolean;
  attachment_path text;
  attachment_mime text;
  attachment_size bigint;
  attachment_type text;
  inserted_request public.leave_requests%rowtype;
begin
  if requester_id is null
    or public.current_access_role() = 'management' then
    raise exception using
      errcode = '42501',
      message = 'Pengguna tidak dapat membuat pengajuan cuti.';
  end if;

  if p_request_id is null
    or p_starts_on is null
    or p_ends_on is null
    or p_ends_on < p_starts_on
    or length(trim(p_reason)) < 3 then
    raise exception using
      errcode = '22023',
      message = 'Data pengajuan cuti tidak valid.';
  end if;

  select *
  into leave_type
  from public.leave_types
  where id = p_leave_type_id
    and is_active
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Jenis cuti aktif tidak ditemukan.';
  end if;

  requested_days := p_ends_on - p_starts_on + 1;

  if p_starts_on < current_date
    or (
      not leave_type.same_day_allowed
      and p_starts_on < current_date + leave_type.minimum_notice_days
    ) then
    raise exception using
      errcode = '22023',
      message = format(
        'Pengajuan %s wajib dibuat minimal %s hari sebelum tanggal mulai.',
        leave_type.name,
        leave_type.minimum_notice_days
      );
  end if;

  if exists (
    select 1
    from public.leave_requests request
    where request.employee_id = requester_id
      and request.status in ('pending', 'approved')
      and daterange(request.starts_on, request.ends_on, '[]')
        && daterange(p_starts_on, p_ends_on, '[]')
  ) then
    raise exception using
      errcode = '23P01',
      message = 'Rentang tanggal berbenturan dengan pengajuan aktif lain.';
  end if;

  document_required :=
    leave_type.requires_document
    or (
      leave_type.document_required_after_days is not null
      and requested_days > leave_type.document_required_after_days
    );

  if p_attachment is not null then
    attachment_path := nullif(trim(p_attachment->>'storage_path'), '');
    attachment_mime := nullif(trim(p_attachment->>'mime_type'), '');
    attachment_type := nullif(trim(p_attachment->>'document_type'), '');
    attachment_size := (p_attachment->>'size_bytes')::bigint;

    if attachment_path is null
      or attachment_type is null
      or attachment_mime not in (
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp'
      )
      or attachment_size <= 0
      or attachment_size > 10485760
      or split_part(attachment_path, '/', 1) <> requester_id::text then
      raise exception using
        errcode = '22023',
        message = 'Metadata dokumen cuti tidak valid.';
    end if;

    if not exists (
      select 1
      from storage.objects storage_object
      where storage_object.bucket_id = 'leave-documents'
        and storage_object.name = attachment_path
    ) then
      raise exception using
        errcode = 'P0002',
        message = 'Dokumen yang diunggah tidak ditemukan di Storage.';
    end if;
  elsif document_required then
    raise exception using
      errcode = '23514',
      message = 'Dokumen pendukung wajib dilampirkan untuk pengajuan ini.';
  end if;

  if leave_type.deducts_annual_balance then
    if extract(year from p_starts_on)
      <> extract(year from p_ends_on) then
      raise exception using
        errcode = '22023',
        message = 'Cuti Tahunan tidak dapat melewati pergantian tahun.';
    end if;

    entitlement := public.ensure_annual_leave_entitlement(
      requester_id,
      extract(year from p_starts_on)::integer
    );

    select *
    into entitlement
    from public.leave_entitlements
    where id = entitlement.id
    for update;

    if entitlement.granted_days
      - entitlement.used_days
      - entitlement.reserved_days
      - entitlement.expired_days < requested_days then
      raise exception using
        errcode = '23514',
        message = 'Saldo Cuti Tahunan tidak mencukupi.';
    end if;

    update public.leave_entitlements
    set reserved_days = reserved_days + requested_days
    where id = entitlement.id;
  end if;

  insert into public.leave_requests (
    id,
    employee_id,
    leave_type_id,
    starts_on,
    ends_on,
    requested_days,
    reason
  )
  values (
    p_request_id,
    requester_id,
    p_leave_type_id,
    p_starts_on,
    p_ends_on,
    requested_days,
    trim(p_reason)
  )
  returning * into inserted_request;

  if p_attachment is not null then
    insert into public.request_attachments (
      subject_type,
      subject_id,
      employee_id,
      storage_bucket,
      storage_path,
      document_type,
      mime_type,
      size_bytes,
      retention_until
    )
    values (
      'leave_request',
      inserted_request.id,
      requester_id,
      'leave-documents',
      attachment_path,
      attachment_type,
      attachment_mime,
      attachment_size,
      make_timestamptz(
        extract(year from p_ends_on)::integer + 1,
        1,
        1,
        0,
        0,
        0,
        'Asia/Jakarta'
      )
    );
  end if;

  select full_name
  into requester_name
  from public.employees
  where id = requester_id;

  perform public.workforce_notify_supervisors(
    'leave_request_submitted',
    'Pengajuan cuti baru',
    format(
      '%s mengajukan %s selama %s hari.',
      requester_name,
      leave_type.name,
      requested_days
    ),
    'leave_request',
    inserted_request.id,
    jsonb_build_object(
      'status', inserted_request.status,
      'request_version', inserted_request.request_version
    ),
    requester_id
  );

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    after_values,
    reason
  )
  values (
    (select auth.uid()),
    'submit',
    'leave_request',
    inserted_request.id,
    to_jsonb(inserted_request),
    trim(p_reason)
  );

  return inserted_request;
end;
$$;

create or replace function public.cancel_leave_request(
  p_request_id uuid,
  p_expected_version integer,
  p_reason text
)
returns public.leave_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_id uuid := public.current_employee_id();
  before_row public.leave_requests%rowtype;
  cancelled_row public.leave_requests%rowtype;
  deducts_balance boolean;
begin
  if length(trim(p_reason)) < 3 then
    raise exception using
      errcode = '22023',
      message = 'Alasan pembatalan wajib diisi.';
  end if;

  select *
  into before_row
  from public.leave_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Pengajuan cuti tidak ditemukan.';
  end if;

  select leave_type.deducts_annual_balance
  into deducts_balance
  from public.leave_types leave_type
  where leave_type.id = before_row.leave_type_id;

  if before_row.employee_id <> requester_id then
    raise exception using
      errcode = '42501',
      message = 'Hanya pemilik pengajuan yang dapat membatalkan.';
  end if;

  if before_row.status <> 'pending'
    or before_row.request_version <> p_expected_version then
    raise exception using
      errcode = '40001',
      message = 'Pengajuan sudah berubah dan tidak dapat dibatalkan.';
  end if;

  if deducts_balance then
    update public.leave_entitlements
    set reserved_days = greatest(
      0,
      reserved_days - before_row.requested_days
    )
    where employee_id = before_row.employee_id
      and leave_type_id = before_row.leave_type_id
      and year = extract(year from before_row.starts_on)::integer;
  end if;

  update public.leave_requests
  set
    status = 'cancelled',
    request_version = request_version + 1,
    decision_note = trim(p_reason)
  where id = p_request_id
    and status = 'pending'
    and request_version = p_expected_version
  returning * into cancelled_row;

  if not found then
    raise exception using
      errcode = '40001',
      message = 'Pengajuan sudah berubah dan tidak dapat dibatalkan.';
  end if;

  insert into public.approval_events (
    subject_type,
    subject_id,
    actor_id,
    action,
    note,
    subject_version
  )
  values (
    'leave_request',
    cancelled_row.id,
    (select auth.uid()),
    'cancelled',
    trim(p_reason),
    cancelled_row.request_version
  );

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    before_values,
    after_values,
    reason
  )
  values (
    (select auth.uid()),
    'cancel',
    'leave_request',
    cancelled_row.id,
    to_jsonb(before_row),
    to_jsonb(cancelled_row),
    trim(p_reason)
  );

  return cancelled_row;
end;
$$;

create or replace function public.decide_leave_request(
  request_id uuid,
  decision text,
  note text,
  expected_version integer
)
returns public.leave_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_request public.leave_requests%rowtype;
  decided_request public.leave_requests%rowtype;
  leave_type public.leave_types%rowtype;
  affected_schedule_ids jsonb := '[]'::jsonb;
begin
  if not public.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'Hanya supervisor yang dapat memutuskan pengajuan cuti.';
  end if;

  if decision is null
    or decision not in ('approved', 'rejected')
    or (decision = 'rejected' and length(trim(note)) < 3) then
    raise exception using
      errcode = '22023',
      message = 'Keputusan atau catatan penolakan tidak valid.';
  end if;

  select *
  into previous_request
  from public.leave_requests
  where id = request_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Pengajuan cuti tidak ditemukan.';
  end if;

  if previous_request.status <> 'pending'
    or previous_request.request_version <> expected_version then
    raise exception using
      errcode = '40001',
      message = 'Pengajuan cuti sudah diputuskan atau berubah.';
  end if;

  if previous_request.employee_id = public.current_employee_id() then
    raise exception using
      errcode = '42501',
      message = 'Supervisor tidak dapat memutuskan pengajuan sendiri.';
  end if;

  select *
  into leave_type
  from public.leave_types
  where id = previous_request.leave_type_id;

  if leave_type.deducts_annual_balance then
    perform 1
    from public.leave_entitlements
    where employee_id = previous_request.employee_id
      and leave_type_id = previous_request.leave_type_id
      and year = extract(year from previous_request.starts_on)::integer
      and reserved_days >= previous_request.requested_days
    for update;

    if not found then
      raise exception using
        errcode = '23514',
        message = 'Reservasi saldo cuti tidak konsisten.';
    end if;

    update public.leave_entitlements
    set
      used_days = used_days + case
        when decision = 'approved' then previous_request.requested_days
        else 0
      end,
      reserved_days = reserved_days - previous_request.requested_days
    where employee_id = previous_request.employee_id
      and leave_type_id = previous_request.leave_type_id
      and year = extract(year from previous_request.starts_on)::integer;
  end if;

  update public.leave_requests
  set
    status = decision::public.request_status,
    request_version = request_version + 1,
    decided_by = (select auth.uid()),
    decided_at = now(),
    decision_note = nullif(trim(note), '')
  where id = request_id
    and status = 'pending'
    and request_version = expected_version
  returning * into decided_request;

  if not found then
    raise exception using
      errcode = '40001',
      message = 'Pengajuan cuti sudah diputuskan oleh supervisor lain.';
  end if;

  if decision = 'approved' then
    select coalesce(jsonb_agg(assignment.id), '[]'::jsonb)
    into affected_schedule_ids
    from public.schedule_assignments assignment
    join public.roster_versions version
      on version.id = assignment.roster_version_id
    join public.roster_periods period
      on period.active_version_id = version.id
    where assignment.employee_id = previous_request.employee_id
      and assignment.work_date between
        previous_request.starts_on and previous_request.ends_on
      and assignment.status = 'scheduled'
      and version.status = 'published';

    if jsonb_array_length(affected_schedule_ids) > 0 then
      perform public.workforce_notify_supervisors(
        'leave_roster_impact',
        'Roster perlu ditinjau',
        'Cuti yang disetujui berdampak pada jadwal aktif dan memerlukan penjadwalan ulang manual.',
        'leave_request',
        decided_request.id,
        jsonb_build_object(
          'schedule_assignment_ids', affected_schedule_ids,
          'starts_on', decided_request.starts_on,
          'ends_on', decided_request.ends_on
        ),
        previous_request.employee_id
      );
    end if;
  end if;

  perform public.workforce_notify_employee(
    previous_request.employee_id,
    'leave_request_decided',
    case
      when decision = 'approved' then 'Pengajuan cuti disetujui'
      else 'Pengajuan cuti ditolak'
    end,
    case
      when decision = 'approved'
        then 'Pengajuan Anda telah disetujui supervisor.'
      else format('Pengajuan Anda ditolak: %s', trim(note))
    end,
    'leave_request',
    decided_request.id,
    jsonb_build_object(
      'status', decided_request.status,
      'request_version', decided_request.request_version,
      'affected_schedule_ids', affected_schedule_ids
    )
  );

  insert into public.approval_events (
    subject_type,
    subject_id,
    actor_id,
    action,
    note,
    subject_version
  )
  values (
    'leave_request',
    request_id,
    (select auth.uid()),
    decision,
    nullif(trim(note), ''),
    decided_request.request_version
  );

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    before_values,
    after_values,
    reason
  )
  values (
    (select auth.uid()),
    'decide',
    'leave_request',
    request_id,
    to_jsonb(previous_request),
    to_jsonb(decided_request),
    nullif(trim(note), '')
  );

  return decided_request;
end;
$$;

create or replace function public.get_overtime_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  requester_id uuid := public.current_employee_id();
  requester_role public.access_role := public.current_access_role();
begin
  if requester_id is null or requester_role is null then
    raise exception using
      errcode = '42501',
      message = 'Sesi pengguna tidak memiliki profil karyawan aktif.';
  end if;

  return jsonb_build_object(
    'role',
    requester_role,
    'current_employee_id',
    requester_id,
    'employees',
    case
      when requester_role = 'supervisor' then
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', employee.id,
                'name', employee.full_name,
                'position_name', position.name
              )
              order by employee.full_name
            )
            from public.employees employee
            join public.job_positions position
              on position.id = employee.job_position_id
            where employee.archived_at is null
          ),
          '[]'::jsonb
        )
      else '[]'::jsonb
    end,
    'requests',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', request.id,
            'employee_id', request.employee_id,
            'employee_name', employee.full_name,
            'position_name', position.name,
            'source_type', request.source_type,
            'overtime_date', request.overtime_date,
            'planned_start_time', request.planned_start_time,
            'planned_end_time', request.planned_end_time,
            'planned_duration_min', request.planned_duration_min,
            'actual_duration_min', request.actual_duration_min,
            'approved_duration_min', request.approved_duration_min,
            'reason', request.reason,
            'status', request.status,
            'request_version', request.request_version,
            'decision_note', request.decision_note,
            'created_at', request.created_at,
            'decided_at', request.decided_at,
            'can_decide',
              requester_role = 'supervisor'
              and request.employee_id <> requester_id
              and request.status = 'pending',
            'can_refresh_actual',
              (
                request.employee_id = requester_id
                or requester_role = 'supervisor'
              )
              and request.overtime_date <= current_date,
            'can_cancel',
              request.status = 'pending'
              and (
                (
                  request.source_type = 'employee_request'
                  and request.employee_id = requester_id
                )
                or (
                  requester_role = 'supervisor'
                  and request.source_type = 'supervisor_assignment'
                  and request.assigned_by = (select auth.uid())
                )
              )
          )
          order by request.overtime_date desc, request.created_at desc
        )
        from public.overtime_requests request
        join public.employees employee
          on employee.id = request.employee_id
        join public.job_positions position
          on position.id = employee.job_position_id
        where request.employee_id = requester_id
          or requester_role in ('supervisor', 'management')
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.workforce_planned_overtime_minutes(
  p_start_time time,
  p_end_time time
)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  start_minutes integer;
  end_minutes integer;
  duration_minutes integer;
begin
  if p_start_time is null
    or p_end_time is null
    or p_start_time = p_end_time then
    raise exception using
      errcode = '22023',
      message = 'Waktu mulai dan selesai lembur tidak valid.';
  end if;

  start_minutes :=
    extract(hour from p_start_time)::integer * 60
    + extract(minute from p_start_time)::integer;
  end_minutes :=
    extract(hour from p_end_time)::integer * 60
    + extract(minute from p_end_time)::integer;

  if end_minutes <= start_minutes then
    end_minutes := end_minutes + 1440;
  end if;

  duration_minutes := end_minutes - start_minutes;

  if duration_minutes < 60 or duration_minutes % 30 <> 0 then
    raise exception using
      errcode = '22023',
      message = 'Durasi lembur minimal 60 menit dan harus dalam kelipatan 30 menit.';
  end if;

  return duration_minutes;
end;
$$;

create or replace function public.submit_overtime_request(
  p_overtime_date date,
  p_start_time time,
  p_end_time time,
  p_reason text
)
returns public.overtime_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_id uuid := public.current_employee_id();
  requester_name text;
  duration_minutes integer;
  inserted_request public.overtime_requests%rowtype;
begin
  if requester_id is null
    or public.current_access_role() = 'management' then
    raise exception using
      errcode = '42501',
      message = 'Pengguna tidak dapat membuat pengajuan lembur.';
  end if;

  if p_overtime_date < current_date or length(trim(p_reason)) < 3 then
    raise exception using
      errcode = '22023',
      message = 'Tanggal atau alasan lembur tidak valid.';
  end if;

  duration_minutes := public.workforce_planned_overtime_minutes(
    p_start_time,
    p_end_time
  );

  if exists (
    select 1
    from public.overtime_requests request
    where request.employee_id = requester_id
      and request.overtime_date = p_overtime_date
      and request.status in ('pending', 'approved')
  ) then
    raise exception using
      errcode = '23505',
      message = 'Sudah ada pengajuan lembur aktif pada tanggal tersebut.';
  end if;

  insert into public.overtime_requests (
    employee_id,
    source_type,
    overtime_date,
    planned_start_time,
    planned_end_time,
    planned_duration_min,
    reason
  )
  values (
    requester_id,
    'employee_request',
    p_overtime_date,
    p_start_time,
    p_end_time,
    duration_minutes,
    trim(p_reason)
  )
  returning * into inserted_request;

  select full_name
  into requester_name
  from public.employees
  where id = requester_id;

  perform public.workforce_notify_supervisors(
    'overtime_request_submitted',
    'Pengajuan lembur baru',
    format(
      '%s mengajukan lembur selama %s menit.',
      requester_name,
      duration_minutes
    ),
    'overtime_request',
    inserted_request.id,
    jsonb_build_object(
      'status', inserted_request.status,
      'request_version', inserted_request.request_version
    ),
    requester_id
  );

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    after_values,
    reason
  )
  values (
    (select auth.uid()),
    'submit',
    'overtime_request',
    inserted_request.id,
    to_jsonb(inserted_request),
    trim(p_reason)
  );

  return inserted_request;
end;
$$;

create or replace function public.assign_overtime_request(
  p_employee_id uuid,
  p_overtime_date date,
  p_start_time time,
  p_end_time time,
  p_reason text
)
returns public.overtime_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  duration_minutes integer;
  inserted_request public.overtime_requests%rowtype;
begin
  if not public.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'Hanya supervisor yang dapat menugaskan lembur.';
  end if;

  if p_employee_id = public.current_employee_id() then
    raise exception using
      errcode = '42501',
      message = 'Supervisor tidak dapat menugaskan lembur kepada diri sendiri.';
  end if;

  if p_overtime_date < current_date or length(trim(p_reason)) < 3 then
    raise exception using
      errcode = '22023',
      message = 'Tanggal atau alasan penugasan lembur tidak valid.';
  end if;

  perform 1
  from public.employees
  where id = p_employee_id
    and archived_at is null;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Karyawan aktif tidak ditemukan.';
  end if;

  duration_minutes := public.workforce_planned_overtime_minutes(
    p_start_time,
    p_end_time
  );

  if exists (
    select 1
    from public.overtime_requests request
    where request.employee_id = p_employee_id
      and request.overtime_date = p_overtime_date
      and request.status in ('pending', 'approved')
  ) then
    raise exception using
      errcode = '23505',
      message = 'Karyawan sudah memiliki lembur aktif pada tanggal tersebut.';
  end if;

  insert into public.overtime_requests (
    employee_id,
    source_type,
    overtime_date,
    planned_start_time,
    planned_end_time,
    planned_duration_min,
    reason,
    assigned_by
  )
  values (
    p_employee_id,
    'supervisor_assignment',
    p_overtime_date,
    p_start_time,
    p_end_time,
    duration_minutes,
    trim(p_reason),
    (select auth.uid())
  )
  returning * into inserted_request;

  perform public.workforce_notify_employee(
    p_employee_id,
    'overtime_assigned',
    'Penugasan lembur baru',
    format(
      'Anda mendapat penugasan lembur pada %s selama %s menit.',
      p_overtime_date,
      duration_minutes
    ),
    'overtime_request',
    inserted_request.id,
    jsonb_build_object(
      'status', inserted_request.status,
      'request_version', inserted_request.request_version
    )
  );

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    after_values,
    reason
  )
  values (
    (select auth.uid()),
    'assign',
    'overtime_request',
    inserted_request.id,
    to_jsonb(inserted_request),
    trim(p_reason)
  );

  return inserted_request;
end;
$$;

create or replace function public.cancel_overtime_request(
  p_request_id uuid,
  p_expected_version integer,
  p_reason text
)
returns public.overtime_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_id uuid := public.current_employee_id();
  before_row public.overtime_requests%rowtype;
  cancelled_row public.overtime_requests%rowtype;
begin
  if length(trim(p_reason)) < 3 then
    raise exception using
      errcode = '22023',
      message = 'Alasan pembatalan wajib diisi.';
  end if;

  select *
  into before_row
  from public.overtime_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Pengajuan lembur tidak ditemukan.';
  end if;

  if not (
    before_row.employee_id = requester_id
    and before_row.source_type = 'employee_request'
  ) and not (
    public.is_supervisor()
    and before_row.source_type = 'supervisor_assignment'
    and before_row.assigned_by = (select auth.uid())
  ) then
    raise exception using
      errcode = '42501',
      message = 'Pengguna tidak dapat membatalkan lembur ini.';
  end if;

  if before_row.status <> 'pending'
    or before_row.request_version <> p_expected_version then
    raise exception using
      errcode = '40001',
      message = 'Pengajuan lembur sudah berubah dan tidak dapat dibatalkan.';
  end if;

  update public.overtime_requests
  set
    status = 'cancelled',
    request_version = request_version + 1,
    decision_note = trim(p_reason)
  where id = p_request_id
    and status = 'pending'
    and request_version = p_expected_version
  returning * into cancelled_row;

  insert into public.approval_events (
    subject_type,
    subject_id,
    actor_id,
    action,
    note,
    subject_version
  )
  values (
    'overtime_request',
    cancelled_row.id,
    (select auth.uid()),
    'cancelled',
    trim(p_reason),
    cancelled_row.request_version
  );

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    before_values,
    after_values,
    reason
  )
  values (
    (select auth.uid()),
    'cancel',
    'overtime_request',
    cancelled_row.id,
    to_jsonb(before_row),
    to_jsonb(cancelled_row),
    trim(p_reason)
  );

  return cancelled_row;
end;
$$;

create or replace function public.refresh_overtime_actual(
  p_request_id uuid
)
returns public.overtime_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_id uuid := public.current_employee_id();
  before_row public.overtime_requests%rowtype;
  refreshed_row public.overtime_requests%rowtype;
  attendance public.attendance_records%rowtype;
  planned_end timestamptz;
  raw_minutes integer;
  rounded_minutes integer;
begin
  select *
  into before_row
  from public.overtime_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Pengajuan lembur tidak ditemukan.';
  end if;

  if before_row.employee_id <> requester_id
    and not public.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'Pengguna tidak dapat memperbarui durasi aktual lembur ini.';
  end if;

  select attendance_row.*
  into attendance
  from public.attendance_records attendance_row
  where (
      attendance_row.id = before_row.attendance_record_id
      or (
        before_row.attendance_record_id is null
        and attendance_row.employee_id = before_row.employee_id
        and attendance_row.work_date = before_row.overtime_date
      )
    )
    and attendance_row.clock_out_at is not null
  order by
    (attendance_row.id = before_row.attendance_record_id) desc,
    attendance_row.clock_out_at desc
  limit 1;

  if not found or attendance.schedule_assignment_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Presensi selesai yang terhubung ke jadwal belum tersedia.';
  end if;

  select
    (
      (assignment.work_date + assignment.planned_end)
        at time zone 'Asia/Jakarta'
    )
    + case
      when assignment.planned_end <= assignment.planned_start
        then interval '1 day'
      else interval '0 days'
    end
  into planned_end
  from public.schedule_assignments assignment
  where assignment.id = attendance.schedule_assignment_id;

  if planned_end is null then
    raise exception using
      errcode = '23514',
      message = 'Jadwal tidak memiliki waktu selesai yang dapat dihitung.';
  end if;

  raw_minutes := greatest(
    0,
    floor(extract(epoch from (attendance.clock_out_at - planned_end)) / 60)::integer
  );
  rounded_minutes := case
    when raw_minutes < 60 then 0
    else floor(raw_minutes / 30.0)::integer * 30
  end;

  update public.overtime_requests
  set
    attendance_record_id = attendance.id,
    actual_duration_min = rounded_minutes
  where id = p_request_id
  returning * into refreshed_row;

  if rounded_minutes <> before_row.planned_duration_min then
    perform public.workforce_notify_supervisors(
      'overtime_actual_difference',
      'Durasi aktual lembur berbeda',
      format(
        'Durasi rencana %s menit dan aktual %s menit memerlukan validasi.',
        before_row.planned_duration_min,
        rounded_minutes
      ),
      'overtime_request',
      refreshed_row.id,
      jsonb_build_object(
        'planned_duration_min', before_row.planned_duration_min,
        'actual_duration_min', rounded_minutes
      ),
      before_row.employee_id
    );
  end if;

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    before_values,
    after_values,
    reason
  )
  values (
    (select auth.uid()),
    'refresh_actual',
    'overtime_request',
    refreshed_row.id,
    to_jsonb(before_row),
    to_jsonb(refreshed_row),
    'Sinkronisasi durasi aktual dari presensi'
  );

  return refreshed_row;
end;
$$;

create or replace function public.decide_overtime_request(
  request_id uuid,
  decision text,
  approved_minutes integer,
  note text,
  expected_version integer
)
returns public.overtime_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_request public.overtime_requests%rowtype;
  decided_request public.overtime_requests%rowtype;
begin
  if not public.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'Hanya supervisor yang dapat memutuskan lembur.';
  end if;

  if decision is null
    or decision not in ('approved', 'rejected')
    or (decision = 'rejected' and length(trim(note)) < 3) then
    raise exception using
      errcode = '22023',
      message = 'Keputusan atau catatan penolakan tidak valid.';
  end if;

  if decision = 'approved' and (
    approved_minutes is null
    or approved_minutes < 60
    or approved_minutes % 30 <> 0
  ) then
    raise exception using
      errcode = '22023',
      message = 'Durasi disetujui minimal 60 menit dan dalam kelipatan 30 menit.';
  end if;

  select *
  into previous_request
  from public.overtime_requests
  where id = request_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Pengajuan lembur tidak ditemukan.';
  end if;

  if previous_request.status <> 'pending'
    or previous_request.request_version <> expected_version then
    raise exception using
      errcode = '40001',
      message = 'Pengajuan lembur sudah diputuskan atau berubah.';
  end if;

  if previous_request.employee_id = public.current_employee_id() then
    raise exception using
      errcode = '42501',
      message = 'Supervisor tidak dapat memutuskan lemburnya sendiri.';
  end if;

  update public.overtime_requests
  set
    status = decision::public.request_status,
    approved_duration_min = case
      when decision = 'approved' then approved_minutes
      else 0
    end,
    request_version = request_version + 1,
    decided_by = (select auth.uid()),
    decided_at = now(),
    decision_note = nullif(trim(note), '')
  where id = request_id
    and status = 'pending'
    and request_version = expected_version
  returning * into decided_request;

  if not found then
    raise exception using
      errcode = '40001',
      message = 'Pengajuan lembur sudah diputuskan oleh supervisor lain.';
  end if;

  perform public.workforce_notify_employee(
    previous_request.employee_id,
    'overtime_request_decided',
    case
      when decision = 'approved' then 'Lembur disetujui'
      else 'Lembur ditolak'
    end,
    case
      when decision = 'approved'
        then format('Lembur disetujui selama %s menit.', approved_minutes)
      else format('Lembur ditolak: %s', trim(note))
    end,
    'overtime_request',
    decided_request.id,
    jsonb_build_object(
      'status', decided_request.status,
      'approved_duration_min', decided_request.approved_duration_min,
      'request_version', decided_request.request_version
    )
  );

  insert into public.approval_events (
    subject_type,
    subject_id,
    actor_id,
    action,
    note,
    subject_version
  )
  values (
    'overtime_request',
    request_id,
    (select auth.uid()),
    decision,
    nullif(trim(note), ''),
    decided_request.request_version
  );

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    before_values,
    after_values,
    reason
  )
  values (
    (select auth.uid()),
    'decide',
    'overtime_request',
    request_id,
    to_jsonb(previous_request),
    to_jsonb(decided_request),
    nullif(trim(note), '')
  );

  return decided_request;
end;
$$;

drop policy if exists leave_documents_delete_own on storage.objects;
create policy leave_documents_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'leave-documents'
  and (storage.foldername(name))[1]
    = (select public.current_employee_id())::text
);

revoke all on function public.workforce_notify_employee(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  jsonb
) from public, anon, authenticated;
revoke all on function public.workforce_notify_supervisors(
  text,
  text,
  text,
  text,
  uuid,
  jsonb,
  uuid
) from public, anon, authenticated;
revoke all on function public.ensure_annual_leave_entitlement(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.workforce_planned_overtime_minutes(time, time)
  from public, anon, authenticated;
revoke all on function public.get_leave_workspace()
  from public, anon, authenticated;
revoke all on function public.save_leave_type(
  uuid,
  text,
  text,
  boolean,
  integer,
  boolean,
  boolean,
  integer,
  boolean,
  text
) from public, anon, authenticated;
revoke all on function public.submit_leave_request(
  uuid,
  uuid,
  date,
  date,
  text,
  jsonb
) from public, anon, authenticated;
revoke all on function public.cancel_leave_request(uuid, integer, text)
  from public, anon, authenticated;
revoke all on function public.decide_leave_request(uuid, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.get_overtime_workspace()
  from public, anon, authenticated;
revoke all on function public.submit_overtime_request(
  date,
  time,
  time,
  text
) from public, anon, authenticated;
revoke all on function public.assign_overtime_request(
  uuid,
  date,
  time,
  time,
  text
) from public, anon, authenticated;
revoke all on function public.cancel_overtime_request(uuid, integer, text)
  from public, anon, authenticated;
revoke all on function public.refresh_overtime_actual(uuid)
  from public, anon, authenticated;
revoke all on function public.decide_overtime_request(
  uuid,
  text,
  integer,
  text,
  integer
) from public, anon, authenticated;

grant execute on function public.get_leave_workspace() to authenticated;
grant execute on function public.save_leave_type(
  uuid,
  text,
  text,
  boolean,
  integer,
  boolean,
  boolean,
  integer,
  boolean,
  text
) to authenticated;
grant execute on function public.submit_leave_request(
  uuid,
  uuid,
  date,
  date,
  text,
  jsonb
) to authenticated;
grant execute on function public.cancel_leave_request(uuid, integer, text)
  to authenticated;
grant execute on function public.decide_leave_request(
  uuid,
  text,
  text,
  integer
) to authenticated;
grant execute on function public.get_overtime_workspace() to authenticated;
grant execute on function public.submit_overtime_request(
  date,
  time,
  time,
  text
) to authenticated;
grant execute on function public.assign_overtime_request(
  uuid,
  date,
  time,
  time,
  text
) to authenticated;
grant execute on function public.cancel_overtime_request(uuid, integer, text)
  to authenticated;
grant execute on function public.refresh_overtime_actual(uuid)
  to authenticated;
grant execute on function public.decide_overtime_request(
  uuid,
  text,
  integer,
  text,
  integer
) to authenticated;
