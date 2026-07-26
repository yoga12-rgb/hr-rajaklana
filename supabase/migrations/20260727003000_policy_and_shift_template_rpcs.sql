create or replace function public.publish_policy_version(
  p_policy_type text,
  p_configuration jsonb,
  p_reason text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  normalized_policy_type text := lower(trim(p_policy_type));
  current_policy public.policy_versions%rowtype;
  merged_configuration jsonb;
  next_version integer;
  new_policy_id uuid;
begin
  if not public.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'Aksi ini hanya dapat dilakukan supervisor.';
  end if;

  if normalized_policy_type not in ('attendance', 'leave', 'overtime', 'roster') then
    raise exception using
      errcode = '22023',
      message = 'Jenis kebijakan tidak didukung.';
  end if;

  if p_configuration is null
    or jsonb_typeof(p_configuration) <> 'object'
    or p_configuration = '{}'::jsonb then
    raise exception using
      errcode = '22023',
      message = 'Konfigurasi kebijakan wajib berupa objek yang tidak kosong.';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Alasan perubahan kebijakan wajib diisi.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('policy:' || normalized_policy_type, 0)
  );

  select *
  into current_policy
  from public.policy_versions
  where policy_type = normalized_policy_type
    and effective_until is null
  order by version_number desc
  limit 1
  for update;

  merged_configuration :=
    coalesce(current_policy.configuration, '{}'::jsonb) || p_configuration;

  if normalized_policy_type = 'attendance' then
    if (merged_configuration->>'clock_in_early_minutes')::integer not between 0 and 180
      or (merged_configuration->>'late_tolerance_minutes')::integer not between 0 and 180
      or (merged_configuration->>'early_checkout_tolerance_minutes')::integer not between 0 and 180
      or jsonb_typeof(merged_configuration->'clock_in_selfie_required') <> 'boolean' then
      raise exception using
        errcode = '22023',
        message = 'Konfigurasi kebijakan presensi tidak valid.';
    end if;
  elsif normalized_policy_type = 'leave' then
    if (merged_configuration->>'annual_entitlement_days')::integer not between 0 and 365
      or (merged_configuration->>'annual_notice_days')::integer not between 0 and 90
      or jsonb_typeof(merged_configuration->'carry_forward') <> 'boolean' then
      raise exception using
        errcode = '22023',
        message = 'Konfigurasi kebijakan cuti tidak valid.';
    end if;
  elsif normalized_policy_type = 'overtime' then
    if (merged_configuration->>'minimum_minutes')::integer not between 30 and 1440
      or (merged_configuration->>'increment_minutes')::integer not between 1 and 240 then
      raise exception using
        errcode = '22023',
        message = 'Konfigurasi kebijakan lembur tidak valid.';
    end if;
  end if;

  select coalesce(max(version_number), 0) + 1
  into next_version
  from public.policy_versions
  where policy_type = normalized_policy_type;

  if current_policy.id is not null then
    update public.policy_versions
    set effective_until = pg_catalog.clock_timestamp()
    where id = current_policy.id;
  end if;

  insert into public.policy_versions (
    policy_type,
    version_number,
    configuration,
    effective_from,
    created_by
  )
  values (
    normalized_policy_type,
    next_version,
    merged_configuration,
    pg_catalog.clock_timestamp(),
    auth.uid()
  )
  returning id into new_policy_id;

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
    auth.uid(),
    'publish_policy_version',
    'policy_version',
    new_policy_id,
    case
      when current_policy.id is null then null
      else to_jsonb(current_policy)
    end,
    (
      select to_jsonb(policy)
      from public.policy_versions policy
      where policy.id = new_policy_id
    ),
    trim(p_reason)
  );

  return new_policy_id;
end;
$$;

create or replace function public.publish_work_policy(
  p_attendance_configuration jsonb,
  p_overtime_configuration jsonb,
  p_reason text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  attendance_policy_id uuid;
  overtime_policy_id uuid;
begin
  attendance_policy_id := public.publish_policy_version(
    'attendance',
    p_attendance_configuration,
    p_reason
  );
  overtime_policy_id := public.publish_policy_version(
    'overtime',
    p_overtime_configuration,
    p_reason
  );

  return jsonb_build_object(
    'attendance_policy_id',
    attendance_policy_id,
    'overtime_policy_id',
    overtime_policy_id
  );
end;
$$;

create or replace function public.replace_outlet_shift_template(
  p_outlet_id uuid,
  p_shift_type public.shift_type,
  p_starts_at time,
  p_ends_at time,
  p_late_tolerance_min integer,
  p_early_checkout_tolerance_min integer,
  p_reason text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  existing_template public.outlet_shift_templates%rowtype;
  new_template_id uuid;
begin
  if not public.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'Aksi ini hanya dapat dilakukan supervisor.';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Alasan perubahan template shift wajib diisi.';
  end if;

  if p_late_tolerance_min not between 0 and 180
    or p_early_checkout_tolerance_min not between 0 and 180 then
    raise exception using
      errcode = '22023',
      message = 'Toleransi shift harus berada antara 0 dan 180 menit.';
  end if;

  if not exists (
    select 1
    from public.outlets
    where id = p_outlet_id
      and is_active
  ) then
    raise exception using
      errcode = '23503',
      message = 'Outlet aktif tidak ditemukan.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'shift-template:' || p_outlet_id::text || ':' || p_shift_type::text,
      0
    )
  );

  select *
  into existing_template
  from public.outlet_shift_templates
  where outlet_id = p_outlet_id
    and shift_type = p_shift_type
    and is_active
  limit 1
  for update;

  if existing_template.id is not null then
    update public.outlet_shift_templates
    set
      is_active = false,
      updated_at = pg_catalog.clock_timestamp()
    where id = existing_template.id;
  end if;

  insert into public.outlet_shift_templates (
    outlet_id,
    shift_type,
    starts_at,
    ends_at,
    late_tolerance_min,
    early_checkout_tolerance_min
  )
  values (
    p_outlet_id,
    p_shift_type,
    p_starts_at,
    p_ends_at,
    p_late_tolerance_min,
    p_early_checkout_tolerance_min
  )
  returning id into new_template_id;

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
    auth.uid(),
    'replace_outlet_shift_template',
    'outlet_shift_template',
    new_template_id,
    case
      when existing_template.id is null then null
      else to_jsonb(existing_template)
    end,
    (
      select to_jsonb(template)
      from public.outlet_shift_templates template
      where template.id = new_template_id
    ),
    trim(p_reason)
  );

  return new_template_id;
end;
$$;

revoke all on function public.publish_policy_version(text, jsonb, text)
  from public, anon;
revoke all on function public.publish_work_policy(jsonb, jsonb, text)
  from public, anon;
revoke all on function public.replace_outlet_shift_template(
  uuid,
  public.shift_type,
  time,
  time,
  integer,
  integer,
  text
) from public, anon;

grant execute on function public.publish_policy_version(text, jsonb, text)
  to authenticated;
grant execute on function public.publish_work_policy(jsonb, jsonb, text)
  to authenticated;
grant execute on function public.replace_outlet_shift_template(
  uuid,
  public.shift_type,
  time,
  time,
  integer,
  integer,
  text
) to authenticated;
