create or replace function public.preview_attendance_geofence(
  p_outlet_id uuid,
  p_latitude numeric,
  p_longitude numeric,
  p_accuracy_m numeric,
  p_captured_at timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  requester_id uuid := public.current_employee_id();
  requester_role public.access_role := public.current_access_role();
  now_at timestamptz := pg_catalog.statement_timestamp();
  today_local date := (pg_catalog.statement_timestamp() at time zone 'Asia/Jakarta')::date;
  selected_outlet public.outlets%rowtype;
  policy jsonb;
  max_accuracy numeric;
  distance_m numeric;
  location_age_seconds integer;
  outlet_authorized boolean;
begin
  if requester_id is null
    or requester_role not in ('employee', 'supervisor') then
    raise exception using
      errcode = '42501',
      message = 'Akun ini tidak dapat memeriksa geofence presensi.';
  end if;

  if p_latitude is null
    or p_latitude not between -90 and 90
    or p_longitude is null
    or p_longitude not between -180 and 180
    or p_accuracy_m is null
    or p_accuracy_m < 0
    or p_captured_at is null then
    raise exception using
      errcode = '22023',
      message = 'Data lokasi perangkat tidak valid.';
  end if;

  select *
  into selected_outlet
  from public.outlets
  where id = p_outlet_id
    and is_active;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Outlet aktif tidak ditemukan.';
  end if;

  outlet_authorized := requester_role = 'supervisor'
    or exists (
      select 1
      from public.schedule_assignments assignment
      join public.roster_versions roster_version
        on roster_version.id = assignment.roster_version_id
      join public.roster_periods roster_period
        on roster_period.id = roster_version.roster_period_id
      where assignment.employee_id = requester_id
        and assignment.work_date = today_local
        and assignment.status = 'scheduled'
        and assignment.outlet_id = p_outlet_id
        and roster_version.status = 'published'
        and roster_period.active_version_id = roster_version.id
    );

  if not outlet_authorized then
    raise exception using
      errcode = '42501',
      message = 'Outlet ini tidak sesuai dengan jadwal presensi.';
  end if;

  select version.configuration
  into policy
  from public.policy_versions version
  where version.policy_type = 'attendance'
    and version.effective_from <= now_at
    and (version.effective_until is null or version.effective_until > now_at)
  order by version.version_number desc
  limit 1;

  max_accuracy := coalesce((policy->>'gps_max_accuracy_m')::numeric, 100);
  distance_m := public.attendance_distance_m(
    p_latitude,
    p_longitude,
    selected_outlet.latitude,
    selected_outlet.longitude
  );
  location_age_seconds := greatest(
    0,
    floor(extract(epoch from (now_at - p_captured_at)))::integer
  );

  return jsonb_build_object(
    'outlet_id', selected_outlet.id,
    'outlet_name', selected_outlet.name,
    'distance_m', distance_m,
    'radius_m', selected_outlet.geofence_radius_m,
    'within_geofence', distance_m <= selected_outlet.geofence_radius_m,
    'accuracy_m', p_accuracy_m,
    'max_accuracy_m', max_accuracy,
    'accuracy_ok', p_accuracy_m <= max_accuracy,
    'location_age_seconds', location_age_seconds,
    'location_fresh', location_age_seconds <= 120
  );
end;
$$;

revoke all on function public.preview_attendance_geofence(
  uuid, numeric, numeric, numeric, timestamptz
) from public, anon;

grant execute on function public.preview_attendance_geofence(
  uuid, numeric, numeric, numeric, timestamptz
) to authenticated;
