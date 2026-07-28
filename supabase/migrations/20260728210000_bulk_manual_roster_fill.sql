create or replace function public.bulk_fill_manual_roster(
  p_month_start date,
  p_start_date date,
  p_end_date date,
  p_shift_type public.shift_type,
  p_fill_mode text,
  p_reason text,
  p_employee_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft_id uuid;
  employee_row record;
  work_day date;
  primary_outlet_id uuid;
  primary_outlet_name text;
  requested_employee_count integer := 0;
  employee_count integer := 0;
  date_count integer := 0;
  created_count integer := 0;
  updated_count integer := 0;
  skipped_count integer := 0;
  assignment_exists boolean;
begin
  if not public.is_supervisor() then
    raise exception 'Hanya supervisor yang dapat mengisi roster secara massal';
  end if;

  if p_month_start is null
    or p_month_start <> date_trunc('month', p_month_start)::date then
    raise exception 'Periode roster harus menggunakan tanggal pertama bulan';
  end if;

  if p_start_date is null
    or p_end_date is null
    or p_start_date > p_end_date then
    raise exception 'Rentang tanggal isi massal tidak valid';
  end if;

  if p_start_date < p_month_start
    or p_end_date >= (p_month_start + interval '1 month')::date then
    raise exception 'Rentang tanggal harus berada dalam periode roster';
  end if;

  if p_shift_type is null then
    raise exception 'Template shift wajib dipilih';
  end if;

  if p_fill_mode not in ('empty_only', 'replace') then
    raise exception 'Mode isi massal tidak valid';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Alasan isi massal minimal 3 karakter';
  end if;

  if p_employee_ids is not null then
    select count(distinct selected_id)
    into requested_employee_count
    from unnest(p_employee_ids) selected_id;

    if requested_employee_count = 0 then
      raise exception 'Pilih sedikitnya satu karyawan';
    end if;
  end if;

  select count(*)
  into employee_count
  from public.employees employee
  join public.job_positions position
    on position.id = employee.job_position_id
  where employee.archived_at is null
    and (
      position.auto_roster_eligible
      or exists (
        select 1
        from public.user_accounts account
        where account.employee_id = employee.id
          and account.access_role = 'supervisor'
          and account.account_status = 'active'
      )
    )
    and (
      p_employee_ids is null
      or employee.id = any(p_employee_ids)
    );

  if employee_count = 0 then
    raise exception 'Tidak ada kasir atau supervisor aktif yang dapat dijadwalkan';
  end if;

  if p_employee_ids is not null
    and employee_count <> requested_employee_count then
    raise exception 'Pilihan karyawan memuat akun yang tidak dapat dijadwalkan';
  end if;

  date_count := p_end_date - p_start_date + 1;
  if employee_count * date_count > 10000 then
    raise exception 'Isi massal dibatasi maksimal 10000 penugasan per proses';
  end if;

  draft_id := public.ensure_manual_roster_draft(p_month_start, p_reason);

  for employee_row in
    select employee.id, employee.full_name
    from public.employees employee
    join public.job_positions position
      on position.id = employee.job_position_id
    where employee.archived_at is null
      and (
        position.auto_roster_eligible
        or exists (
          select 1
          from public.user_accounts account
          where account.employee_id = employee.id
            and account.access_role = 'supervisor'
            and account.account_status = 'active'
        )
      )
      and (
        p_employee_ids is null
        or employee.id = any(p_employee_ids)
      )
    order by employee.full_name, employee.id
  loop
    for work_day in
      select generated_day::date
      from generate_series(
        p_start_date,
        p_end_date,
        interval '1 day'
      ) generated_day
    loop
      select placement.outlet_id, outlet.name
      into primary_outlet_id, primary_outlet_name
      from public.employee_placements placement
      join public.outlets outlet on outlet.id = placement.outlet_id
      where placement.employee_id = employee_row.id
        and placement.is_primary
        and placement.start_date <= work_day
        and (
          placement.end_date is null
          or placement.end_date >= work_day
        )
        and outlet.is_active
      order by placement.start_date desc
      limit 1;

      if primary_outlet_id is null then
        raise exception
          'Penempatan utama aktif untuk % pada % tidak ditemukan',
          employee_row.full_name,
          work_day;
      end if;

      perform 1
      from public.outlet_shift_templates template
      where template.outlet_id = primary_outlet_id
        and template.shift_type = p_shift_type
        and template.is_active;

      if not found then
        raise exception
          'Template shift % aktif untuk outlet % belum tersedia',
          p_shift_type,
          primary_outlet_name;
      end if;

      select exists (
        select 1
        from public.schedule_assignments assignment
        where assignment.roster_version_id = draft_id
          and assignment.employee_id = employee_row.id
          and assignment.work_date = work_day
      )
      into assignment_exists;

      if assignment_exists and p_fill_mode = 'empty_only' then
        skipped_count := skipped_count + 1;
        continue;
      end if;

      perform public.save_manual_roster_assignment(
        p_month_start,
        employee_row.id,
        work_day,
        primary_outlet_id,
        p_shift_type,
        'scheduled',
        'primary',
        trim(p_reason)
      );

      if assignment_exists then
        updated_count := updated_count + 1;
      else
        created_count := created_count + 1;
      end if;
    end loop;
  end loop;

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
    'bulk_fill_manual_roster',
    'roster_version',
    draft_id,
    jsonb_build_object(
      'month_start', p_month_start,
      'start_date', p_start_date,
      'end_date', p_end_date,
      'shift_type', p_shift_type,
      'fill_mode', p_fill_mode,
      'employee_count', employee_count,
      'created_count', created_count,
      'updated_count', updated_count,
      'skipped_count', skipped_count
    ),
    trim(p_reason)
  );

  return jsonb_build_object(
    'roster_version_id', draft_id,
    'employee_count', employee_count,
    'date_count', date_count,
    'created_count', created_count,
    'updated_count', updated_count,
    'skipped_count', skipped_count
  );
end;
$$;

revoke all on function public.bulk_fill_manual_roster(
  date,
  date,
  date,
  public.shift_type,
  text,
  text,
  uuid[]
) from public, anon;

grant execute on function public.bulk_fill_manual_roster(
  date,
  date,
  date,
  public.shift_type,
  text,
  text,
  uuid[]
) to authenticated;
