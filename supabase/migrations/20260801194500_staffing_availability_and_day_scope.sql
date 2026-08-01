-- Staffing targets describe the people actually working on a date, after
-- off/leave and backup movements. Middle may explicitly be zero and targets
-- can differ between weekdays and weekends.

alter table public.outlet_staffing_requirements
  add column day_scope text;

alter table public.outlet_staffing_requirements
  drop constraint outlet_staffing_requirements_outlet_id_shift_template_id_ca_key,
  drop constraint outlet_staffing_requirements_minimum_staff_check;

update public.outlet_staffing_requirements
set day_scope = 'weekday';

insert into public.outlet_staffing_requirements (
  outlet_id,
  shift_template_id,
  cashier_count,
  minimum_staff,
  effective_from,
  effective_until,
  created_at,
  updated_at,
  day_scope
)
select
  requirement.outlet_id,
  requirement.shift_template_id,
  requirement.cashier_count,
  requirement.minimum_staff,
  requirement.effective_from,
  requirement.effective_until,
  requirement.created_at,
  requirement.updated_at,
  'weekend'
from public.outlet_staffing_requirements requirement
where requirement.day_scope = 'weekday';

alter table public.outlet_staffing_requirements
  alter column day_scope set default 'weekday',
  alter column day_scope set not null,
  add constraint outlet_staffing_requirements_day_scope_check
    check (day_scope in ('weekday', 'weekend')),
  add constraint outlet_staffing_requirements_minimum_staff_check
    check (minimum_staff >= 0),
  add constraint outlet_staffing_requirements_version_key
    unique (
      outlet_id,
      shift_template_id,
      cashier_count,
      day_scope,
      effective_from
    );

drop function public.replace_outlet_staffing_requirements(
  uuid,
  smallint,
  date,
  jsonb,
  text
);

create function public.replace_outlet_staffing_requirements(
  p_outlet_id uuid,
  p_cashier_count smallint,
  p_effective_from date,
  p_day_scope text,
  p_requirements jsonb,
  p_reason text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  normalized_day_scope text := lower(trim(p_day_scope));
  active_template_count integer;
  requirement_count integer;
  minimum_staff_total integer;
  previous_values jsonb;
  inserted_count integer;
begin
  if not public.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'Aksi ini hanya dapat dilakukan supervisor.';
  end if;

  if not exists (
    select 1
    from public.outlets outlet
    where outlet.id = p_outlet_id
      and outlet.is_active
  ) then
    raise exception using
      errcode = '23503',
      message = 'Outlet aktif tidak ditemukan.';
  end if;

  if p_cashier_count is null or p_cashier_count not between 1 and 100 then
    raise exception using
      errcode = '22023',
      message = 'Jumlah kasir harus berada antara 1 dan 100.';
  end if;

  if normalized_day_scope not in ('weekday', 'weekend') then
    raise exception using
      errcode = '22023',
      message = 'Cakupan hari harus weekday atau weekend.';
  end if;

  if p_effective_from is null or p_effective_from < current_date then
    raise exception using
      errcode = '22023',
      message = 'Tanggal efektif tidak boleh sebelum hari ini.';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Alasan perubahan kebutuhan staf wajib diisi.';
  end if;

  if p_requirements is null
    or jsonb_typeof(p_requirements) <> 'array'
    or jsonb_array_length(p_requirements) = 0 then
    raise exception using
      errcode = '22023',
      message = 'Kebutuhan staf wajib berupa daftar shift yang tidak kosong.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'staffing-requirement:' || p_outlet_id::text || ':'
        || p_cashier_count::text || ':' || normalized_day_scope,
      0
    )
  );

  select count(*)::integer
  into active_template_count
  from public.outlet_shift_templates template
  where template.outlet_id = p_outlet_id
    and template.is_active;

  select
    count(*)::integer,
    coalesce(sum(requirement.minimum_staff), 0)::integer
  into requirement_count, minimum_staff_total
  from jsonb_to_recordset(p_requirements)
    as requirement(shift_type text, minimum_staff integer);

  if active_template_count = 0 or requirement_count <> active_template_count then
    raise exception using
      errcode = '22023',
      message = 'Kebutuhan staf harus diisi untuk setiap template shift aktif.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_requirements)
      as requirement(shift_type text, minimum_staff integer)
    where requirement.shift_type is null
      or requirement.shift_type not in ('morning', 'middle', 'night')
      or requirement.minimum_staff is null
      or requirement.minimum_staff < 0
      or requirement.minimum_staff > p_cashier_count
  ) then
    raise exception using
      errcode = '22023',
      message = 'Minimum staf setiap shift harus antara 0 dan jumlah kasir.';
  end if;

  if (
    select count(distinct requirement.shift_type)
    from jsonb_to_recordset(p_requirements)
      as requirement(shift_type text, minimum_staff integer)
  ) <> requirement_count then
    raise exception using
      errcode = '22023',
      message = 'Setiap jenis shift hanya boleh diisi satu kali.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_requirements)
      as requirement(shift_type text, minimum_staff integer)
    left join public.outlet_shift_templates template
      on template.outlet_id = p_outlet_id
      and template.shift_type::text = requirement.shift_type
      and template.is_active
    where template.id is null
  ) then
    raise exception using
      errcode = '22023',
      message = 'Kebutuhan staf memuat shift yang tidak aktif pada outlet.';
  end if;

  if minimum_staff_total < 1 then
    raise exception using
      errcode = '22023',
      message = 'Sedikitnya satu shift harus memiliki minimum staf.';
  end if;

  if minimum_staff_total > p_cashier_count then
    raise exception using
      errcode = '22023',
      message = 'Total minimum staf seluruh shift tidak boleh melebihi jumlah kasir.';
  end if;

  if exists (
    select 1
    from public.outlet_staffing_requirements requirement
    where requirement.outlet_id = p_outlet_id
      and requirement.cashier_count = p_cashier_count
      and requirement.day_scope = normalized_day_scope
      and requirement.effective_from > p_effective_from
  ) then
    raise exception using
      errcode = '22023',
      message = 'Tanggal efektif harus sama dengan atau setelah versi kebutuhan staf terakhir.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(requirement)), '[]'::jsonb)
  into previous_values
  from public.outlet_staffing_requirements requirement
  where requirement.outlet_id = p_outlet_id
    and requirement.cashier_count = p_cashier_count
    and requirement.day_scope = normalized_day_scope
    and requirement.effective_from <= p_effective_from
    and (
      requirement.effective_until is null
      or requirement.effective_until >= p_effective_from
    );

  delete from public.outlet_staffing_requirements requirement
  where requirement.outlet_id = p_outlet_id
    and requirement.cashier_count = p_cashier_count
    and requirement.day_scope = normalized_day_scope
    and requirement.effective_from = p_effective_from;

  update public.outlet_staffing_requirements requirement
  set
    effective_until = p_effective_from - 1,
    updated_at = pg_catalog.clock_timestamp()
  where requirement.outlet_id = p_outlet_id
    and requirement.cashier_count = p_cashier_count
    and requirement.day_scope = normalized_day_scope
    and requirement.effective_from < p_effective_from
    and (
      requirement.effective_until is null
      or requirement.effective_until >= p_effective_from
    );

  insert into public.outlet_staffing_requirements (
    outlet_id,
    shift_template_id,
    cashier_count,
    minimum_staff,
    effective_from,
    day_scope
  )
  select
    p_outlet_id,
    template.id,
    p_cashier_count,
    requirement.minimum_staff,
    p_effective_from,
    normalized_day_scope
  from jsonb_to_recordset(p_requirements)
    as requirement(shift_type text, minimum_staff integer)
  join public.outlet_shift_templates template
    on template.outlet_id = p_outlet_id
    and template.shift_type::text = requirement.shift_type
    and template.is_active;

  get diagnostics inserted_count = row_count;

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
    'replace_outlet_staffing_requirements',
    'outlet',
    p_outlet_id,
    previous_values,
    jsonb_build_object(
      'cashier_count', p_cashier_count,
      'day_scope', normalized_day_scope,
      'effective_from', p_effective_from,
      'requirements', p_requirements
    ),
    trim(p_reason)
  );

  return jsonb_build_object(
    'outlet_id', p_outlet_id,
    'cashier_count', p_cashier_count,
    'day_scope', normalized_day_scope,
    'effective_from', p_effective_from,
    'saved_requirements', inserted_count
  );
end;
$$;

revoke all on function public.replace_outlet_staffing_requirements(
  uuid,
  smallint,
  date,
  text,
  jsonb,
  text
) from public, anon;

grant execute on function public.replace_outlet_staffing_requirements(
  uuid,
  smallint,
  date,
  text,
  jsonb,
  text
) to authenticated;

-- Add day scope to the immutable optimizer snapshot without duplicating the
-- large, already-tested RPC definition.
do $migration$
declare
  function_definition text;
  patched_definition text;
  old_fragment text := $old$'cashierCount', requirement.cashier_count,
              'shift', template.shift_type,$old$;
  new_fragment text := $new$'cashierCount', requirement.cashier_count,
              'dayScope', requirement.day_scope,
              'shift', template.shift_type,$new$;
begin
  select pg_get_functiondef(
    'public.get_roster_generation_input_without_carry_over(date)'::regprocedure
  ) into function_definition;

  patched_definition := replace(
    function_definition,
    old_fragment,
    new_fragment
  );

  if patched_definition = function_definition then
    raise exception 'Snapshot roster tidak dapat ditambah day scope';
  end if;

  execute patched_definition;
end;
$migration$;

-- Publish validates the number of people actually scheduled at an outlet on
-- that date. Off/leave are excluded and backup workers are counted at their
-- target outlet. Only the weekday/weekend target for that date applies.
do $migration$
declare
  function_definition text;
  patched_definition text;
  old_fragment text := $old$      and requirement.cashier_count = (
        select count(*)::smallint
        from public.employee_placements placement
        join public.employees employee on employee.id = placement.employee_id
        join public.job_positions position
          on position.id = employee.job_position_id
        where placement.outlet_id = requirement.outlet_id
          and placement.is_primary
          and placement.start_date <= work_day::date
          and (
            placement.end_date is null
            or placement.end_date >= work_day::date
          )
          and employee.archived_at is null
          and position.auto_roster_eligible
      )$old$;
  new_fragment text := $new$      and requirement.day_scope = case
        when extract(isodow from work_day)::integer between 1 and 5
          then 'weekday'
        else 'weekend'
      end
      and requirement.cashier_count = (
        select count(*)::smallint
        from public.schedule_assignments daily_assignment
        join public.employees employee
          on employee.id = daily_assignment.employee_id
        join public.job_positions position
          on position.id = employee.job_position_id
        where daily_assignment.roster_version_id = version_row.id
          and daily_assignment.outlet_id = requirement.outlet_id
          and daily_assignment.work_date = work_day::date
          and daily_assignment.status = 'scheduled'
          and position.auto_roster_eligible
      )$new$;
begin
  select pg_get_functiondef(
    'public.publish_manual_roster(uuid,text)'::regprocedure
  ) into function_definition;

  patched_definition := replace(
    function_definition,
    old_fragment,
    new_fragment
  );

  if patched_definition = function_definition then
    raise exception 'Validator publish tidak dapat memakai kasir tersedia harian';
  end if;

  execute patched_definition;
end;
$migration$;
