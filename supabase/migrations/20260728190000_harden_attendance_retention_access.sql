drop policy if exists attendance_selfies_read_authorized on storage.objects;

create policy attendance_selfies_read_supervisor
on storage.objects
for select
to authenticated
using (
  bucket_id = 'attendance-selfies'
  and (select public.is_supervisor())
);

drop policy if exists file_deletion_jobs_insert_supervisor
  on public.file_deletion_jobs;
drop policy if exists file_deletion_jobs_update_supervisor
  on public.file_deletion_jobs;

revoke insert, update, delete on public.file_deletion_jobs from authenticated;

alter table public.attendance_validations
  add constraint attendance_validations_decision_note_required
  check (
    decision = 'approved'
    or length(trim(decision_note)) >= 3
  )
  not valid;

comment on constraint attendance_validations_decision_note_required
  on public.attendance_validations is
  'Rejected and needs_correction decisions require an explanatory note.';
