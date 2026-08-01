-- Leave decisions remain immutable events. Pending requests may be amended by
-- their owner, while an approved leave can only be cancelled or rescheduled
-- through a separate, first-write-wins change request decided by another
-- supervisor. Published roster versions remain immutable throughout.

create extension if not exists btree_gist with schema extensions;

do $migration$
begin
  if exists (
    select 1
    from public.leave_requests left_request
    join public.leave_requests right_request
      on right_request.employee_id = left_request.employee_id
      and right_request.id > left_request.id
      and right_request.status in ('pending', 'approved')
      and daterange(
        right_request.starts_on,
        right_request.ends_on,
        '[]'
      ) && daterange(
        left_request.starts_on,
        left_request.ends_on,
        '[]'
      )
    where left_request.status in ('pending', 'approved')
  ) then
    raise exception using
      errcode = '23P01',
      message = 'Data cuti aktif memiliki rentang tanggal tumpang tindih; rapikan data sebelum migration dilanjutkan.';
  end if;
end;
$migration$;

alter table public.leave_requests
  add constraint leave_requests_no_active_overlap
  exclude using gist (
    employee_id with =,
    daterange(starts_on, ends_on, '[]') with &&
  )
  where (status in ('pending', 'approved'));

create table public.leave_change_requests (
  id uuid primary key default gen_random_uuid(),
  leave_request_id uuid not null
    references public.leave_requests(id) on delete restrict,
  employee_id uuid not null
    references public.employees(id) on delete restrict,
  leave_type_id uuid not null
    references public.leave_types(id) on delete restrict,
  change_type text not null
    check (change_type in ('cancel', 'reschedule')),
  source_leave_version integer not null check (source_leave_version > 0),
  old_starts_on date not null,
  old_ends_on date not null,
  old_requested_days numeric(6, 2) not null check (old_requested_days > 0),
  proposed_starts_on date,
  proposed_ends_on date,
  proposed_days numeric(6, 2),
  reason text not null check (length(trim(reason)) >= 3),
  status public.request_status not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  request_version integer not null default 1 check (request_version > 0),
  reserved_delta_days numeric(6, 2) not null default 0
    check (reserved_delta_days >= 0),
  reserved_year integer check (reserved_year between 2000 and 2200),
  decided_by uuid references auth.users(id) on delete restrict,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_change_old_range check (
    old_ends_on >= old_starts_on
    and old_requested_days = old_ends_on - old_starts_on + 1
  ),
  constraint leave_change_proposed_range check (
    (
      change_type = 'cancel'
      and proposed_starts_on is null
      and proposed_ends_on is null
      and proposed_days is null
    )
    or (
      change_type = 'reschedule'
      and proposed_starts_on is not null
      and proposed_ends_on is not null
      and proposed_ends_on >= proposed_starts_on
      and proposed_days = proposed_ends_on - proposed_starts_on + 1
    )
  ),
  constraint leave_change_reservation_fields check (
    (reserved_delta_days = 0 and reserved_year is null)
    or (reserved_delta_days > 0 and reserved_year is not null)
  ),
  constraint leave_change_decision_fields check (
    (
      status in ('approved', 'rejected')
      and decided_by is not null
      and decided_at is not null
    )
    or status not in ('approved', 'rejected')
  )
);

create unique index leave_change_requests_one_pending
  on public.leave_change_requests (leave_request_id)
  where status = 'pending';

create index leave_change_requests_employee_timeline
  on public.leave_change_requests (employee_id, created_at desc);

create index leave_change_requests_pending_timeline
  on public.leave_change_requests (created_at)
  where status = 'pending';

create trigger leave_change_requests_set_updated_at
before update on public.leave_change_requests
for each row execute function public.set_updated_at();

create trigger leave_change_requests_prevent_self_approval
before insert or update of decided_by on public.leave_change_requests
for each row execute function public.prevent_request_self_approval();

create table public.leave_roster_impacts (
  id uuid primary key default gen_random_uuid(),
  leave_request_id uuid not null
    references public.leave_requests(id) on delete restrict,
  roster_period_id uuid not null
    references public.roster_periods(id) on delete restrict,
  work_date date not null,
  original_assignment jsonb,
  original_backup jsonb,
  applied_assignment jsonb,
  applied_roster_version_id uuid
    references public.roster_versions(id) on delete set null,
  applied_schedule_assignment_id uuid
    references public.schedule_assignments(id) on delete set null,
  state text not null default 'applied'
    check (state in ('applied', 'reverted', 'review_required')),
  applied_at timestamptz not null default now(),
  reverted_at timestamptz,
  reverted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (leave_request_id, roster_period_id, work_date)
);

create index leave_roster_impacts_period_date
  on public.leave_roster_impacts (roster_period_id, work_date);

create trigger leave_roster_impacts_set_updated_at
before update on public.leave_roster_impacts
for each row execute function public.set_updated_at();

create function public.prevent_used_leave_type_balance_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deducts_annual_balance is distinct from old.deducts_annual_balance
    and exists (
      select 1
      from public.leave_requests request
      where request.leave_type_id = old.id
    ) then
    raise exception using
      errcode = '23514',
      message = 'Jenis cuti yang sudah dipakai tidak dapat mengubah aturan saldo tahunan.';
  end if;

  return new;
end;
$$;

create trigger leave_types_preserve_used_balance_semantics
before update of deducts_annual_balance on public.leave_types
for each row execute function public.prevent_used_leave_type_balance_change();

alter table public.leave_change_requests enable row level security;
alter table public.leave_roster_impacts enable row level security;

create policy leave_change_requests_read_authorized
on public.leave_change_requests
for select
to authenticated
using (
  employee_id = (select public.current_employee_id())
  or (select public.can_view_sensitive_operations())
);

create policy leave_roster_impacts_read_operations
on public.leave_roster_impacts
for select
to authenticated
using ((select public.can_view_sensitive_operations()));

revoke all on public.leave_change_requests from anon, authenticated;
revoke all on public.leave_roster_impacts from anon, authenticated;
revoke all on function public.prevent_used_leave_type_balance_change()
  from public, anon, authenticated;

-- Backfill provenance for leave synchronizations that predate this table.
insert into public.leave_roster_impacts (
  leave_request_id,
  roster_period_id,
  work_date,
  original_assignment,
  applied_assignment,
  applied_roster_version_id,
  applied_schedule_assignment_id
)
select
  leave_request.id,
  period.id,
  assignment.work_date,
  schedule_override.before_values,
  schedule_override.after_values,
  version.id,
  assignment.id
from public.schedule_overrides schedule_override
join public.schedule_assignments assignment
  on assignment.id = schedule_override.schedule_assignment_id
join public.roster_versions version
  on version.id = assignment.roster_version_id
join public.roster_periods period
  on period.id = version.roster_period_id
join public.leave_requests leave_request
  on schedule_override.reason = format(
    'Cuti disetujui: %s',
    leave_request.id
  )
where leave_request.status = 'approved'
on conflict (leave_request_id, roster_period_id, work_date) do nothing;

create or replace function public.sync_approved_leave_to_roster(
  p_leave_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  request_row public.leave_requests%rowtype;
  employee_name text;
  period_row public.roster_periods%rowtype;
  draft_id uuid;
  work_day date;
  assignment_row record;
  placement_outlet_id uuid;
  saved_assignment public.schedule_assignments%rowtype;
  before_assignment jsonb;
  original_backup jsonb;
  affected_schedule_ids jsonb := '[]'::jsonb;
  shift_label text;
begin
  if not public.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'Hanya supervisor yang dapat menyelaraskan cuti dengan roster.';
  end if;

  select request.*
  into request_row
  from public.leave_requests request
  where request.id = p_leave_request_id
    and request.status = 'approved';

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Pengajuan cuti approved tidak ditemukan.';
  end if;

  select employee.full_name
  into employee_name
  from public.employees employee
  where employee.id = request_row.employee_id;

  for period_row in
    select period.*
    from public.roster_periods period
    where period.month_start <= request_row.ends_on
      and (period.month_start + interval '1 month - 1 day')::date
        >= request_row.starts_on
      and period.status <> 'closed'
    order by period.month_start
    for update
  loop
    draft_id := public.ensure_manual_roster_draft(
      period_row.month_start,
      format('Sinkronisasi cuti approved %s', p_leave_request_id)
    );

    for work_day in
      select leave_day::date
      from generate_series(
        greatest(request_row.starts_on, period_row.month_start),
        least(
          request_row.ends_on,
          (period_row.month_start + interval '1 month - 1 day')::date
        ),
        interval '1 day'
      ) leave_day
    loop
      original_backup := null;

      select
        assignment.*,
        template.shift_type,
        outlet.name as outlet_name
      into assignment_row
      from public.schedule_assignments assignment
      left join public.outlet_shift_templates template
        on template.id = assignment.shift_template_id
      join public.outlets outlet on outlet.id = assignment.outlet_id
      where assignment.roster_version_id = draft_id
        and assignment.employee_id = request_row.employee_id
        and assignment.work_date = work_day
      for update of assignment;

      if found and assignment_row.status in ('scheduled', 'cancelled') then
        before_assignment := to_jsonb(assignment_row)
          - 'shift_type'
          - 'outlet_name';

        select to_jsonb(backup)
        into original_backup
        from public.backup_assignments backup
        where backup.schedule_assignment_id = assignment_row.id;

        insert into public.leave_roster_impacts (
          leave_request_id,
          roster_period_id,
          work_date,
          original_assignment,
          original_backup,
          applied_assignment,
          applied_roster_version_id,
          applied_schedule_assignment_id,
          state,
          applied_at,
          reverted_at,
          reverted_by
        )
        values (
          p_leave_request_id,
          period_row.id,
          work_day,
          before_assignment,
          original_backup,
          null,
          draft_id,
          assignment_row.id,
          'applied',
          now(),
          null,
          null
        )
        on conflict (leave_request_id, roster_period_id, work_date)
        do update set
          original_assignment = case
            when public.leave_roster_impacts.state = 'applied'
              then public.leave_roster_impacts.original_assignment
            else excluded.original_assignment
          end,
          original_backup = case
            when public.leave_roster_impacts.state = 'applied'
              then public.leave_roster_impacts.original_backup
            else excluded.original_backup
          end,
          applied_assignment = null,
          applied_roster_version_id = excluded.applied_roster_version_id,
          applied_schedule_assignment_id =
            excluded.applied_schedule_assignment_id,
          state = 'applied',
          applied_at = now(),
          reverted_at = null,
          reverted_by = null;

        delete from public.backup_assignments backup
        where backup.schedule_assignment_id = assignment_row.id;

        update public.schedule_assignments assignment
        set
          shift_template_id = null,
          assignment_type = 'primary',
          planned_start = null,
          planned_end = null,
          planned_duration_min = 0,
          status = 'leave',
          updated_at = pg_catalog.clock_timestamp()
        where assignment.id = assignment_row.id
        returning assignment.* into saved_assignment;

        update public.leave_roster_impacts impact
        set applied_assignment = to_jsonb(saved_assignment)
        where impact.leave_request_id = p_leave_request_id
          and impact.roster_period_id = period_row.id
          and impact.work_date = work_day;

        insert into public.schedule_overrides (
          schedule_assignment_id,
          before_values,
          after_values,
          reason,
          changed_by
        )
        values (
          saved_assignment.id,
          before_assignment,
          to_jsonb(saved_assignment),
          format('Cuti disetujui: %s', p_leave_request_id),
          auth.uid()
        );

        affected_schedule_ids := affected_schedule_ids
          || jsonb_build_array(saved_assignment.id);

        if assignment_row.status = 'scheduled' then
          shift_label := case assignment_row.shift_type::text
            when 'morning' then 'Pagi'
            when 'middle' then 'Middle'
            when 'night' then 'Malam'
            else 'jadwal kerja'
          end;

          perform public.workforce_notify_supervisors(
            'roster_backup_required',
            format('Backup diperlukan · %s', assignment_row.outlet_name),
            format(
              '%s cuti pada %s. Alokasi shift %s perlu ditinjau dan dapat diisi backup dari outlet lain.',
              employee_name,
              work_day,
              shift_label
            ),
            'roster_backup_need',
            p_leave_request_id,
            jsonb_build_object(
              'action', 'assign_backup',
              'leave_request_id', p_leave_request_id,
              'leave_employee_id', request_row.employee_id,
              'leave_employee_name', employee_name,
              'roster_version_id', draft_id,
              'month_start', period_row.month_start,
              'work_date', work_day,
              'outlet_id', assignment_row.outlet_id,
              'outlet_name', assignment_row.outlet_name,
              'shift_type', assignment_row.shift_type
            ),
            request_row.employee_id
          );
        end if;
      elsif found and assignment_row.status = 'off' then
        perform public.workforce_notify_supervisors(
          'leave_off_overlap',
          'Cuti bertabrakan dengan off day',
          format(
            '%s memiliki cuti approved dan off day pada %s. Tinjau kembali jatah off pekan tersebut.',
            employee_name,
            work_day
          ),
          'roster_leave_overlap',
          p_leave_request_id,
          jsonb_build_object(
            'action', 'review_off',
            'leave_request_id', p_leave_request_id,
            'employee_id', request_row.employee_id,
            'month_start', period_row.month_start,
            'work_date', work_day,
            'outlet_id', assignment_row.outlet_id
          ),
          request_row.employee_id
        );
      elsif not found then
        select placement.outlet_id
        into placement_outlet_id
        from public.employee_placements placement
        where placement.employee_id = request_row.employee_id
          and placement.is_primary
          and placement.start_date <= work_day
          and (
            placement.end_date is null
            or placement.end_date >= work_day
          )
        order by placement.start_date desc
        limit 1;

        if placement_outlet_id is not null then
          insert into public.schedule_assignments (
            roster_version_id,
            employee_id,
            outlet_id,
            work_date,
            assignment_type,
            status,
            assignment_source
          )
          values (
            draft_id,
            request_row.employee_id,
            placement_outlet_id,
            work_day,
            'primary',
            'leave',
            'manual'
          )
          returning * into saved_assignment;

          insert into public.leave_roster_impacts (
            leave_request_id,
            roster_period_id,
            work_date,
            original_assignment,
            original_backup,
            applied_assignment,
            applied_roster_version_id,
            applied_schedule_assignment_id,
            state,
            applied_at,
            reverted_at,
            reverted_by
          )
          values (
            p_leave_request_id,
            period_row.id,
            work_day,
            null,
            null,
            to_jsonb(saved_assignment),
            draft_id,
            saved_assignment.id,
            'applied',
            now(),
            null,
            null
          )
          on conflict (leave_request_id, roster_period_id, work_date)
          do update set
            original_assignment = case
              when public.leave_roster_impacts.state = 'applied'
                then public.leave_roster_impacts.original_assignment
              else null
            end,
            original_backup = case
              when public.leave_roster_impacts.state = 'applied'
                then public.leave_roster_impacts.original_backup
              else null
            end,
            applied_assignment = excluded.applied_assignment,
            applied_roster_version_id = excluded.applied_roster_version_id,
            applied_schedule_assignment_id =
              excluded.applied_schedule_assignment_id,
            state = 'applied',
            applied_at = now(),
            reverted_at = null,
            reverted_by = null;

          affected_schedule_ids := affected_schedule_ids
            || jsonb_build_array(saved_assignment.id);
        end if;
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
    auth.uid(),
    'sync_approved_leave_to_roster',
    'leave_request',
    p_leave_request_id,
    jsonb_build_object(
      'affected_schedule_ids', affected_schedule_ids,
      'affected_schedule_count', jsonb_array_length(affected_schedule_ids)
    ),
    'Cuti approved diselaraskan ke draft roster'
  );

  return affected_schedule_ids;
end;
$$;

create function public.reconcile_changed_leave_roster(
  p_leave_request_id uuid,
  p_old_starts_on date,
  p_old_ends_on date,
  p_new_starts_on date default null,
  p_new_ends_on date default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  request_row public.leave_requests%rowtype;
  period_row public.roster_periods%rowtype;
  impact_row public.leave_roster_impacts%rowtype;
  assignment_row public.schedule_assignments%rowtype;
  restored_assignment public.schedule_assignments%rowtype;
  draft_id uuid;
  work_day date;
  before_assignment jsonb;
  restored_count integer := 0;
  cleared_count integer := 0;
  review_count integer := 0;
begin
  if not public.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'Hanya supervisor yang dapat merekonsiliasi perubahan cuti.';
  end if;

  select request.*
  into request_row
  from public.leave_requests request
  where request.id = p_leave_request_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Pengajuan cuti tidak ditemukan.';
  end if;

  for work_day in
    select leave_day::date
    from generate_series(
      p_old_starts_on,
      p_old_ends_on,
      interval '1 day'
    ) leave_day
  loop
    if p_new_starts_on is not null
      and work_day between p_new_starts_on and p_new_ends_on then
      continue;
    end if;

    select period.*
    into period_row
    from public.roster_periods period
    where period.month_start = date_trunc('month', work_day)::date
    for update;

    if not found then
      continue;
    end if;

    if period_row.status = 'closed' then
      raise exception using
        errcode = '23514',
        message = format(
          'Periode roster %s sudah ditutup; perubahan cuti memerlukan koreksi operasional khusus.',
          period_row.month_start
        );
    end if;

    draft_id := public.ensure_manual_roster_draft(
      period_row.month_start,
      format('Rekonsiliasi perubahan cuti %s', p_leave_request_id)
    );

    select impact.*
    into impact_row
    from public.leave_roster_impacts impact
    where impact.leave_request_id = p_leave_request_id
      and impact.roster_period_id = period_row.id
      and impact.work_date = work_day
    for update;

    select assignment.*
    into assignment_row
    from public.schedule_assignments assignment
    where assignment.roster_version_id = draft_id
      and assignment.employee_id = request_row.employee_id
      and assignment.work_date = work_day
    for update;

    if found
      and impact_row.id is not null
      and impact_row.applied_assignment is not null
      and assignment_row.status::text
        = impact_row.applied_assignment->>'status'
      and assignment_row.outlet_id::text
        = impact_row.applied_assignment->>'outlet_id'
      and assignment_row.assignment_type
        = impact_row.applied_assignment->>'assignment_type'
      and assignment_row.shift_template_id::text is not distinct from
        nullif(impact_row.applied_assignment->>'shift_template_id', '')
      and assignment_row.planned_start::text is not distinct from
        nullif(impact_row.applied_assignment->>'planned_start', '')
      and assignment_row.planned_end::text is not distinct from
        nullif(impact_row.applied_assignment->>'planned_end', '')
      and assignment_row.planned_duration_min::text
        = impact_row.applied_assignment->>'planned_duration_min'
      and assignment_row.assignment_source
        = impact_row.applied_assignment->>'assignment_source' then
      before_assignment := to_jsonb(assignment_row);

      if impact_row.id is not null
        and impact_row.original_assignment->>'status' = 'scheduled'
        and (
          impact_row.original_assignment->>'assignment_type' = 'primary'
          or impact_row.original_backup is not null
        ) then
        update public.schedule_assignments assignment
        set
          outlet_id = (impact_row.original_assignment->>'outlet_id')::uuid,
          shift_template_id =
            (impact_row.original_assignment->>'shift_template_id')::uuid,
          assignment_type =
            impact_row.original_assignment->>'assignment_type',
          planned_start =
            (impact_row.original_assignment->>'planned_start')::time,
          planned_end =
            (impact_row.original_assignment->>'planned_end')::time,
          planned_duration_min =
            (impact_row.original_assignment->>'planned_duration_min')::integer,
          status = 'scheduled',
          updated_at = pg_catalog.clock_timestamp()
        where assignment.id = assignment_row.id
        returning assignment.* into restored_assignment;

        delete from public.backup_assignments backup
        where backup.schedule_assignment_id = restored_assignment.id;

        if impact_row.original_assignment->>'assignment_type' = 'backup'
          and impact_row.original_backup is not null then
          insert into public.backup_assignments (
            schedule_assignment_id,
            employee_id,
            origin_outlet_id,
            destination_outlet_id,
            work_date,
            reason,
            assigned_by
          )
          values (
            restored_assignment.id,
            request_row.employee_id,
            (impact_row.original_backup->>'origin_outlet_id')::uuid,
            (impact_row.original_backup->>'destination_outlet_id')::uuid,
            work_day,
            impact_row.original_backup->>'reason',
            (impact_row.original_backup->>'assigned_by')::uuid
          );
        end if;

        insert into public.schedule_overrides (
          schedule_assignment_id,
          before_values,
          after_values,
          reason,
          changed_by
        )
        values (
          restored_assignment.id,
          before_assignment,
          to_jsonb(restored_assignment),
          format('Perubahan cuti approved: %s', p_leave_request_id),
          auth.uid()
        );

        update public.leave_roster_impacts
        set
          state = 'reverted',
          reverted_at = now(),
          reverted_by = auth.uid()
        where id = impact_row.id;

        restored_count := restored_count + 1;
      else
        delete from public.schedule_assignments assignment
        where assignment.id = assignment_row.id;

        if impact_row.id is not null then
          update public.leave_roster_impacts
          set
            state = 'review_required',
            reverted_at = now(),
            reverted_by = auth.uid()
          where id = impact_row.id;
        end if;

        cleared_count := cleared_count + 1;
        review_count := review_count + 1;
      end if;
    elsif impact_row.id is not null then
      update public.leave_roster_impacts
      set
        state = 'review_required',
        reverted_at = now(),
        reverted_by = auth.uid()
      where id = impact_row.id;

      review_count := review_count + 1;
    else
      review_count := review_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'restored_count', restored_count,
    'cleared_count', cleared_count,
    'review_count', review_count
  );
end;
$$;

create or replace function public.cancel_leave_request(
  p_request_id uuid,
  p_expected_version integer,
  p_reason text
)
returns public.leave_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_id uuid := public.current_employee_id();
  before_row public.leave_requests%rowtype;
  cancelled_row public.leave_requests%rowtype;
  deducts_balance boolean;
begin
  if requester_id is null
    or public.current_access_role() = 'management' then
    raise exception using
      errcode = '42501',
      message = 'Pengguna tidak dapat membatalkan pengajuan cuti.';
  end if;

  if length(trim(p_reason)) < 3 then
    raise exception using
      errcode = '22023',
      message = 'Alasan pembatalan wajib diisi.';
  end if;

  select *
  into before_row
  from public.leave_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Pengajuan cuti tidak ditemukan.';
  end if;

  select leave_type.deducts_annual_balance
  into deducts_balance
  from public.leave_types leave_type
  where leave_type.id = before_row.leave_type_id;

  if before_row.employee_id is distinct from requester_id then
    raise exception using
      errcode = '42501',
      message = 'Hanya pemilik pengajuan yang dapat membatalkan.';
  end if;

  if before_row.status <> 'pending'
    or before_row.request_version <> p_expected_version then
    raise exception using
      errcode = '40001',
      message = 'Pengajuan sudah berubah dan tidak dapat dibatalkan.';
  end if;

  if deducts_balance then
    update public.leave_entitlements
    set reserved_days = greatest(
      0,
      reserved_days - before_row.requested_days
    )
    where employee_id = before_row.employee_id
      and leave_type_id = before_row.leave_type_id
      and year = extract(year from before_row.starts_on)::integer;
  end if;

  update public.leave_requests
  set
    status = 'cancelled',
    request_version = request_version + 1,
    decision_note = trim(p_reason)
  where id = p_request_id
    and status = 'pending'
    and request_version = p_expected_version
  returning * into cancelled_row;

  if not found then
    raise exception using
      errcode = '40001',
      message = 'Pengajuan sudah berubah dan tidak dapat dibatalkan.';
  end if;

  insert into public.approval_events (
    subject_type,
    subject_id,
    actor_id,
    action,
    note,
    subject_version
  )
  values (
    'leave_request',
    cancelled_row.id,
    auth.uid(),
    'cancelled',
    trim(p_reason),
    cancelled_row.request_version
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
    auth.uid(),
    'cancel',
    'leave_request',
    cancelled_row.id,
    to_jsonb(before_row),
    to_jsonb(cancelled_row),
    trim(p_reason)
  );

  return cancelled_row;
end;
$$;

create function public.amend_pending_leave_request(
  p_request_id uuid,
  p_expected_version integer,
  p_starts_on date,
  p_ends_on date,
  p_reason text
)
returns public.leave_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_id uuid := public.current_employee_id();
  before_row public.leave_requests%rowtype;
  amended_row public.leave_requests%rowtype;
  leave_type public.leave_types%rowtype;
  entitlement public.leave_entitlements%rowtype;
  proposed_days integer;
  document_required boolean;
begin
  if requester_id is null
    or public.current_access_role() = 'management' then
    raise exception using
      errcode = '42501',
      message = 'Pengguna tidak dapat mengubah pengajuan cuti.';
  end if;

  if p_starts_on is null
    or p_ends_on is null
    or p_ends_on < p_starts_on
    or length(trim(p_reason)) < 3 then
    raise exception using
      errcode = '22023',
      message = 'Tanggal atau alasan perubahan cuti tidak valid.';
  end if;

  select request.*
  into before_row
  from public.leave_requests request
  where request.id = p_request_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Pengajuan cuti tidak ditemukan.';
  end if;

  if before_row.employee_id <> requester_id then
    raise exception using
      errcode = '42501',
      message = 'Hanya pemilik pengajuan yang dapat mengubah tanggal cuti.';
  end if;

  if before_row.status <> 'pending'
    or before_row.request_version <> p_expected_version then
    raise exception using
      errcode = '40001',
      message = 'Pengajuan sudah berubah dan tidak dapat diedit.';
  end if;

  select leave.*
  into leave_type
  from public.leave_types leave
  where leave.id = before_row.leave_type_id
    and leave.is_active
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Jenis cuti aktif tidak ditemukan.';
  end if;

  proposed_days := p_ends_on - p_starts_on + 1;

  if p_starts_on < current_date
    or (
      not leave_type.same_day_allowed
      and p_starts_on < current_date + leave_type.minimum_notice_days
    ) then
    raise exception using
      errcode = '22023',
      message = format(
        'Perubahan %s wajib memenuhi notice minimal %s hari.',
        leave_type.name,
        leave_type.minimum_notice_days
      );
  end if;

  if exists (
    select 1
    from public.leave_requests request
    where request.employee_id = requester_id
      and request.id <> before_row.id
      and request.status in ('pending', 'approved')
      and daterange(request.starts_on, request.ends_on, '[]')
        && daterange(p_starts_on, p_ends_on, '[]')
  ) then
    raise exception using
      errcode = '23P01',
      message = 'Rentang tanggal berbenturan dengan pengajuan aktif lain.';
  end if;

  document_required :=
    leave_type.requires_document
    or (
      leave_type.document_required_after_days is not null
      and proposed_days > leave_type.document_required_after_days
    );

  if document_required and not exists (
    select 1
    from public.request_attachments attachment
    where attachment.subject_type = 'leave_request'
      and attachment.subject_id = before_row.id
      and attachment.deleted_at is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'Dokumen pendukung wajib tersedia untuk rentang cuti baru.';
  end if;

  if leave_type.deducts_annual_balance then
    if extract(year from p_starts_on) <> extract(year from p_ends_on)
      or extract(year from p_starts_on)
        <> extract(year from before_row.starts_on) then
      raise exception using
        errcode = '22023',
        message = 'Perubahan Cuti Tahunan harus tetap dalam tahun yang sama dengan pengajuan awal.';
    end if;

    select balance.*
    into entitlement
    from public.leave_entitlements balance
    where balance.employee_id = before_row.employee_id
      and balance.leave_type_id = before_row.leave_type_id
      and balance.year = extract(year from before_row.starts_on)::integer
    for update;

    if not found
      or entitlement.reserved_days < before_row.requested_days then
      raise exception using
        errcode = '23514',
        message = 'Reservasi saldo cuti tidak konsisten.';
    end if;

    if entitlement.granted_days
      - entitlement.used_days
      - entitlement.reserved_days
      - entitlement.expired_days
      + before_row.requested_days < proposed_days then
      raise exception using
        errcode = '23514',
        message = 'Saldo Cuti Tahunan tidak mencukupi untuk rentang baru.';
    end if;

    update public.leave_entitlements
    set reserved_days =
      reserved_days - before_row.requested_days + proposed_days
    where id = entitlement.id;
  end if;

  update public.leave_requests
  set
    starts_on = p_starts_on,
    ends_on = p_ends_on,
    requested_days = proposed_days,
    request_version = request_version + 1
  where id = before_row.id
    and status = 'pending'
    and request_version = p_expected_version
  returning * into amended_row;

  if not found then
    raise exception using
      errcode = '40001',
      message = 'Pengajuan sudah berubah dan tidak dapat diedit.';
  end if;

  update public.request_attachments attachment
  set retention_until = make_timestamptz(
    extract(year from amended_row.ends_on)::integer + 1,
    1,
    1,
    0,
    0,
    0,
    'Asia/Jakarta'
  )
  where attachment.subject_type = 'leave_request'
    and attachment.subject_id = amended_row.id
    and attachment.deleted_at is null;

  perform public.workforce_notify_supervisors(
    'leave_request_amended',
    'Tanggal pengajuan cuti diubah',
    format(
      'Pengajuan cuti diubah menjadi %s sampai %s.',
      p_starts_on,
      p_ends_on
    ),
    'leave_request',
    amended_row.id,
    jsonb_build_object(
      'status', amended_row.status,
      'request_version', amended_row.request_version,
      'starts_on', amended_row.starts_on,
      'ends_on', amended_row.ends_on
    ),
    requester_id
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
    'leave_request',
    amended_row.id,
    auth.uid(),
    'amended',
    trim(p_reason),
    amended_row.request_version
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
    auth.uid(),
    'amend_pending',
    'leave_request',
    amended_row.id,
    to_jsonb(before_row),
    to_jsonb(amended_row),
    trim(p_reason)
  );

  return amended_row;
end;
$$;

create function public.submit_leave_change_request(
  p_leave_request_id uuid,
  p_source_leave_version integer,
  p_change_type text,
  p_proposed_starts_on date,
  p_proposed_ends_on date,
  p_reason text
)
returns public.leave_change_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_id uuid := public.current_employee_id();
  source_request public.leave_requests%rowtype;
  leave_type public.leave_types%rowtype;
  entitlement public.leave_entitlements%rowtype;
  proposed_days integer;
  reserved_delta numeric(6, 2) := 0;
  reserved_year_value integer;
  document_required boolean;
  inserted_change public.leave_change_requests%rowtype;
begin
  if requester_id is null
    or public.current_access_role() = 'management' then
    raise exception using
      errcode = '42501',
      message = 'Pengguna tidak dapat mengajukan perubahan cuti.';
  end if;

  if p_change_type not in ('cancel', 'reschedule')
    or length(trim(p_reason)) < 3 then
    raise exception using
      errcode = '22023',
      message = 'Jenis atau alasan perubahan cuti tidak valid.';
  end if;

  select request.*
  into source_request
  from public.leave_requests request
  where request.id = p_leave_request_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Pengajuan cuti tidak ditemukan.';
  end if;

  if source_request.employee_id <> requester_id then
    raise exception using
      errcode = '42501',
      message = 'Hanya pemilik cuti yang dapat mengajukan perubahan.';
  end if;

  if source_request.status <> 'approved'
    or source_request.request_version <> p_source_leave_version then
    raise exception using
      errcode = '40001',
      message = 'Cuti approved sudah berubah; muat ulang data sebelum melanjutkan.';
  end if;

  if source_request.starts_on <= current_date then
    raise exception using
      errcode = '23514',
      message = 'Cuti yang sudah dimulai atau berlalu memerlukan koreksi operasional khusus.';
  end if;

  select leave.*
  into leave_type
  from public.leave_types leave
  where leave.id = source_request.leave_type_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Jenis cuti aktif tidak ditemukan.';
  end if;

  if p_change_type = 'reschedule' and not leave_type.is_active then
    raise exception using
      errcode = '23514',
      message = 'Jenis cuti sudah tidak aktif; cuti hanya dapat dibatalkan.';
  end if;

  if p_change_type = 'cancel' then
    if p_proposed_starts_on is not null or p_proposed_ends_on is not null then
      raise exception using
        errcode = '22023',
        message = 'Pembatalan cuti tidak menerima rentang tanggal baru.';
    end if;
    proposed_days := null;
  else
    if p_proposed_starts_on is null
      or p_proposed_ends_on is null
      or p_proposed_ends_on < p_proposed_starts_on then
      raise exception using
        errcode = '22023',
        message = 'Rentang tanggal pengganti tidak valid.';
    end if;

    proposed_days := p_proposed_ends_on - p_proposed_starts_on + 1;

    if p_proposed_starts_on = source_request.starts_on
      and p_proposed_ends_on = source_request.ends_on then
      raise exception using
        errcode = '22023',
        message = 'Tanggal pengganti harus berbeda dari cuti yang disetujui.';
    end if;

    if p_proposed_starts_on <= current_date
      or (
        not leave_type.same_day_allowed
        and p_proposed_starts_on
          < current_date + leave_type.minimum_notice_days
      ) then
      raise exception using
        errcode = '22023',
        message = format(
          'Tanggal pengganti %s wajib memenuhi notice minimal %s hari.',
          leave_type.name,
          leave_type.minimum_notice_days
        );
    end if;

    if exists (
      select 1
      from public.leave_requests request
      where request.employee_id = requester_id
        and request.id <> source_request.id
        and request.status in ('pending', 'approved')
        and daterange(request.starts_on, request.ends_on, '[]')
          && daterange(p_proposed_starts_on, p_proposed_ends_on, '[]')
    ) then
      raise exception using
        errcode = '23P01',
        message = 'Rentang tanggal pengganti berbenturan dengan pengajuan aktif lain.';
    end if;

    document_required :=
      leave_type.requires_document
      or (
        leave_type.document_required_after_days is not null
        and proposed_days > leave_type.document_required_after_days
      );

    if document_required and not exists (
      select 1
      from public.request_attachments attachment
      where attachment.subject_type = 'leave_request'
        and attachment.subject_id = source_request.id
        and attachment.deleted_at is null
    ) then
      raise exception using
        errcode = '23514',
        message = 'Dokumen pendukung wajib tersedia untuk rentang cuti pengganti.';
    end if;

    if leave_type.deducts_annual_balance then
      if extract(year from p_proposed_starts_on)
          <> extract(year from p_proposed_ends_on)
        or extract(year from p_proposed_starts_on)
          <> extract(year from source_request.starts_on) then
        raise exception using
          errcode = '22023',
          message = 'Perubahan Cuti Tahunan harus tetap dalam tahun yang sama dengan cuti awal.';
      end if;

      reserved_delta := greatest(
        proposed_days - source_request.requested_days,
        0
      );

      if reserved_delta > 0 then
        reserved_year_value :=
          extract(year from source_request.starts_on)::integer;

        select balance.*
        into entitlement
        from public.leave_entitlements balance
        where balance.employee_id = source_request.employee_id
          and balance.leave_type_id = source_request.leave_type_id
          and balance.year = reserved_year_value
        for update;

        if not found
          or entitlement.granted_days
            - entitlement.used_days
            - entitlement.reserved_days
            - entitlement.expired_days < reserved_delta then
          raise exception using
            errcode = '23514',
            message = 'Saldo Cuti Tahunan tidak mencukupi untuk perubahan tanggal.';
        end if;

        update public.leave_entitlements
        set reserved_days = reserved_days + reserved_delta
        where id = entitlement.id;
      end if;
    end if;
  end if;

  insert into public.leave_change_requests (
    leave_request_id,
    employee_id,
    leave_type_id,
    change_type,
    source_leave_version,
    old_starts_on,
    old_ends_on,
    old_requested_days,
    proposed_starts_on,
    proposed_ends_on,
    proposed_days,
    reason,
    reserved_delta_days,
    reserved_year
  )
  values (
    source_request.id,
    source_request.employee_id,
    source_request.leave_type_id,
    p_change_type,
    source_request.request_version,
    source_request.starts_on,
    source_request.ends_on,
    source_request.requested_days,
    case when p_change_type = 'reschedule' then p_proposed_starts_on end,
    case when p_change_type = 'reschedule' then p_proposed_ends_on end,
    case when p_change_type = 'reschedule' then proposed_days end,
    trim(p_reason),
    reserved_delta,
    reserved_year_value
  )
  returning * into inserted_change;

  perform public.workforce_notify_supervisors(
    'leave_change_requested',
    case
      when p_change_type = 'cancel' then 'Permintaan pembatalan cuti'
      else 'Permintaan ganti tanggal cuti'
    end,
    case
      when p_change_type = 'cancel'
        then format(
          'Pembatalan cuti %s sampai %s menunggu keputusan.',
          source_request.starts_on,
          source_request.ends_on
        )
      else format(
        'Perubahan cuti dari %s–%s menjadi %s–%s menunggu keputusan.',
        source_request.starts_on,
        source_request.ends_on,
        p_proposed_starts_on,
        p_proposed_ends_on
      )
    end,
    'leave_change_request',
    inserted_change.id,
    jsonb_build_object(
      'leave_request_id', source_request.id,
      'change_type', inserted_change.change_type,
      'status', inserted_change.status,
      'request_version', inserted_change.request_version
    ),
    requester_id
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
    'submit',
    'leave_change_request',
    inserted_change.id,
    to_jsonb(inserted_change),
    trim(p_reason)
  );

  return inserted_change;
end;
$$;

create function public.cancel_leave_change_request(
  p_change_request_id uuid,
  p_expected_version integer,
  p_reason text
)
returns public.leave_change_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_id uuid := public.current_employee_id();
  before_row public.leave_change_requests%rowtype;
  cancelled_row public.leave_change_requests%rowtype;
begin
  if requester_id is null
    or public.current_access_role() = 'management' then
    raise exception using
      errcode = '42501',
      message = 'Pengguna tidak dapat membatalkan permintaan perubahan cuti.';
  end if;

  if length(trim(p_reason)) < 3 then
    raise exception using
      errcode = '22023',
      message = 'Alasan pembatalan permintaan perubahan wajib diisi.';
  end if;

  select change_request.*
  into before_row
  from public.leave_change_requests change_request
  where change_request.id = p_change_request_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Permintaan perubahan cuti tidak ditemukan.';
  end if;

  if before_row.employee_id is distinct from requester_id then
    raise exception using
      errcode = '42501',
      message = 'Hanya pemilik permintaan yang dapat membatalkan.';
  end if;

  if before_row.status <> 'pending'
    or before_row.request_version <> p_expected_version then
    raise exception using
      errcode = '40001',
      message = 'Permintaan perubahan sudah berubah dan tidak dapat dibatalkan.';
  end if;

  if before_row.reserved_delta_days > 0 then
    update public.leave_entitlements
    set reserved_days = reserved_days - before_row.reserved_delta_days
    where employee_id = before_row.employee_id
      and leave_type_id = before_row.leave_type_id
      and year = before_row.reserved_year
      and reserved_days >= before_row.reserved_delta_days;

    if not found then
      raise exception using
        errcode = '23514',
        message = 'Reservasi saldo perubahan cuti tidak konsisten.';
    end if;
  end if;

  update public.leave_change_requests
  set
    status = 'cancelled',
    request_version = request_version + 1,
    decision_note = trim(p_reason)
  where id = before_row.id
    and status = 'pending'
    and request_version = p_expected_version
  returning * into cancelled_row;

  if not found then
    raise exception using
      errcode = '40001',
      message = 'Permintaan perubahan sudah berubah dan tidak dapat dibatalkan.';
  end if;

  insert into public.approval_events (
    subject_type,
    subject_id,
    actor_id,
    action,
    note,
    subject_version
  )
  values (
    'leave_change_request',
    cancelled_row.id,
    auth.uid(),
    'cancelled',
    trim(p_reason),
    cancelled_row.request_version
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
    auth.uid(),
    'cancel',
    'leave_change_request',
    cancelled_row.id,
    to_jsonb(before_row),
    to_jsonb(cancelled_row),
    trim(p_reason)
  );

  return cancelled_row;
end;
$$;

create function public.decide_leave_change_request(
  p_change_request_id uuid,
  p_expected_version integer,
  p_decision text,
  p_note text
)
returns public.leave_change_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_change public.leave_change_requests%rowtype;
  decided_change public.leave_change_requests%rowtype;
  before_leave public.leave_requests%rowtype;
  changed_leave public.leave_requests%rowtype;
  entitlement public.leave_entitlements%rowtype;
  roster_result jsonb := '{}'::jsonb;
  affected_schedule_ids jsonb := '[]'::jsonb;
begin
  if not public.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'Hanya supervisor yang dapat memutuskan perubahan cuti.';
  end if;

  if p_decision not in ('approved', 'rejected')
    or (p_decision = 'rejected' and length(trim(p_note)) < 3) then
    raise exception using
      errcode = '22023',
      message = 'Keputusan atau catatan penolakan tidak valid.';
  end if;

  select change_request.*
  into before_change
  from public.leave_change_requests change_request
  where change_request.id = p_change_request_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Permintaan perubahan cuti tidak ditemukan.';
  end if;

  if before_change.status <> 'pending'
    or before_change.request_version <> p_expected_version then
    raise exception using
      errcode = '40001',
      message = 'Permintaan perubahan sudah diputuskan atau berubah.';
  end if;

  if before_change.employee_id = public.current_employee_id() then
    raise exception using
      errcode = '42501',
      message = 'Supervisor tidak dapat memutuskan perubahan cutinya sendiri.';
  end if;

  select request.*
  into before_leave
  from public.leave_requests request
  where request.id = before_change.leave_request_id
  for update;

  if not found
    or before_leave.status <> 'approved'
    or before_leave.request_version <> before_change.source_leave_version
    or before_leave.starts_on <> before_change.old_starts_on
    or before_leave.ends_on <> before_change.old_ends_on
    or before_leave.requested_days <> before_change.old_requested_days then
    raise exception using
      errcode = '40001',
      message = 'Cuti sumber sudah berubah; permintaan perubahan tidak lagi berlaku.';
  end if;

  if p_decision = 'approved'
    and before_leave.starts_on <= current_date then
    raise exception using
      errcode = '23514',
      message = 'Cuti yang sudah dimulai atau berlalu memerlukan koreksi operasional khusus.';
  end if;

  if p_decision = 'approved'
    and before_change.change_type = 'reschedule' then
    if before_change.proposed_starts_on <= current_date then
      raise exception using
        errcode = '23514',
        message = 'Tanggal cuti pengganti sudah dimulai atau berlalu.';
    end if;

    if exists (
      select 1
      from public.leave_requests other_request
      where other_request.employee_id = before_change.employee_id
        and other_request.id <> before_leave.id
        and other_request.status in ('pending', 'approved')
        and daterange(
          other_request.starts_on,
          other_request.ends_on,
          '[]'
        ) && daterange(
          before_change.proposed_starts_on,
          before_change.proposed_ends_on,
          '[]'
        )
    ) then
      raise exception using
        errcode = '23P01',
        message = 'Tanggal cuti pengganti kini berbenturan dengan pengajuan aktif lain.';
    end if;

    if exists (
      select 1
      from public.roster_periods period
      where period.status = 'closed'
        and period.month_start <= before_change.proposed_ends_on
        and (period.month_start + interval '1 month - 1 day')::date
          >= before_change.proposed_starts_on
    ) then
      raise exception using
        errcode = '23514',
        message = 'Tanggal cuti pengganti berada pada periode roster yang sudah ditutup.';
    end if;
  end if;

  if before_change.reserved_delta_days > 0
    or exists (
      select 1
      from public.leave_types leave_type
      where leave_type.id = before_change.leave_type_id
        and leave_type.deducts_annual_balance
    ) then
    select balance.*
    into entitlement
    from public.leave_entitlements balance
    where balance.employee_id = before_change.employee_id
      and balance.leave_type_id = before_change.leave_type_id
      and balance.year = extract(year from before_change.old_starts_on)::integer
    for update;

    if not found then
      raise exception using
        errcode = '23514',
        message = 'Saldo Cuti Tahunan tidak ditemukan.';
    end if;
  end if;

  if p_decision = 'rejected' then
    if before_change.reserved_delta_days > 0 then
      if entitlement.reserved_days < before_change.reserved_delta_days then
        raise exception using
          errcode = '23514',
          message = 'Reservasi saldo perubahan cuti tidak konsisten.';
      end if;

      update public.leave_entitlements
      set reserved_days = reserved_days - before_change.reserved_delta_days
      where id = entitlement.id;
    end if;
  else
    if entitlement.id is not null then
      if entitlement.used_days < before_change.old_requested_days
        or entitlement.reserved_days < before_change.reserved_delta_days then
        raise exception using
          errcode = '23514',
          message = 'Saldo terpakai atau reservasi perubahan cuti tidak konsisten.';
      end if;

      update public.leave_entitlements
      set
        used_days = used_days
          - before_change.old_requested_days
          + case
              when before_change.change_type = 'reschedule'
                then before_change.proposed_days
              else 0
            end,
        reserved_days =
          reserved_days - before_change.reserved_delta_days
      where id = entitlement.id;
    end if;

    roster_result := public.reconcile_changed_leave_roster(
      before_leave.id,
      before_change.old_starts_on,
      before_change.old_ends_on,
      before_change.proposed_starts_on,
      before_change.proposed_ends_on
    );

    -- Backup alerts describe the old leave dates. Close only alerts that are
    -- still actionable before a reschedule creates replacement-date alerts.
    update public.notifications notification
    set
      title = 'Kebutuhan backup perlu ditinjau ulang',
      body = case
        when before_change.change_type = 'cancel' then
          'Cuti terkait telah dibatalkan. Kebutuhan backup lama tidak lagi aktif; tinjau draft roster terbaru.'
        else
          'Tanggal cuti terkait telah berubah. Kebutuhan backup lama tidak lagi aktif; tinjau kebutuhan backup pada tanggal pengganti.'
      end,
      payload = notification.payload || jsonb_build_object(
        'superseded', true,
        'superseded_at', now(),
        'change_request_id', before_change.id,
        'change_type', before_change.change_type
      )
    where notification.notification_type = 'roster_backup_required'
      and (
        notification.subject_id = before_leave.id
        or notification.payload->>'leave_request_id' = before_leave.id::text
      )
      and coalesce(notification.payload->>'superseded', 'false') <> 'true';

    if before_change.change_type = 'cancel' then
      update public.leave_requests
      set
        status = 'cancelled',
        request_version = request_version + 1
      where id = before_leave.id
        and status = 'approved'
        and request_version = before_change.source_leave_version
      returning * into changed_leave;

      if changed_leave.id is null then
        raise exception using
          errcode = '40001',
          message = 'Cuti sumber berubah saat keputusan diproses.';
      end if;
    else
      update public.leave_requests
      set
        starts_on = before_change.proposed_starts_on,
        ends_on = before_change.proposed_ends_on,
        requested_days = before_change.proposed_days,
        request_version = request_version + 1
      where id = before_leave.id
        and status = 'approved'
        and request_version = before_change.source_leave_version
      returning * into changed_leave;

      if changed_leave.id is null then
        raise exception using
          errcode = '40001',
          message = 'Cuti sumber berubah saat keputusan diproses.';
      end if;

      affected_schedule_ids := public.sync_approved_leave_to_roster(
        changed_leave.id
      );

      update public.request_attachments attachment
      set retention_until = make_timestamptz(
        extract(year from changed_leave.ends_on)::integer + 1,
        1,
        1,
        0,
        0,
        0,
        'Asia/Jakarta'
      )
      where attachment.subject_type = 'leave_request'
        and attachment.subject_id = changed_leave.id
        and attachment.deleted_at is null;
    end if;

    insert into public.approval_events (
      subject_type,
      subject_id,
      actor_id,
      action,
      note,
      subject_version
    )
    values (
      'leave_request',
      changed_leave.id,
      auth.uid(),
      case
        when before_change.change_type = 'cancel'
          then 'cancelled_by_change'
        else 'rescheduled'
      end,
      nullif(trim(p_note), ''),
      changed_leave.request_version
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
      auth.uid(),
      case
        when before_change.change_type = 'cancel'
          then 'cancel_approved'
        else 'reschedule_approved'
      end,
      'leave_request',
      changed_leave.id,
      to_jsonb(before_leave),
      to_jsonb(changed_leave),
      coalesce(nullif(trim(p_note), ''), before_change.reason)
    );

    perform public.workforce_notify_supervisors(
      'leave_change_roster_review',
      'Tinjau draft roster setelah perubahan cuti',
      'Perubahan cuti telah diterapkan. Tinjau shift lama, tanggal baru, dan penugasan backup sebelum roster dipublikasikan.',
      'leave_change_request',
      before_change.id,
      jsonb_build_object(
        'leave_request_id', before_leave.id,
        'change_type', before_change.change_type,
        'roster_result', roster_result,
        'affected_schedule_ids', affected_schedule_ids
      ),
      before_change.employee_id
    );
  end if;

  update public.leave_change_requests
  set
    status = p_decision::public.request_status,
    request_version = request_version + 1,
    decided_by = auth.uid(),
    decided_at = now(),
    decision_note = nullif(trim(p_note), '')
  where id = before_change.id
    and status = 'pending'
    and request_version = p_expected_version
  returning * into decided_change;

  if not found then
    raise exception using
      errcode = '40001',
      message = 'Permintaan perubahan sudah diputuskan oleh supervisor lain.';
  end if;

  perform public.workforce_notify_employee(
    before_change.employee_id,
    'leave_change_decided',
    case
      when p_decision = 'approved' then 'Perubahan cuti disetujui'
      else 'Perubahan cuti ditolak'
    end,
    case
      when p_decision = 'approved' then
        case
          when before_change.change_type = 'cancel'
            then 'Pembatalan cuti Anda telah disetujui.'
          else 'Tanggal cuti baru Anda telah disetujui.'
        end
      else format('Permintaan perubahan cuti ditolak: %s', trim(p_note))
    end,
    'leave_change_request',
    decided_change.id,
    jsonb_build_object(
      'leave_request_id', before_change.leave_request_id,
      'change_type', before_change.change_type,
      'status', decided_change.status,
      'request_version', decided_change.request_version
    )
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
    'leave_change_request',
    decided_change.id,
    auth.uid(),
    p_decision,
    nullif(trim(p_note), ''),
    decided_change.request_version
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
    auth.uid(),
    'decide',
    'leave_change_request',
    decided_change.id,
    to_jsonb(before_change),
    to_jsonb(decided_change),
    nullif(trim(p_note), '')
  );

  return decided_change;
end;
$$;

create or replace function public.get_leave_workspace()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_id uuid := public.current_employee_id();
  requester_role public.access_role := public.current_access_role();
begin
  if requester_id is null or requester_role is null then
    raise exception using
      errcode = '42501',
      message = 'Sesi pengguna tidak memiliki profil karyawan aktif.';
  end if;

  perform public.ensure_annual_leave_entitlement(
    requester_id,
    extract(year from current_date)::integer
  );

  return jsonb_build_object(
    'role', requester_role,
    'current_employee_id', requester_id,
    'leave_types', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', leave_type.id,
        'code', leave_type.code,
        'name', leave_type.name,
        'deducts_annual_balance', leave_type.deducts_annual_balance,
        'minimum_notice_days', leave_type.minimum_notice_days,
        'same_day_allowed', leave_type.same_day_allowed,
        'requires_document', leave_type.requires_document,
        'document_required_after_days', leave_type.document_required_after_days,
        'is_active', leave_type.is_active
      ) order by leave_type.name)
      from public.leave_types leave_type
      where leave_type.is_active
        or requester_role in ('supervisor', 'management')
    ), '[]'::jsonb),
    'balances', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', entitlement.id,
        'employee_id', entitlement.employee_id,
        'employee_name', employee.full_name,
        'leave_type_id', entitlement.leave_type_id,
        'leave_type_name', leave_type.name,
        'year', entitlement.year,
        'granted_days', entitlement.granted_days,
        'used_days', entitlement.used_days,
        'reserved_days', entitlement.reserved_days,
        'expired_days', entitlement.expired_days,
        'available_days', greatest(
          0,
          entitlement.granted_days
            - entitlement.used_days
            - entitlement.reserved_days
            - entitlement.expired_days
        )
      ) order by employee.full_name, leave_type.name, entitlement.year desc)
      from public.leave_entitlements entitlement
      join public.employees employee on employee.id = entitlement.employee_id
      join public.leave_types leave_type on leave_type.id = entitlement.leave_type_id
      where entitlement.employee_id = requester_id
        or requester_role in ('supervisor', 'management')
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', request.id,
        'employee_id', request.employee_id,
        'employee_name', employee.full_name,
        'position_name', position.name,
        'leave_type_id', request.leave_type_id,
        'leave_type_name', leave_type.name,
        'starts_on', request.starts_on,
        'ends_on', request.ends_on,
        'requested_days', request.requested_days,
        'reason', request.reason,
        'status', request.status,
        'request_version', request.request_version,
        'decision_note', request.decision_note,
        'created_at', request.created_at,
        'decided_at', request.decided_at,
        'can_decide', requester_role = 'supervisor'
          and request.employee_id <> requester_id
          and request.status = 'pending',
        'can_amend', request.employee_id = requester_id
          and request.status = 'pending',
        'can_cancel', request.employee_id = requester_id
          and request.status = 'pending',
        'can_request_change', request.employee_id = requester_id
          and request.status = 'approved'
          and request.starts_on > current_date
          and not exists (
            select 1
            from public.leave_change_requests open_change
            where open_change.leave_request_id = request.id
              and open_change.status = 'pending'
          ),
        'attachments', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', attachment.id,
            'document_type', attachment.document_type,
            'mime_type', attachment.mime_type,
            'size_bytes', attachment.size_bytes,
            'storage_bucket', attachment.storage_bucket,
            'storage_path', attachment.storage_path,
            'retention_until', attachment.retention_until,
            'deleted_at', attachment.deleted_at
          ) order by attachment.created_at)
          from public.request_attachments attachment
          where attachment.subject_type = 'leave_request'
            and attachment.subject_id = request.id
            and (
              request.employee_id = requester_id
              or requester_role = 'supervisor'
            )
        ), '[]'::jsonb)
      ) order by request.created_at desc)
      from public.leave_requests request
      join public.employees employee on employee.id = request.employee_id
      join public.job_positions position on position.id = employee.job_position_id
      join public.leave_types leave_type on leave_type.id = request.leave_type_id
      where request.employee_id = requester_id
        or requester_role in ('supervisor', 'management')
    ), '[]'::jsonb),
    'change_requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', change_request.id,
        'leave_request_id', change_request.leave_request_id,
        'employee_id', change_request.employee_id,
        'employee_name', employee.full_name,
        'leave_type_id', change_request.leave_type_id,
        'leave_type_name', leave_type.name,
        'change_type', change_request.change_type,
        'source_leave_version', change_request.source_leave_version,
        'old_starts_on', change_request.old_starts_on,
        'old_ends_on', change_request.old_ends_on,
        'old_requested_days', change_request.old_requested_days,
        'proposed_starts_on', change_request.proposed_starts_on,
        'proposed_ends_on', change_request.proposed_ends_on,
        'proposed_days', change_request.proposed_days,
        'reason', change_request.reason,
        'status', change_request.status,
        'request_version', change_request.request_version,
        'reserved_delta_days', change_request.reserved_delta_days,
        'reserved_year', change_request.reserved_year,
        'decision_note', change_request.decision_note,
        'created_at', change_request.created_at,
        'decided_at', change_request.decided_at,
        'can_cancel', change_request.employee_id = requester_id
          and change_request.status = 'pending',
        'can_decide', requester_role = 'supervisor'
          and change_request.employee_id <> requester_id
          and change_request.status = 'pending',
        'is_stale', change_request.status = 'pending'
          and change_request.old_starts_on <= current_date
      ) order by change_request.created_at desc)
      from public.leave_change_requests change_request
      join public.employees employee on employee.id = change_request.employee_id
      join public.leave_types leave_type on leave_type.id = change_request.leave_type_id
      where change_request.employee_id = requester_id
        or requester_role in ('supervisor', 'management')
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.reconcile_changed_leave_roster(
  uuid,
  date,
  date,
  date,
  date
) from public, anon, authenticated;
revoke all on function public.amend_pending_leave_request(
  uuid,
  integer,
  date,
  date,
  text
) from public, anon, authenticated;
revoke all on function public.submit_leave_change_request(
  uuid,
  integer,
  text,
  date,
  date,
  text
) from public, anon, authenticated;
revoke all on function public.cancel_leave_change_request(
  uuid,
  integer,
  text
) from public, anon, authenticated;
revoke all on function public.decide_leave_change_request(
  uuid,
  integer,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.amend_pending_leave_request(
  uuid,
  integer,
  date,
  date,
  text
) to authenticated;
grant execute on function public.submit_leave_change_request(
  uuid,
  integer,
  text,
  date,
  date,
  text
) to authenticated;
grant execute on function public.cancel_leave_change_request(
  uuid,
  integer,
  text
) to authenticated;
grant execute on function public.decide_leave_change_request(
  uuid,
  integer,
  text,
  text
) to authenticated;
