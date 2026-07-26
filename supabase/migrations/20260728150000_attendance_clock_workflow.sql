alter table public.attendance_records
  add column client_event_id uuid,
  add column clock_in_distance_m numeric(10, 2)
    check (clock_in_distance_m >= 0),
  add column clock_out_distance_m numeric(10, 2)
    check (clock_out_distance_m >= 0),
  add column clock_in_state text not null default 'on_time'
    check (clock_in_state in ('on_time', 'late', 'flexible')),
  add column clock_out_state text
    check (
      clock_out_state is null
      or clock_out_state in (
        'on_time',
        'early',
        'potential_overtime',
        'short_hours',
        'complete'
      )
    ),
  add column notes text
    check (notes is null or length(notes) <= 500);

create unique index attendance_client_event_unique
  on public.attendance_records (employee_id, client_event_id)
  where client_event_id is not null;

update public.policy_versions
set configuration = configuration || jsonb_build_object(
  'clock_in_selfie_required',
  true,
  'gps_max_accuracy_m',
  100
)
where policy_type = 'attendance'
  and effective_until is null;

create or replace function public.attendance_distance_m(
  p_latitude_a numeric,
  p_longitude_a numeric,
  p_latitude_b numeric,
  p_longitude_b numeric
)
returns numeric
language sql
immutable
security definer
set search_path = ''
as $$
  select round(
    (
      6371000 * 2 * asin(
        least(
          1,
          sqrt(
            power(
              sin(radians((p_latitude_b - p_latitude_a)::double precision) / 2),
              2
            )
            + cos(radians(p_latitude_a::double precision))
              * cos(radians(p_latitude_b::double precision))
              * power(
                sin(
                  radians((p_longitude_b - p_longitude_a)::double precision) / 2
                ),
                2
              )
          )
        )
      )
    )::numeric,
    2
  );
$$;

create or replace function public.get_attendance_workspace()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  requester_id uuid := public.current_employee_id();
  requester_role public.access_role := public.current_access_role();
  today_local date := (pg_catalog.clock_timestamp() at time zone 'Asia/Jakarta')::date;
  policy jsonb;
begin
  if requester_id is null or requester_role is null then
    raise exception using
      errcode = '42501',
      message = 'Akun aktif yang terhubung ke karyawan diperlukan.';
  end if;

  select version.configuration
  into policy
  from public.policy_versions version
  where version.policy_type = 'attendance'
    and version.effective_from <= pg_catalog.clock_timestamp()
    and (
      version.effective_until is null
      or version.effective_until > pg_catalog.clock_timestamp()
    )
  order by version.version_number desc
  limit 1;

  return jsonb_build_object(
    'role', requester_role,
    'current_employee_id', requester_id,
    'server_time', pg_catalog.clock_timestamp(),
    'policy', coalesce(policy, '{}'::jsonb),
    'requires_selfie',
      requester_role = 'employee'
      and exists (
        select 1
        from public.employees employee
        join public.job_positions position on position.id = employee.job_position_id
        where employee.id = requester_id
          and position.auto_roster_eligible
      ),
    'open_session', (
      select to_jsonb(record)
      from (
        select
          attendance.id,
          attendance.outlet_id,
          outlet.name as outlet_name,
          attendance.schedule_assignment_id,
          attendance.clock_in_at,
          attendance.clock_in_state,
          attendance.clock_in_distance_m,
          attendance.notes
        from public.attendance_records attendance
        join public.outlets outlet on outlet.id = attendance.outlet_id
        where attendance.employee_id = requester_id
          and attendance.clock_out_at is null
        limit 1
      ) record
    ),
    'today_assignment', (
      select to_jsonb(assignment)
      from (
        select
          schedule.id,
          schedule.outlet_id,
          outlet.name as outlet_name,
          outlet.address as outlet_address,
          schedule.work_date,
          schedule.planned_start,
          schedule.planned_end,
          schedule.planned_duration_min
        from public.schedule_assignments schedule
        join public.roster_versions roster_version
          on roster_version.id = schedule.roster_version_id
        join public.roster_periods roster_period
          on roster_period.id = roster_version.roster_period_id
        join public.outlets outlet on outlet.id = schedule.outlet_id
        where schedule.employee_id = requester_id
          and schedule.work_date = today_local
          and schedule.status = 'scheduled'
          and roster_version.status = 'published'
          and roster_period.active_version_id = roster_version.id
        limit 1
      ) assignment
    ),
    'available_outlets', (
      select coalesce(jsonb_agg(to_jsonb(outlet_row) order by outlet_row.name), '[]'::jsonb)
      from (
        select
          outlet.id,
          outlet.name,
          outlet.address,
          outlet.geofence_radius_m
        from public.outlets outlet
        where outlet.is_active
          and (
            requester_role = 'supervisor'
            or exists (
              select 1
              from public.schedule_assignments schedule
              join public.roster_versions roster_version
                on roster_version.id = schedule.roster_version_id
              join public.roster_periods roster_period
                on roster_period.id = roster_version.roster_period_id
              where schedule.employee_id = requester_id
                and schedule.work_date = today_local
                and schedule.status = 'scheduled'
                and schedule.outlet_id = outlet.id
                and roster_version.status = 'published'
                and roster_period.active_version_id = roster_version.id
            )
          )
      ) outlet_row
    ),
    'history', (
      select coalesce(
        jsonb_agg(to_jsonb(history_row) order by history_row.clock_in_at desc),
        '[]'::jsonb
      )
      from (
        select
          attendance.id,
          attendance.work_date,
          outlet.name as outlet_name,
          attendance.clock_in_at,
          attendance.clock_out_at,
          attendance.worked_duration_min,
          attendance.clock_in_state,
          attendance.clock_out_state,
          attendance.validation_status,
          attendance.clock_in_distance_m,
          attendance.clock_out_distance_m
        from public.attendance_records attendance
        join public.outlets outlet on outlet.id = attendance.outlet_id
        where attendance.employee_id = requester_id
        order by attendance.clock_in_at desc
        limit 30
      ) history_row
    )
  );
end;
$$;

create or replace function public.clock_in_attendance(
  p_client_event_id uuid,
  p_outlet_id uuid,
  p_latitude numeric,
  p_longitude numeric,
  p_accuracy_m numeric,
  p_captured_at timestamptz,
  p_location_mocked boolean default false,
  p_evidence jsonb default null,
  p_notes text default null
)
returns public.attendance_records
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  requester_id uuid := public.current_employee_id();
  requester_role public.access_role := public.current_access_role();
  now_at timestamptz := pg_catalog.clock_timestamp();
  today_local date := (pg_catalog.clock_timestamp() at time zone 'Asia/Jakarta')::date;
  selected_outlet public.outlets%rowtype;
  schedule public.schedule_assignments%rowtype;
  policy jsonb;
  max_accuracy numeric;
  distance_m numeric;
  early_minutes integer;
  late_minutes integer;
  planned_start_at timestamptz;
  is_cashier boolean;
  evidence_path text;
  evidence_mime text;
  evidence_size bigint;
  result public.attendance_records%rowtype;
begin
  if requester_id is null
    or requester_role not in ('employee', 'supervisor') then
    raise exception using
      errcode = '42501',
      message = 'Akun ini tidak dapat melakukan presensi.';
  end if;

  if p_client_event_id is null then
    raise exception using errcode = '22023', message = 'ID percobaan presensi wajib tersedia.';
  end if;

  select *
  into result
  from public.attendance_records
  where employee_id = requester_id
    and client_event_id = p_client_event_id;

  if found then
    return result;
  end if;

  if exists (
    select 1
    from public.attendance_records
    where employee_id = requester_id
      and clock_out_at is null
  ) then
    raise exception using
      errcode = '23505',
      message = 'Masih ada sesi presensi yang belum clock-out.';
  end if;

  if p_captured_at is null
    or abs(extract(epoch from (now_at - p_captured_at))) > 120 then
    raise exception using
      errcode = '22023',
      message = 'Lokasi sudah kedaluwarsa. Ambil lokasi perangkat kembali.';
  end if;

  select *
  into selected_outlet
  from public.outlets
  where id = p_outlet_id
    and is_active;

  if not found then
    raise exception using errcode = 'P0002', message = 'Outlet aktif tidak ditemukan.';
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
  early_minutes := coalesce((policy->>'clock_in_early_minutes')::integer, 60);
  late_minutes := coalesce((policy->>'late_tolerance_minutes')::integer, 15);

  if p_accuracy_m is null or p_accuracy_m < 0 or p_accuracy_m > max_accuracy then
    raise exception using
      errcode = '22023',
      message = format(
        'Akurasi GPS belum memadai (%s m). Batas maksimal %s m.',
        coalesce(round(p_accuracy_m, 0)::text, '-'),
        round(max_accuracy, 0)
      );
  end if;

  distance_m := public.attendance_distance_m(
    p_latitude,
    p_longitude,
    selected_outlet.latitude,
    selected_outlet.longitude
  );

  if distance_m > selected_outlet.geofence_radius_m then
    raise exception using
      errcode = '22023',
      message = format(
        'Posisi berada di luar geofence (%s m dari batas %s m).',
        round(distance_m, 0),
        selected_outlet.geofence_radius_m
      );
  end if;

  if requester_role = 'employee' then
    select assignment.*
    into schedule
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
    limit 1;

    if not found then
      raise exception using
        errcode = '42501',
        message = 'Jadwal terbit pada outlet ini tidak ditemukan.';
    end if;

    planned_start_at :=
      (schedule.work_date + schedule.planned_start) at time zone 'Asia/Jakarta';

    if now_at < planned_start_at - make_interval(mins => early_minutes) then
      raise exception using
        errcode = '22023',
        message = format(
          'Clock-in baru tersedia %s menit sebelum jadwal.',
          early_minutes
        );
    end if;
  end if;

  select position.auto_roster_eligible
  into is_cashier
  from public.employees employee
  join public.job_positions position on position.id = employee.job_position_id
  where employee.id = requester_id;

  if requester_role = 'employee'
    and coalesce(is_cashier, false)
    and coalesce((policy->>'clock_in_selfie_required')::boolean, true) then
    if p_evidence is null then
      raise exception using
        errcode = '23514',
        message = 'Selfie dari kamera wajib tersedia saat clock-in.';
    end if;

    evidence_path := nullif(trim(p_evidence->>'storage_path'), '');
    evidence_mime := nullif(trim(p_evidence->>'mime_type'), '');
    evidence_size := (p_evidence->>'size_bytes')::bigint;

    if evidence_path is null
      or evidence_path !~ (
        '^' || requester_id::text || '/' || to_char(today_local, 'YYYY/MM/DD')
        || '/' || p_client_event_id::text || '\.(jpg|webp)$'
      )
      or evidence_mime not in ('image/jpeg', 'image/webp')
      or evidence_size <= 0
      or evidence_size > 5242880 then
      raise exception using
        errcode = '23514',
        message = 'Metadata selfie tidak valid.';
    end if;

    if not exists (
      select 1
      from storage.objects object
      where object.bucket_id = 'attendance-selfies'
        and object.name = evidence_path
        and (object.metadata->>'mimetype') = evidence_mime
        and (object.metadata->>'size')::bigint = evidence_size
    ) then
      raise exception using
        errcode = 'P0002',
        message = 'File selfie private belum tersedia di Storage.';
    end if;
  end if;

  insert into public.attendance_records (
    id,
    employee_id,
    client_event_id,
    schedule_assignment_id,
    outlet_id,
    work_date,
    clock_in_at,
    clock_in_latitude,
    clock_in_longitude,
    clock_in_accuracy_m,
    clock_in_distance_m,
    clock_in_state,
    notes
  )
  values (
    p_client_event_id,
    requester_id,
    p_client_event_id,
    schedule.id,
    p_outlet_id,
    today_local,
    now_at,
    p_latitude,
    p_longitude,
    p_accuracy_m,
    distance_m,
    case
      when requester_role = 'supervisor' then 'flexible'
      when now_at > planned_start_at + make_interval(mins => late_minutes) then 'late'
      else 'on_time'
    end,
    nullif(trim(p_notes), '')
  )
  returning * into result;

  if evidence_path is not null then
    insert into public.attendance_evidence (
      attendance_record_id,
      evidence_type,
      storage_path,
      mime_type,
      size_bytes
    )
    values (
      result.id,
      'clock_in_selfie',
      evidence_path,
      evidence_mime,
      evidence_size
    );
  end if;

  if coalesce(p_location_mocked, false) then
    insert into public.attendance_risk_flags (
      attendance_record_id,
      flag_type,
      severity,
      evidence
    )
    values (
      result.id,
      'client_mock_location_signal',
      'high',
      jsonb_build_object('phase', 'clock_in')
    );
  end if;

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
    'clock_in',
    'attendance_record',
    result.id,
    to_jsonb(result),
    'Presensi masuk melalui geofence'
  );

  return result;
end;
$$;

create or replace function public.clock_out_attendance(
  p_attendance_id uuid,
  p_latitude numeric,
  p_longitude numeric,
  p_accuracy_m numeric,
  p_captured_at timestamptz,
  p_location_mocked boolean default false
)
returns public.attendance_records
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  requester_id uuid := public.current_employee_id();
  requester_role public.access_role := public.current_access_role();
  now_at timestamptz := pg_catalog.clock_timestamp();
  previous_record public.attendance_records%rowtype;
  result public.attendance_records%rowtype;
  selected_outlet public.outlets%rowtype;
  schedule public.schedule_assignments%rowtype;
  policy jsonb;
  max_accuracy numeric;
  distance_m numeric;
  early_minutes integer;
  planned_end_at timestamptz;
  duration_min integer;
  checkout_state text;
begin
  if requester_id is null
    or requester_role not in ('employee', 'supervisor') then
    raise exception using errcode = '42501', message = 'Akun ini tidak dapat melakukan presensi.';
  end if;

  select *
  into previous_record
  from public.attendance_records
  where id = p_attendance_id
    and employee_id = requester_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Sesi presensi tidak ditemukan.';
  end if;

  if previous_record.clock_out_at is not null then
    return previous_record;
  end if;

  if p_captured_at is null
    or abs(extract(epoch from (now_at - p_captured_at))) > 120 then
    raise exception using errcode = '22023', message = 'Lokasi sudah kedaluwarsa. Ambil lokasi perangkat kembali.';
  end if;

  select * into selected_outlet
  from public.outlets
  where id = previous_record.outlet_id;

  select version.configuration
  into policy
  from public.policy_versions version
  where version.policy_type = 'attendance'
    and version.effective_from <= now_at
    and (version.effective_until is null or version.effective_until > now_at)
  order by version.version_number desc
  limit 1;

  max_accuracy := coalesce((policy->>'gps_max_accuracy_m')::numeric, 100);
  early_minutes := coalesce((policy->>'early_checkout_tolerance_minutes')::integer, 15);

  if p_accuracy_m is null or p_accuracy_m < 0 or p_accuracy_m > max_accuracy then
    raise exception using
      errcode = '22023',
      message = format(
        'Akurasi GPS belum memadai (%s m). Batas maksimal %s m.',
        coalesce(round(p_accuracy_m, 0)::text, '-'),
        round(max_accuracy, 0)
      );
  end if;

  distance_m := public.attendance_distance_m(
    p_latitude,
    p_longitude,
    selected_outlet.latitude,
    selected_outlet.longitude
  );

  if distance_m > selected_outlet.geofence_radius_m then
    raise exception using
      errcode = '22023',
      message = format(
        'Clock-out harus di dalam geofence (%s m dari batas %s m).',
        round(distance_m, 0),
        selected_outlet.geofence_radius_m
      );
  end if;

  duration_min := greatest(
    0,
    floor(extract(epoch from (now_at - previous_record.clock_in_at)) / 60)::integer
  );

  if requester_role = 'supervisor' then
    checkout_state := case
      when duration_min < 480 then 'short_hours'
      when duration_min > 480 then 'potential_overtime'
      else 'complete'
    end;
  elsif previous_record.schedule_assignment_id is not null then
    select * into schedule
    from public.schedule_assignments
    where id = previous_record.schedule_assignment_id;

    planned_end_at :=
      (schedule.work_date + schedule.planned_end) at time zone 'Asia/Jakarta'
      + case
          when schedule.planned_end <= schedule.planned_start
            then interval '1 day'
          else interval '0 days'
        end;

    checkout_state := case
      when now_at < planned_end_at - make_interval(mins => early_minutes) then 'early'
      when now_at > planned_end_at then 'potential_overtime'
      else 'on_time'
    end;
  else
    checkout_state := 'complete';
  end if;

  update public.attendance_records
  set
    clock_out_at = now_at,
    clock_out_latitude = p_latitude,
    clock_out_longitude = p_longitude,
    clock_out_accuracy_m = p_accuracy_m,
    clock_out_distance_m = distance_m,
    worked_duration_min = duration_min,
    clock_out_state = checkout_state,
    attendance_status = 'completed',
    validation_due_at = now_at
      + make_interval(
          days => coalesce((policy->>'validation_deadline_days')::integer, 3)
        ),
    record_version = record_version + 1
  where id = previous_record.id
  returning * into result;

  if coalesce(p_location_mocked, false) then
    insert into public.attendance_risk_flags (
      attendance_record_id,
      flag_type,
      severity,
      evidence
    )
    values (
      result.id,
      'client_mock_location_signal',
      'high',
      jsonb_build_object('phase', 'clock_out')
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
    'clock_out',
    'attendance_record',
    result.id,
    to_jsonb(previous_record),
    to_jsonb(result),
    'Presensi pulang melalui geofence'
  );

  return result;
end;
$$;

drop policy if exists attendance_records_insert_own on public.attendance_records;
drop policy if exists attendance_records_manage_supervisor on public.attendance_records;
drop policy if exists attendance_evidence_insert_own on public.attendance_evidence;

revoke insert, update, delete on public.attendance_records from authenticated;
revoke insert, update, delete on public.attendance_evidence from authenticated;
revoke insert, update, delete on public.attendance_risk_flags from authenticated;

create policy attendance_selfies_delete_unregistered_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'attendance-selfies'
  and (storage.foldername(name))[1] =
    (select public.current_employee_id())::text
  and not exists (
    select 1
    from public.attendance_evidence evidence
    where evidence.storage_bucket = bucket_id
      and evidence.storage_path = name
  )
);

revoke all on function public.attendance_distance_m(numeric, numeric, numeric, numeric)
  from public;
revoke all on function public.get_attendance_workspace() from public;
revoke all on function public.clock_in_attendance(
  uuid, uuid, numeric, numeric, numeric, timestamptz, boolean, jsonb, text
) from public;
revoke all on function public.clock_out_attendance(
  uuid, numeric, numeric, numeric, timestamptz, boolean
) from public;

grant execute on function public.get_attendance_workspace() to authenticated;
grant execute on function public.clock_in_attendance(
  uuid, uuid, numeric, numeric, numeric, timestamptz, boolean, jsonb, text
) to authenticated;
grant execute on function public.clock_out_attendance(
  uuid, numeric, numeric, numeric, timestamptz, boolean
) to authenticated;
