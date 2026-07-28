create or replace function public.complete_attendance_file_deletion_job(
  p_job_id uuid,
  p_deleted_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_row public.file_deletion_jobs%rowtype;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Hanya worker service role yang dapat menyelesaikan deletion job.';
  end if;

  select *
  into job_row
  from public.file_deletion_jobs job
  where job.id = p_job_id
  for update;

  if not found then
    raise exception 'Deletion job tidak ditemukan.';
  end if;

  if job_row.status = 'completed' then
    return;
  end if;

  if job_row.status <> 'processing' or job_row.evidence_id is null then
    raise exception 'Deletion job tidak sedang diproses sebagai bukti presensi.';
  end if;

  update public.attendance_evidence
  set
    deleted_at = coalesce(deleted_at, p_deleted_at),
    retention_status = 'deleted'
  where id = job_row.evidence_id;

  if not found then
    raise exception 'Metadata bukti presensi tidak ditemukan.';
  end if;

  update public.file_deletion_jobs
  set
    status = 'completed',
    completed_at = p_deleted_at,
    last_error = null
  where id = job_row.id;

  insert into public.audit_logs (
    action,
    entity_type,
    entity_id,
    after_values,
    reason
  )
  values (
    'delete_storage_object',
    'file_deletion_job',
    job_row.id,
    jsonb_build_object(
      'storage_bucket', job_row.storage_bucket,
      'storage_path', job_row.storage_path,
      'deletion_reason', job_row.deletion_reason,
      'attempt', job_row.attempt_count,
      'deleted_at', p_deleted_at
    ),
    job_row.deletion_reason
  );
end;
$$;

revoke all on function public.complete_attendance_file_deletion_job(
  uuid,
  timestamptz
) from public, anon, authenticated;

grant execute on function public.complete_attendance_file_deletion_job(
  uuid,
  timestamptz
) to service_role;

grant select, update on public.file_deletion_jobs to service_role;
