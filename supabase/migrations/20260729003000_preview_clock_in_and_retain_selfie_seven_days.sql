-- Selfie clock-in dapat dipantau segera dan disimpan selama tujuh hari.
-- Penghapusan dijadwalkan sejak evidence dibuat, terlepas dari waktu validasi.

create or replace function public.schedule_attendance_selfie_retention()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.file_deletion_jobs (
    evidence_id,
    storage_bucket,
    storage_path,
    deletion_reason,
    scheduled_for
  )
  values (
    new.id,
    new.storage_bucket,
    new.storage_path,
    'attendance_selfie_seven_day_retention',
    new.uploaded_at + interval '7 days'
  )
  on conflict (storage_bucket, storage_path, deletion_reason)
  do update set
    evidence_id = excluded.evidence_id,
    scheduled_for = excluded.scheduled_for;

  update public.attendance_evidence
  set retention_status = 'scheduled_for_deletion'
  where id = new.id
    and deleted_at is null;

  return new;
end;
$$;
revoke all on function public.schedule_attendance_selfie_retention()
  from public, anon, authenticated;

drop trigger if exists attendance_evidence_schedule_seven_day_retention
  on public.attendance_evidence;

create trigger attendance_evidence_schedule_seven_day_retention
after insert on public.attendance_evidence
for each row
execute function public.schedule_attendance_selfie_retention();

update public.file_deletion_jobs
set
  status = 'cancelled',
  last_error = 'Digantikan kebijakan retensi selfie tujuh hari.'
where evidence_id is not null
  and status in ('scheduled', 'failed')
  and deletion_reason in (
    'attendance_approved',
    'attendance_rejected_retention_limit'
  );

insert into public.file_deletion_jobs (
  evidence_id,
  storage_bucket,
  storage_path,
  deletion_reason,
  scheduled_for
)
select
  evidence.id,
  evidence.storage_bucket,
  evidence.storage_path,
  'attendance_selfie_seven_day_retention',
  evidence.uploaded_at + interval '7 days'
from public.attendance_evidence evidence
where evidence.deleted_at is null
on conflict (storage_bucket, storage_path, deletion_reason)
do update set
  evidence_id = excluded.evidence_id,
  scheduled_for = excluded.scheduled_for;

update public.attendance_evidence
set retention_status = 'scheduled_for_deletion'
where deleted_at is null;

create or replace function public.validate_attendance(
  attendance_id uuid,
  decision text,
  note text,
  expected_version integer
)
returns public.attendance_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_attendance public.attendance_records%rowtype;
  validated_attendance public.attendance_records%rowtype;
begin
  if not public.is_supervisor() then
    raise exception 'Only supervisors can validate attendance';
  end if;

  if decision is null
    or decision not in ('approved', 'rejected', 'needs_correction') then
    raise exception 'Invalid attendance decision';
  end if;

  select *
  into previous_attendance
  from public.attendance_records
  where id = attendance_id
  for update;

  if not found then
    raise exception 'Attendance record not found';
  end if;

  if previous_attendance.clock_out_at is null then
    raise exception 'Attendance must be clocked out before validation';
  end if;

  if previous_attendance.validation_status <> 'pending'
    or previous_attendance.record_version <> expected_version then
    raise exception 'Attendance record has already changed';
  end if;

  if previous_attendance.employee_id = public.current_employee_id() then
    raise exception 'Self-validation is not allowed';
  end if;

  update public.attendance_records
  set
    validation_status = decision::public.validation_status,
    record_version = record_version + 1
  where id = attendance_id
    and validation_status = 'pending'
    and record_version = expected_version
  returning * into validated_attendance;

  if not found then
    raise exception 'Attendance has already been validated';
  end if;

  insert into public.attendance_validations (
    attendance_record_id,
    decided_by,
    decision,
    decision_note,
    record_version
  )
  values (
    attendance_id,
    (select auth.uid()),
    decision,
    nullif(trim(note), ''),
    validated_attendance.record_version
  );

  insert into public.approval_events (
    subject_type,
    subject_id,
    actor_id,
    action,
    note,
    subject_version
  )
  values (
    'attendance_record',
    attendance_id,
    (select auth.uid()),
    decision,
    nullif(trim(note), ''),
    validated_attendance.record_version
  );

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
    'validate',
    'attendance_record',
    attendance_id,
    to_jsonb(previous_attendance),
    to_jsonb(validated_attendance),
    nullif(trim(note), '')
  );

  return validated_attendance;
end;
$$;
