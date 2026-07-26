alter table public.data_import_jobs
  add column payload_checksum text,
  add column committed_from uuid
    references public.data_import_jobs(id) on delete restrict;

create unique index data_import_jobs_one_commit_per_dry_run
  on public.data_import_jobs (committed_from)
  where committed_from is not null;

revoke insert, update, delete
  on table public.data_import_jobs
  from authenticated;

grant select
  on table public.data_import_jobs
  to authenticated;

create or replace function public.validate_employee_import_rows(
  p_rows jsonb
)
returns table (
  row_number integer,
  normalized_row jsonb,
  row_errors jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  source_row jsonb;
  nik_value text;
  full_name_value text;
  phone_value text;
  joined_at_value text;
  joined_at_date date;
  employment_status_code_value text;
  employment_status_id_value uuid;
  job_position_code_value text;
  job_position_id_value uuid;
  outlet_code_value text;
  outlet_id_value uuid;
  change_reason_value text;
  duplicate_count integer;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'Data impor wajib berupa array JSON.';
  end if;

  if jsonb_array_length(p_rows) < 1 then
    raise exception using
      errcode = '22023',
      message = 'File impor tidak memiliki baris data.';
  end if;

  if jsonb_array_length(p_rows) > 500 then
    raise exception using
      errcode = '22023',
      message = 'Maksimal 500 baris untuk setiap proses impor.';
  end if;

  for source_row, row_number in
    select item.value, item.ordinality::integer
    from jsonb_array_elements(p_rows) with ordinality as item(value, ordinality)
  loop
    row_errors := '[]'::jsonb;
    employment_status_id_value := null;
    job_position_id_value := null;
    outlet_id_value := null;
    joined_at_date := null;

    if jsonb_typeof(source_row) <> 'object' then
      row_errors := row_errors || jsonb_build_array(
        jsonb_build_object(
          'field', 'row',
          'code', 'invalid_type',
          'message', 'Baris harus berupa objek data.'
        )
      );
      source_row := '{}'::jsonb;
    end if;

    nik_value := upper(trim(coalesce(source_row->>'nik', '')));
    full_name_value := trim(coalesce(source_row->>'full_name', ''));
    phone_value := trim(coalesce(source_row->>'phone', ''));
    joined_at_value := trim(coalesce(source_row->>'joined_at', ''));
    employment_status_code_value := lower(
      trim(coalesce(source_row->>'employment_status_code', ''))
    );
    job_position_code_value := lower(
      trim(coalesce(source_row->>'job_position_code', ''))
    );
    outlet_code_value := upper(
      trim(coalesce(source_row->>'outlet_code', ''))
    );
    change_reason_value := coalesce(
      nullif(trim(coalesce(source_row->>'change_reason', '')), ''),
      'Impor data awal'
    );

    if nik_value !~ '^RK-[0-9]{4}-[0-9]{3,}$' then
      row_errors := row_errors || jsonb_build_array(
        jsonb_build_object(
          'field', 'nik',
          'code', 'invalid_format',
          'message', 'NIK wajib memakai format RK-TAHUN-NOMOR.'
        )
      );
    else
      select count(*)
      into duplicate_count
      from jsonb_array_elements(p_rows) candidate
      where upper(trim(coalesce(candidate->>'nik', ''))) = nik_value;

      if duplicate_count > 1 then
        row_errors := row_errors || jsonb_build_array(
          jsonb_build_object(
            'field', 'nik',
            'code', 'duplicate_in_file',
            'message', 'NIK muncul lebih dari satu kali dalam file.'
          )
        );
      end if;

      if exists (
        select 1
        from public.employees employee
        where employee.nik = nik_value
      ) then
        row_errors := row_errors || jsonb_build_array(
          jsonb_build_object(
            'field', 'nik',
            'code', 'already_exists',
            'message', 'NIK sudah tersimpan di database.'
          )
        );
      end if;
    end if;

    if length(full_name_value) < 2 then
      row_errors := row_errors || jsonb_build_array(
        jsonb_build_object(
          'field', 'full_name',
          'code', 'required',
          'message', 'Nama lengkap minimal dua karakter.'
        )
      );
    end if;

    if length(full_name_value) > 150 then
      row_errors := row_errors || jsonb_build_array(
        jsonb_build_object(
          'field', 'full_name',
          'code', 'too_long',
          'message', 'Nama lengkap maksimal 150 karakter.'
        )
      );
    end if;

    if length(phone_value) > 30 then
      row_errors := row_errors || jsonb_build_array(
        jsonb_build_object(
          'field', 'phone',
          'code', 'too_long',
          'message', 'Nomor telepon maksimal 30 karakter.'
        )
      );
    end if;

    if joined_at_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      row_errors := row_errors || jsonb_build_array(
        jsonb_build_object(
          'field', 'joined_at',
          'code', 'invalid_format',
          'message', 'Tanggal masuk wajib memakai format YYYY-MM-DD.'
        )
      );
    else
      begin
        joined_at_date := joined_at_value::date;
        if to_char(joined_at_date, 'YYYY-MM-DD') <> joined_at_value then
          raise invalid_datetime_format;
        end if;
      exception
        when others then
          joined_at_date := null;
          row_errors := row_errors || jsonb_build_array(
            jsonb_build_object(
              'field', 'joined_at',
              'code', 'invalid_date',
              'message', 'Tanggal masuk tidak valid.'
            )
          );
      end;
    end if;

    select status.id
    into employment_status_id_value
    from public.employment_statuses status
    where lower(status.code) = employment_status_code_value
      and status.is_active
    limit 1;

    if employment_status_id_value is null then
      row_errors := row_errors || jsonb_build_array(
        jsonb_build_object(
          'field', 'employment_status_code',
          'code', 'reference_not_found',
          'message', 'Kode status kerja aktif tidak ditemukan.'
        )
      );
    end if;

    select position.id
    into job_position_id_value
    from public.job_positions position
    where lower(position.code) = job_position_code_value
      and position.is_active
    limit 1;

    if job_position_id_value is null then
      row_errors := row_errors || jsonb_build_array(
        jsonb_build_object(
          'field', 'job_position_code',
          'code', 'reference_not_found',
          'message', 'Kode jabatan aktif tidak ditemukan.'
        )
      );
    end if;

    select outlet.id
    into outlet_id_value
    from public.outlets outlet
    where upper(outlet.code) = outlet_code_value
      and outlet.is_active
    limit 1;

    if outlet_id_value is null then
      row_errors := row_errors || jsonb_build_array(
        jsonb_build_object(
          'field', 'outlet_code',
          'code', 'reference_not_found',
          'message', 'Kode outlet aktif tidak ditemukan.'
        )
      );
    end if;

    normalized_row := jsonb_build_object(
      'nik', nik_value,
      'full_name', full_name_value,
      'phone', phone_value,
      'joined_at', joined_at_value,
      'joined_at_date', joined_at_date,
      'employment_status_code', employment_status_code_value,
      'employment_status_id', employment_status_id_value,
      'job_position_code', job_position_code_value,
      'job_position_id', job_position_id_value,
      'outlet_code', outlet_code_value,
      'outlet_id', outlet_id_value,
      'change_reason', change_reason_value
    );

    return next;
  end loop;
end;
$$;

create or replace function public.dry_run_employee_import(
  p_source_file_name text,
  p_rows jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  new_job_id uuid;
  total_count integer;
  valid_count integer;
  invalid_count integer;
  validation_errors_value jsonb;
  checksum_value text;
  safe_file_name text;
begin
  if not public.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'Aksi ini hanya dapat dilakukan supervisor.';
  end if;

  safe_file_name := regexp_replace(
    coalesce(nullif(trim(p_source_file_name), ''), 'employee-import.xlsx'),
    '[^A-Za-z0-9._-]+',
    '_',
    'g'
  );

  if lower(right(safe_file_name, 5)) <> '.xlsx' then
    raise exception using
      errcode = '22023',
      message = 'File impor wajib menggunakan format .xlsx.';
  end if;

  select
    count(*)::integer,
    count(*) filter (where jsonb_array_length(result.row_errors) = 0)::integer,
    count(*) filter (where jsonb_array_length(result.row_errors) > 0)::integer,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'row_number', result.row_number,
          'errors', result.row_errors
        )
        order by result.row_number
      ) filter (where jsonb_array_length(result.row_errors) > 0),
      '[]'::jsonb
    )
  into
    total_count,
    valid_count,
    invalid_count,
    validation_errors_value
  from public.validate_employee_import_rows(p_rows) result;

  checksum_value := encode(
    extensions.digest(convert_to(p_rows::text, 'UTF8'), 'sha256'),
    'hex'
  );

  insert into public.data_import_jobs (
    requested_by,
    import_type,
    source_file_path,
    status,
    total_rows,
    success_rows,
    failed_rows,
    validation_errors,
    payload_checksum,
    completed_at
  )
  values (
    auth.uid(),
    'employee_dry_run',
    'client-only/' || left(safe_file_name, 240),
    'completed',
    total_count,
    valid_count,
    invalid_count,
    validation_errors_value,
    checksum_value,
    clock_timestamp()
  )
  returning id into new_job_id;

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
    'dry_run_employee_import',
    'data_import_job',
    new_job_id,
    jsonb_build_object(
      'total_rows', total_count,
      'valid_rows', valid_count,
      'invalid_rows', invalid_count,
      'payload_checksum', checksum_value
    ),
    'supervisor_validated_employee_import'
  );

  return jsonb_build_object(
    'job_id', new_job_id,
    'total_rows', total_count,
    'success_rows', valid_count,
    'failed_rows', invalid_count,
    'validation_errors', validation_errors_value,
    'payload_checksum', checksum_value
  );
end;
$$;

create or replace function public.commit_employee_import(
  p_dry_run_job_id uuid,
  p_rows jsonb,
  p_reason text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  dry_run_job public.data_import_jobs%rowtype;
  validation_result record;
  checksum_value text;
  new_job_id uuid;
  imported_count integer := 0;
begin
  if not public.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'Aksi ini hanya dapat dilakukan supervisor.';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Alasan impor wajib diisi.';
  end if;

  select job.*
  into dry_run_job
  from public.data_import_jobs job
  where job.id = p_dry_run_job_id
    and job.requested_by = auth.uid()
    and job.import_type = 'employee_dry_run'
  for update;

  if dry_run_job.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Hasil dry-run tidak ditemukan untuk supervisor ini.';
  end if;

  if dry_run_job.status <> 'completed'
    or dry_run_job.failed_rows <> 0
    or dry_run_job.total_rows < 1 then
    raise exception using
      errcode = '22023',
      message = 'Dry-run masih memiliki kesalahan dan belum dapat diimpor.';
  end if;

  if exists (
    select 1
    from public.data_import_jobs job
    where job.committed_from = dry_run_job.id
  ) then
    raise exception using
      errcode = '23505',
      message = 'Hasil dry-run ini sudah pernah diimpor.';
  end if;

  checksum_value := encode(
    extensions.digest(convert_to(p_rows::text, 'UTF8'), 'sha256'),
    'hex'
  );

  if checksum_value <> dry_run_job.payload_checksum then
    raise exception using
      errcode = '22023',
      message = 'Isi data berubah setelah dry-run. Jalankan validasi ulang.';
  end if;

  for validation_result in
    select *
    from public.validate_employee_import_rows(p_rows)
    order by row_number
  loop
    if jsonb_array_length(validation_result.row_errors) > 0 then
      raise exception using
        errcode = '22023',
        message = 'Data berubah sejak dry-run. Jalankan validasi ulang.';
    end if;

    perform public.create_employee_master(
      validation_result.normalized_row->>'nik',
      validation_result.normalized_row->>'full_name',
      validation_result.normalized_row->>'phone',
      (validation_result.normalized_row->>'joined_at')::date,
      (validation_result.normalized_row->>'employment_status_id')::uuid,
      (validation_result.normalized_row->>'job_position_id')::uuid,
      (validation_result.normalized_row->>'outlet_id')::uuid,
      validation_result.normalized_row->>'change_reason'
    );

    imported_count := imported_count + 1;
  end loop;

  insert into public.data_import_jobs (
    requested_by,
    import_type,
    source_file_path,
    status,
    total_rows,
    success_rows,
    failed_rows,
    validation_errors,
    payload_checksum,
    committed_from,
    completed_at
  )
  values (
    auth.uid(),
    'employee_commit',
    dry_run_job.source_file_path,
    'completed',
    imported_count,
    imported_count,
    0,
    '[]'::jsonb,
    checksum_value,
    dry_run_job.id,
    clock_timestamp()
  )
  returning id into new_job_id;

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
    'commit_employee_import',
    'data_import_job',
    new_job_id,
    jsonb_build_object(
      'dry_run_job_id', dry_run_job.id,
      'imported_rows', imported_count,
      'payload_checksum', checksum_value
    ),
    trim(p_reason)
  );

  return jsonb_build_object(
    'job_id', new_job_id,
    'dry_run_job_id', dry_run_job.id,
    'imported_rows', imported_count
  );
end;
$$;

revoke all on function public.validate_employee_import_rows(jsonb)
  from public, anon, authenticated;
revoke all on function public.dry_run_employee_import(text, jsonb)
  from public, anon;
revoke all on function public.commit_employee_import(uuid, jsonb, text)
  from public, anon;

grant execute on function public.dry_run_employee_import(text, jsonb)
  to authenticated;
grant execute on function public.commit_employee_import(uuid, jsonb, text)
  to authenticated;
