create or replace function public.create_employee_master(
  p_nik text,
  p_full_name text,
  p_phone text,
  p_joined_at date,
  p_employment_status_id uuid,
  p_job_position_id uuid,
  p_outlet_id uuid,
  p_change_reason text default 'Penempatan awal'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  new_employee_id uuid;
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
      errcode = '22023',
      message = 'Outlet aktif tidak ditemukan.';
  end if;

  insert into public.employees (
    nik,
    full_name,
    phone,
    joined_at,
    employment_status_id,
    job_position_id
  )
  values (
    upper(trim(p_nik)),
    trim(p_full_name),
    nullif(trim(p_phone), ''),
    p_joined_at,
    p_employment_status_id,
    p_job_position_id
  )
  returning id into new_employee_id;

  insert into public.employee_placements (
    employee_id,
    outlet_id,
    start_date,
    is_primary,
    change_reason,
    set_by
  )
  values (
    new_employee_id,
    p_outlet_id,
    p_joined_at,
    true,
    coalesce(nullif(trim(p_change_reason), ''), 'Penempatan awal'),
    auth.uid()
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
    auth.uid(),
    'create_employee_master',
    'employee',
    new_employee_id,
    jsonb_build_object(
      'nik', upper(trim(p_nik)),
      'full_name', trim(p_full_name),
      'outlet_id', p_outlet_id
    ),
    'supervisor_created_employee'
  );

  return new_employee_id;
end;
$$;

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

  if p_effective_date < p_joined_at then
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
  select
    auth.uid(),
    'update_employee_master',
    'employee',
    employee.id,
    employee_before,
    to_jsonb(employee) || jsonb_build_object('primary_outlet_id', p_outlet_id),
    coalesce(nullif(trim(p_change_reason), ''), 'supervisor_updated_employee')
  from public.employees employee
  where employee.id = p_employee_id;
end;
$$;

create or replace function public.archive_employee_master(
  p_employee_id uuid,
  p_reason text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  employee_before jsonb;
begin
  if not public.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'Aksi ini hanya dapat dilakukan supervisor.';
  end if;

  if p_employee_id = public.current_employee_id() then
    raise exception using
      errcode = '42501',
      message = 'Supervisor tidak dapat mengarsipkan data dirinya sendiri.';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Alasan arsip wajib diisi.';
  end if;

  select to_jsonb(employee)
  into employee_before
  from public.employees employee
  where employee.id = p_employee_id
    and employee.archived_at is null
  for update;

  if employee_before is null then
    return false;
  end if;

  update public.employees
  set archived_at = now()
  where id = p_employee_id;

  update public.employee_placements
  set end_date = greatest(start_date, current_date)
  where employee_id = p_employee_id
    and end_date is null;

  update public.user_accounts
  set
    account_status = 'deactivated',
    deactivated_at = now()
  where employee_id = p_employee_id
    and account_status <> 'deactivated';

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
    'archive_employee_master',
    'employee',
    p_employee_id,
    employee_before,
    employee_before || jsonb_build_object('archived_at', now()),
    trim(p_reason)
  );

  return true;
end;
$$;

revoke all on function public.create_employee_master(
  text,
  text,
  text,
  date,
  uuid,
  uuid,
  uuid,
  text
) from public, anon;
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
revoke all on function public.archive_employee_master(uuid, text)
  from public, anon;

grant execute on function public.create_employee_master(
  text,
  text,
  text,
  date,
  uuid,
  uuid,
  uuid,
  text
) to authenticated;
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
grant execute on function public.archive_employee_master(uuid, text)
  to authenticated;
