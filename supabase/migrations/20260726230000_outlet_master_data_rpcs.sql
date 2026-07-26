create or replace function public.create_outlet_master(
  p_code text,
  p_name text,
  p_address text,
  p_latitude numeric,
  p_longitude numeric,
  p_geofence_radius_m integer,
  p_reason text default 'Supervisor membuat outlet'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  new_outlet_id uuid;
begin
  if not public.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'Aksi ini hanya dapat dilakukan supervisor.';
  end if;

  insert into public.outlets (
    code,
    name,
    address,
    latitude,
    longitude,
    geofence_radius_m
  )
  values (
    upper(trim(p_code)),
    trim(p_name),
    trim(p_address),
    p_latitude,
    p_longitude,
    p_geofence_radius_m
  )
  returning id into new_outlet_id;

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    after_values,
    reason
  )
  select
    auth.uid(),
    'create_outlet_master',
    'outlet',
    outlet.id,
    to_jsonb(outlet),
    coalesce(nullif(trim(p_reason), ''), 'supervisor_created_outlet')
  from public.outlets outlet
  where outlet.id = new_outlet_id;

  return new_outlet_id;
end;
$$;

create or replace function public.update_outlet_master(
  p_outlet_id uuid,
  p_code text,
  p_name text,
  p_address text,
  p_latitude numeric,
  p_longitude numeric,
  p_geofence_radius_m integer,
  p_reason text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  outlet_before jsonb;
begin
  if not public.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'Aksi ini hanya dapat dilakukan supervisor.';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Alasan perubahan outlet wajib diisi.';
  end if;

  select to_jsonb(outlet)
  into outlet_before
  from public.outlets outlet
  where outlet.id = p_outlet_id
  for update;

  if outlet_before is null then
    raise exception using
      errcode = 'P0002',
      message = 'Outlet tidak ditemukan.';
  end if;

  update public.outlets
  set
    code = upper(trim(p_code)),
    name = trim(p_name),
    address = trim(p_address),
    latitude = p_latitude,
    longitude = p_longitude,
    geofence_radius_m = p_geofence_radius_m
  where id = p_outlet_id;

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    before_values,
    after_values,
    reason
  )
  select
    auth.uid(),
    'update_outlet_master',
    'outlet',
    outlet.id,
    outlet_before,
    to_jsonb(outlet),
    trim(p_reason)
  from public.outlets outlet
  where outlet.id = p_outlet_id;
end;
$$;

create or replace function public.set_outlet_active(
  p_outlet_id uuid,
  p_is_active boolean,
  p_reason text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  outlet_before jsonb;
begin
  if not public.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'Aksi ini hanya dapat dilakukan supervisor.';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Alasan perubahan status outlet wajib diisi.';
  end if;

  select to_jsonb(outlet)
  into outlet_before
  from public.outlets outlet
  where outlet.id = p_outlet_id
  for update;

  if outlet_before is null then
    raise exception using
      errcode = 'P0002',
      message = 'Outlet tidak ditemukan.';
  end if;

  if not p_is_active and exists (
    select 1
    from public.employee_placements placement
    where placement.outlet_id = p_outlet_id
      and placement.end_date is null
  ) then
    raise exception using
      errcode = '23503',
      message = 'Outlet masih memiliki penempatan karyawan aktif.';
  end if;

  update public.outlets
  set is_active = p_is_active
  where id = p_outlet_id;

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    before_values,
    after_values,
    reason
  )
  select
    auth.uid(),
    case when p_is_active then 'activate_outlet' else 'deactivate_outlet' end,
    'outlet',
    outlet.id,
    outlet_before,
    to_jsonb(outlet),
    trim(p_reason)
  from public.outlets outlet
  where outlet.id = p_outlet_id;
end;
$$;

revoke all on function public.create_outlet_master(
  text,
  text,
  text,
  numeric,
  numeric,
  integer,
  text
) from public, anon;
revoke all on function public.update_outlet_master(
  uuid,
  text,
  text,
  text,
  numeric,
  numeric,
  integer,
  text
) from public, anon;
revoke all on function public.set_outlet_active(uuid, boolean, text)
  from public, anon;

grant execute on function public.create_outlet_master(
  text,
  text,
  text,
  numeric,
  numeric,
  integer,
  text
) to authenticated;
grant execute on function public.update_outlet_master(
  uuid,
  text,
  text,
  text,
  numeric,
  numeric,
  integer,
  text
) to authenticated;
grant execute on function public.set_outlet_active(uuid, boolean, text)
  to authenticated;
