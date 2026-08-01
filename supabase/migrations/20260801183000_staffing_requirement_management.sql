create or replace function public.replace_outlet_staffing_requirements(
  p_outlet_id uuid,
  p_cashier_count smallint,
  p_effective_from date,
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
      'staffing-requirement:' || p_outlet_id::text || ':' || p_cashier_count::text,
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
      or requirement.minimum_staff < 1
      or requirement.minimum_staff > p_cashier_count
  ) then
    raise exception using
      errcode = '22023',
      message = 'Minimum staf setiap shift harus antara 1 dan jumlah kasir.';
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
    and requirement.effective_from <= p_effective_from
    and (
      requirement.effective_until is null
      or requirement.effective_until >= p_effective_from
    );

  delete from public.outlet_staffing_requirements requirement
  where requirement.outlet_id = p_outlet_id
    and requirement.cashier_count = p_cashier_count
    and requirement.effective_from = p_effective_from;

  update public.outlet_staffing_requirements requirement
  set
    effective_until = p_effective_from - 1,
    updated_at = pg_catalog.clock_timestamp()
  where requirement.outlet_id = p_outlet_id
    and requirement.cashier_count = p_cashier_count
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
    effective_from
  )
  select
    p_outlet_id,
    template.id,
    p_cashier_count,
    requirement.minimum_staff,
    p_effective_from
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
      'effective_from', p_effective_from,
      'requirements', p_requirements
    ),
    trim(p_reason)
  );

  return jsonb_build_object(
    'outlet_id', p_outlet_id,
    'cashier_count', p_cashier_count,
    'effective_from', p_effective_from,
    'saved_requirements', inserted_count
  );
end;
$$;

revoke insert, update, delete
  on table public.outlet_staffing_requirements
  from authenticated;

grant select
  on table public.outlet_staffing_requirements
  to authenticated;

revoke all on function public.replace_outlet_staffing_requirements(
  uuid,
  smallint,
  date,
  jsonb,
  text
) from public, anon;

grant execute on function public.replace_outlet_staffing_requirements(
  uuid,
  smallint,
  date,
  jsonb,
  text
) to authenticated;
