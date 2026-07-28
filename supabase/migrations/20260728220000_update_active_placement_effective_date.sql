create or replace function public.update_employee_master(
  p_employee_id uuid,
  p_nik text,
  p_full_name text,
  p_phone text,
  p_joined_at date,
  p_employment_status_id uuid,
  p_job_position_id uuid,
  p_outlet_id uuid,
  p_effective_date date,
  p_change_reason text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  employee_before jsonb;
  current_placement public.employee_placements%rowtype;
  previous_placement public.employee_placements%rowtype;
begin
  if not public.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'Aksi ini hanya dapat dilakukan supervisor.';
  end if;

  select to_jsonb(employee)
  into employee_before
  from public.employees employee
  where employee.id = p_employee_id
    and employee.archived_at is null
  for update;

  if employee_before is null then
    raise exception using
      errcode = 'P0002',
      message = 'Karyawan aktif tidak ditemukan.';
  end if;

  if p_effective_date is null or p_effective_date < p_joined_at then
    raise exception using
      errcode = '22023',
      message = 'Tanggal efektif penempatan tidak boleh sebelum tanggal masuk.';
  end if;

  if not exists (
    select 1
    from public.outlets outlet
    where outlet.id = p_outlet_id
      and outlet.is_active
  ) then
    raise exception using
      errcode = '22023',
      message = 'Outlet aktif tidak ditemukan.';
  end if;

  update public.employees
  set
    nik = upper(trim(p_nik)),
    full_name = trim(p_full_name),
    phone = nullif(trim(p_phone), ''),
    joined_at = p_joined_at,
    employment_status_id = p_employment_status_id,
    job_position_id = p_job_position_id
  where id = p_employee_id;

  select placement.*
  into current_placement
  from public.employee_placements placement
  where placement.employee_id = p_employee_id
    and placement.is_primary
    and placement.end_date is null
  order by placement.start_date desc
  limit 1
  for update;

  if current_placement.id is null
    or current_placement.outlet_id <> p_outlet_id then
    if current_placement.id is not null then
      if p_effective_date < current_placement.start_date then
        raise exception using
          errcode = '22023',
          message = 'Tanggal efektif tidak boleh sebelum penempatan aktif.';
      end if;

      update public.employee_placements
      set end_date = greatest(
        current_placement.start_date,
        p_effective_date - 1
      )
      where id = current_placement.id;
    end if;

    insert into public.employee_placements (
      employee_id,
      outlet_id,
      start_date,
      is_primary,
      change_reason,
      set_by
    )
    values (
      p_employee_id,
      p_outlet_id,
      p_effective_date,
      true,
      coalesce(nullif(trim(p_change_reason), ''), 'Perubahan penempatan'),
      auth.uid()
    )
    returning * into current_placement;
  elsif current_placement.start_date <> p_effective_date then
    select placement.*
    into previous_placement
    from public.employee_placements placement
    where placement.employee_id = p_employee_id
      and placement.is_primary
      and placement.id <> current_placement.id
      and placement.start_date < current_placement.start_date
    order by placement.start_date desc
    limit 1
    for update;

    if previous_placement.id is not null
      and p_effective_date <= previous_placement.start_date then
      raise exception using
        errcode = '22023',
        message = 'Tanggal efektif harus setelah awal penempatan sebelumnya.';
    end if;

    if previous_placement.id is not null then
      update public.employee_placements
      set end_date = p_effective_date - 1
      where id = previous_placement.id;
    end if;

    update public.employee_placements
    set
      start_date = p_effective_date,
      change_reason = coalesce(
        nullif(trim(p_change_reason), ''),
        change_reason
      ),
      set_by = auth.uid()
    where id = current_placement.id
    returning * into current_placement;
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
  select
    auth.uid(),
    'update_employee_master',
    'employee',
    employee.id,
    employee_before,
    to_jsonb(employee) || jsonb_build_object(
      'primary_outlet_id', current_placement.outlet_id,
      'primary_placement_start_date', current_placement.start_date
    ),
    coalesce(nullif(trim(p_change_reason), ''), 'supervisor_updated_employee')
  from public.employees employee
  where employee.id = p_employee_id;
end;
$$;

revoke all on function public.update_employee_master(
  uuid,
  text,
  text,
  text,
  date,
  uuid,
  uuid,
  uuid,
  date,
  text
) from public, anon;

grant execute on function public.update_employee_master(
  uuid,
  text,
  text,
  text,
  date,
  uuid,
  uuid,
  uuid,
  date,
  text
) to authenticated;
