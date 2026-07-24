create extension if not exists pgcrypto with schema extensions;

create type public.access_role as enum (
  'employee',
  'supervisor',
  'management'
);

create type public.account_status as enum (
  'invited',
  'active',
  'locked',
  'deactivated'
);

create type public.shift_type as enum (
  'morning',
  'middle',
  'night'
);

create type public.roster_period_status as enum (
  'preparing',
  'draft',
  'published',
  'closed'
);

create type public.roster_version_status as enum (
  'draft',
  'published',
  'superseded'
);

create type public.schedule_status as enum (
  'scheduled',
  'off',
  'cancelled'
);

create type public.request_status as enum (
  'draft',
  'pending',
  'approved',
  'rejected',
  'cancelled'
);

create type public.attendance_status as enum (
  'open',
  'completed',
  'missing_checkout',
  'corrected'
);

create type public.validation_status as enum (
  'pending',
  'approved',
  'rejected',
  'needs_correction'
);

create type public.risk_review_status as enum (
  'open',
  'cleared',
  'confirmed'
);

create type public.job_status as enum (
  'scheduled',
  'processing',
  'completed',
  'failed',
  'cancelled'
);

create table public.employment_statuses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.job_positions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  auto_roster_eligible boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_type text not null,
  version_number integer not null check (version_number > 0),
  configuration jsonb not null default '{}'::jsonb,
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint policy_versions_effective_range
    check (effective_until is null or effective_until > effective_from),
  unique (policy_type, version_number)
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  nik text not null unique
    check (nik ~ '^RK-[0-9]{4}-[0-9]{3,}$'),
  full_name text not null check (length(trim(full_name)) >= 2),
  phone text,
  birth_date date,
  address text,
  joined_at date not null,
  employment_status_id uuid not null
    references public.employment_statuses(id) on delete restrict,
  job_position_id uuid not null
    references public.job_positions(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  employee_id uuid unique references public.employees(id) on delete restrict,
  access_role public.access_role not null default 'employee',
  must_change_password boolean not null default true,
  account_status public.account_status not null default 'invited',
  last_login_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_accounts_deactivation_state check (
    (account_status = 'deactivated' and deactivated_at is not null)
    or account_status <> 'deactivated'
  )
);

create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null
    references public.employees(id) on delete cascade,
  name text not null,
  relationship text not null,
  phone text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index emergency_contacts_one_primary
  on public.emergency_contacts (employee_id)
  where is_primary;

create table public.outlets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text not null,
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  longitude numeric(9, 6) not null check (longitude between -180 and 180),
  geofence_radius_m integer not null default 100
    check (geofence_radius_m between 50 and 500),
  policy_version_id uuid references public.policy_versions(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employee_placements (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null
    references public.employees(id) on delete restrict,
  outlet_id uuid not null
    references public.outlets(id) on delete restrict,
  start_date date not null,
  end_date date,
  is_primary boolean not null default true,
  change_reason text,
  set_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_placements_date_range
    check (end_date is null or end_date >= start_date)
);

create unique index employee_one_open_primary_placement
  on public.employee_placements (employee_id)
  where is_primary and end_date is null;

create index employee_placements_active_lookup
  on public.employee_placements (employee_id, start_date, end_date);

create table public.outlet_shift_templates (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null
    references public.outlets(id) on delete cascade,
  shift_type public.shift_type not null,
  starts_at time not null,
  ends_at time not null,
  late_tolerance_min integer not null default 15
    check (late_tolerance_min between 0 and 180),
  early_checkout_tolerance_min integer not null default 15
    check (early_checkout_tolerance_min between 0 and 180),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index outlet_shift_templates_one_active_type
  on public.outlet_shift_templates (outlet_id, shift_type)
  where is_active;

create table public.outlet_staffing_requirements (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null
    references public.outlets(id) on delete cascade,
  shift_template_id uuid not null
    references public.outlet_shift_templates(id) on delete cascade,
  cashier_count smallint not null check (cashier_count > 0),
  minimum_staff smallint not null check (minimum_staff > 0),
  effective_from date not null,
  effective_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outlet_staffing_requirements_date_range check (
    effective_until is null or effective_until >= effective_from
  ),
  unique (outlet_id, shift_template_id, cashier_count, effective_from)
);

create table public.roster_periods (
  id uuid primary key default gen_random_uuid(),
  month_start date not null unique
    check (month_start = date_trunc('month', month_start)::date),
  status public.roster_period_status not null default 'preparing',
  publish_deadline date not null,
  active_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roster_versions (
  id uuid primary key default gen_random_uuid(),
  roster_period_id uuid not null
    references public.roster_periods(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status public.roster_version_status not null default 'draft',
  change_summary text,
  created_by uuid not null references auth.users(id) on delete restrict,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roster_versions_published_fields check (
    (status = 'published' and published_at is not null and published_by is not null)
    or status <> 'published'
  ),
  unique (roster_period_id, version_number)
);

alter table public.roster_periods
  add constraint roster_periods_active_version_fk
  foreign key (active_version_id)
  references public.roster_versions(id)
  on delete set null;

create table public.employee_off_days (
  id uuid primary key default gen_random_uuid(),
  roster_period_id uuid not null
    references public.roster_periods(id) on delete cascade,
  employee_id uuid not null
    references public.employees(id) on delete restrict,
  off_date date not null,
  source_week_start date not null,
  borrowed_from_adjacent_week boolean not null default false,
  override_reason text,
  set_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (roster_period_id, employee_id, off_date)
);

create table public.schedule_assignments (
  id uuid primary key default gen_random_uuid(),
  roster_version_id uuid not null
    references public.roster_versions(id) on delete cascade,
  employee_id uuid not null
    references public.employees(id) on delete restrict,
  outlet_id uuid not null
    references public.outlets(id) on delete restrict,
  shift_template_id uuid
    references public.outlet_shift_templates(id) on delete restrict,
  work_date date not null,
  assignment_type text not null default 'primary'
    check (assignment_type in ('primary', 'backup')),
  planned_start time,
  planned_end time,
  planned_duration_min integer not null default 0
    check (planned_duration_min >= 0),
  status public.schedule_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_assignment_shift_required check (
    status <> 'scheduled'
    or (
      shift_template_id is not null
      and planned_start is not null
      and planned_end is not null
      and planned_duration_min > 0
    )
  ),
  unique (roster_version_id, employee_id, work_date)
);

create index schedule_assignments_outlet_date
  on public.schedule_assignments (outlet_id, work_date);

create index schedule_assignments_employee_date
  on public.schedule_assignments (employee_id, work_date);

create table public.schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  schedule_assignment_id uuid not null
    references public.schedule_assignments(id) on delete cascade,
  before_values jsonb not null,
  after_values jsonb not null,
  reason text not null check (length(trim(reason)) >= 3),
  changed_by uuid not null references auth.users(id) on delete restrict,
  changed_at timestamptz not null default now()
);

create table public.schedule_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  schedule_assignment_id uuid not null
    references public.schedule_assignments(id) on delete cascade,
  employee_id uuid not null
    references public.employees(id) on delete cascade,
  acknowledged_version integer not null check (acknowledged_version > 0),
  acknowledged_at timestamptz not null default now(),
  unique (schedule_assignment_id, employee_id, acknowledged_version)
);

create table public.backup_assignments (
  id uuid primary key default gen_random_uuid(),
  schedule_assignment_id uuid not null unique
    references public.schedule_assignments(id) on delete cascade,
  employee_id uuid not null
    references public.employees(id) on delete restrict,
  origin_outlet_id uuid not null
    references public.outlets(id) on delete restrict,
  destination_outlet_id uuid not null
    references public.outlets(id) on delete restrict,
  work_date date not null,
  reason text not null,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint backup_assignment_different_outlet
    check (origin_outlet_id <> destination_outlet_id)
);

create table public.shift_swap_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null
    references public.employees(id) on delete restrict,
  requester_schedule_id uuid not null
    references public.schedule_assignments(id) on delete restrict,
  colleague_id uuid not null
    references public.employees(id) on delete restrict,
  colleague_schedule_id uuid not null
    references public.schedule_assignments(id) on delete restrict,
  reason text not null,
  status text not null default 'pending_colleague'
    check (
      status in (
        'pending_colleague',
        'pending_supervisor',
        'approved',
        'rejected',
        'cancelled'
      )
    ),
  colleague_decided_at timestamptz,
  supervisor_decided_by uuid references auth.users(id) on delete restrict,
  supervisor_decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shift_swap_different_employee
    check (requester_id <> colleague_id),
  constraint shift_swap_different_schedule
    check (requester_schedule_id <> colleague_schedule_id)
);

create table public.roster_generation_runs (
  id uuid primary key default gen_random_uuid(),
  roster_version_id uuid not null
    references public.roster_versions(id) on delete cascade,
  algorithm_version text not null,
  rule_snapshot jsonb not null,
  status public.job_status not null default 'scheduled',
  requested_by uuid not null references auth.users(id) on delete restrict,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.roster_conflicts (
  id uuid primary key default gen_random_uuid(),
  generation_run_id uuid not null
    references public.roster_generation_runs(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  outlet_id uuid references public.outlets(id) on delete set null,
  work_date date,
  conflict_code text not null,
  severity text not null
    check (severity in ('warning', 'blocking')),
  description text not null,
  suggestions jsonb not null default '[]'::jsonb,
  resolution_status text not null default 'open'
    check (resolution_status in ('open', 'resolved', 'overridden')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index roster_conflicts_open
  on public.roster_conflicts (generation_run_id, severity)
  where resolution_status = 'open';

create table public.roster_score_details (
  id uuid primary key default gen_random_uuid(),
  generation_run_id uuid not null
    references public.roster_generation_runs(id) on delete cascade,
  employee_id uuid not null
    references public.employees(id) on delete cascade,
  morning_count integer not null default 0 check (morning_count >= 0),
  night_count integer not null default 0 check (night_count >= 0),
  middle_count integer not null default 0 check (middle_count >= 0),
  pairing_counts jsonb not null default '{}'::jsonb,
  fairness_score numeric(10, 4) not null default 0,
  unique (generation_run_id, employee_id)
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null
    references public.employees(id) on delete restrict,
  schedule_assignment_id uuid
    references public.schedule_assignments(id) on delete set null,
  outlet_id uuid not null
    references public.outlets(id) on delete restrict,
  work_date date not null,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  clock_in_latitude numeric(9, 6) not null
    check (clock_in_latitude between -90 and 90),
  clock_in_longitude numeric(9, 6) not null
    check (clock_in_longitude between -180 and 180),
  clock_in_accuracy_m numeric(8, 2) not null
    check (clock_in_accuracy_m >= 0),
  clock_out_latitude numeric(9, 6)
    check (clock_out_latitude between -90 and 90),
  clock_out_longitude numeric(9, 6)
    check (clock_out_longitude between -180 and 180),
  clock_out_accuracy_m numeric(8, 2)
    check (clock_out_accuracy_m >= 0),
  worked_duration_min integer check (worked_duration_min >= 0),
  attendance_status public.attendance_status not null default 'open',
  validation_status public.validation_status not null default 'pending',
  validation_due_at timestamptz,
  record_version integer not null default 1 check (record_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_clock_range
    check (clock_out_at is null or clock_out_at >= clock_in_at),
  constraint attendance_checkout_location check (
    clock_out_at is null
    or (
      clock_out_latitude is not null
      and clock_out_longitude is not null
      and clock_out_accuracy_m is not null
    )
  )
);

create unique index attendance_one_open_session
  on public.attendance_records (employee_id)
  where clock_out_at is null;

create index attendance_employee_date
  on public.attendance_records (employee_id, work_date desc);

create index attendance_pending_validation
  on public.attendance_records (validation_due_at)
  where validation_status = 'pending';

create table public.attendance_evidence (
  id uuid primary key default gen_random_uuid(),
  attendance_record_id uuid not null
    references public.attendance_records(id) on delete cascade,
  evidence_type text not null
    check (evidence_type in ('clock_in_selfie')),
  storage_bucket text not null default 'attendance-selfies',
  storage_path text not null unique,
  mime_type text not null
    check (mime_type in ('image/jpeg', 'image/webp')),
  size_bytes bigint not null check (size_bytes > 0),
  retention_status text not null default 'active'
    check (
      retention_status in (
        'active',
        'scheduled_for_deletion',
        'deleted',
        'retention_hold'
      )
    ),
  uploaded_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.attendance_risk_flags (
  id uuid primary key default gen_random_uuid(),
  attendance_record_id uuid not null
    references public.attendance_records(id) on delete cascade,
  flag_type text not null,
  severity text not null
    check (severity in ('low', 'medium', 'high')),
  evidence jsonb not null default '{}'::jsonb,
  review_status public.risk_review_status not null default 'open',
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

create table public.attendance_validations (
  id uuid primary key default gen_random_uuid(),
  attendance_record_id uuid not null
    references public.attendance_records(id) on delete cascade,
  decided_by uuid not null references auth.users(id) on delete restrict,
  decision text not null
    check (decision in ('approved', 'rejected', 'needs_correction')),
  decision_note text,
  record_version integer not null check (record_version > 0),
  decided_at timestamptz not null default now(),
  unique (attendance_record_id, record_version)
);

create table public.attendance_correction_requests (
  id uuid primary key default gen_random_uuid(),
  attendance_record_id uuid not null
    references public.attendance_records(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  before_values jsonb not null,
  requested_values jsonb not null,
  effective_values jsonb,
  reason text not null check (length(trim(reason)) >= 3),
  status public.request_status not null default 'pending',
  request_version integer not null default 1 check (request_version > 0),
  decided_by uuid references auth.users(id) on delete restrict,
  decision_note text,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.leave_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  deducts_annual_balance boolean not null default false,
  minimum_notice_days smallint not null default 0
    check (minimum_notice_days >= 0),
  same_day_allowed boolean not null default false,
  requires_document boolean not null default false,
  document_required_after_days smallint
    check (
      document_required_after_days is null
      or document_required_after_days >= 0
    ),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leave_entitlements (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null
    references public.employees(id) on delete restrict,
  leave_type_id uuid not null
    references public.leave_types(id) on delete restrict,
  year integer not null check (year between 2000 and 2200),
  granted_days numeric(6, 2) not null default 0 check (granted_days >= 0),
  used_days numeric(6, 2) not null default 0 check (used_days >= 0),
  reserved_days numeric(6, 2) not null default 0 check (reserved_days >= 0),
  expired_days numeric(6, 2) not null default 0 check (expired_days >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, leave_type_id, year)
);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null
    references public.employees(id) on delete restrict,
  leave_type_id uuid not null
    references public.leave_types(id) on delete restrict,
  starts_on date not null,
  ends_on date not null,
  requested_days numeric(6, 2) not null check (requested_days > 0),
  reason text not null check (length(trim(reason)) >= 3),
  status public.request_status not null default 'pending',
  request_version integer not null default 1 check (request_version > 0),
  decided_by uuid references auth.users(id) on delete restrict,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_requests_date_range check (ends_on >= starts_on),
  constraint leave_requests_decision_fields check (
    (
      status in ('approved', 'rejected')
      and decided_by is not null
      and decided_at is not null
    )
    or status not in ('approved', 'rejected')
  )
);

create index leave_requests_employee_period
  on public.leave_requests (employee_id, starts_on, ends_on);

create index leave_requests_pending
  on public.leave_requests (created_at)
  where status = 'pending';

create table public.request_attachments (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null
    check (subject_type in ('leave_request', 'attendance_correction')),
  subject_id uuid not null,
  employee_id uuid not null
    references public.employees(id) on delete restrict,
  storage_bucket text not null default 'leave-documents',
  storage_path text not null unique,
  document_type text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  retention_until timestamptz not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.overtime_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null
    references public.employees(id) on delete restrict,
  source_type text not null
    check (
      source_type in (
        'employee_request',
        'supervisor_assignment',
        'attendance'
      )
    ),
  attendance_record_id uuid
    references public.attendance_records(id) on delete set null,
  overtime_date date not null,
  planned_duration_min integer not null
    check (
      planned_duration_min = 0
      or (
        planned_duration_min >= 60
        and planned_duration_min % 30 = 0
      )
    ),
  actual_duration_min integer
    check (actual_duration_min is null or actual_duration_min >= 0),
  approved_duration_min integer
    check (
      approved_duration_min is null
      or approved_duration_min = 0
      or (
        approved_duration_min >= 60
        and approved_duration_min % 30 = 0
      )
    ),
  reason text not null check (length(trim(reason)) >= 3),
  status public.request_status not null default 'pending',
  request_version integer not null default 1 check (request_version > 0),
  assigned_by uuid references auth.users(id) on delete restrict,
  decided_by uuid references auth.users(id) on delete restrict,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint overtime_requests_assignment_source check (
    source_type <> 'supervisor_assignment' or assigned_by is not null
  ),
  constraint overtime_requests_decision_fields check (
    (
      status in ('approved', 'rejected')
      and decided_by is not null
      and decided_at is not null
    )
    or status not in ('approved', 'rejected')
  )
);

create index overtime_requests_employee_date
  on public.overtime_requests (employee_id, overtime_date desc);

create index overtime_requests_pending
  on public.overtime_requests (created_at)
  where status = 'pending';

create table public.approval_events (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  note text,
  subject_version integer not null check (subject_version > 0),
  created_at timestamptz not null default now()
);

create index approval_events_subject_timeline
  on public.approval_events (subject_type, subject_id, created_at desc);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  is_pinned boolean not null default false,
  acknowledgement_required boolean not null default false,
  published_at timestamptz,
  expires_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_publish_range check (
    expires_at is null
    or published_at is null
    or expires_at > published_at
  )
);

create table public.announcement_targets (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null
    references public.announcements(id) on delete cascade,
  target_type text not null
    check (target_type in ('all', 'outlet', 'employee')),
  target_id uuid,
  created_at timestamptz not null default now(),
  constraint announcement_targets_id_presence check (
    (target_type = 'all' and target_id is null)
    or (target_type <> 'all' and target_id is not null)
  )
);

create table public.announcement_receipts (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null
    references public.announcements(id) on delete cascade,
  employee_id uuid not null
    references public.employees(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (announcement_id, employee_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null
    references public.employees(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  subject_type text,
  subject_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index notifications_employee_timeline
  on public.notifications (employee_id, created_at desc);

create table public.notification_receipts (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique
    references public.notifications(id) on delete cascade,
  in_app_read_at timestamptz,
  push_sent_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint_hash text not null unique,
  endpoint_encrypted text not null,
  p256dh_encrypted text not null,
  auth_encrypted text not null,
  device_label text,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_values jsonb,
  after_values jsonb,
  reason text,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_timeline
  on public.audit_logs (entity_type, entity_id, created_at desc);

create index audit_logs_actor_timeline
  on public.audit_logs (actor_user_id, created_at desc);

create table public.file_deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid references public.attendance_evidence(id) on delete set null,
  attachment_id uuid references public.request_attachments(id) on delete set null,
  storage_bucket text not null,
  storage_path text not null,
  deletion_reason text not null,
  scheduled_for timestamptz not null,
  status public.job_status not null default 'scheduled',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint file_deletion_jobs_one_source check (
    (evidence_id is not null and attachment_id is null)
    or (evidence_id is null and attachment_id is not null)
  ),
  unique (storage_bucket, storage_path, deletion_reason)
);

create index file_deletion_jobs_due
  on public.file_deletion_jobs (scheduled_for)
  where status in ('scheduled', 'failed');

create table public.data_import_jobs (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references auth.users(id) on delete restrict,
  import_type text not null,
  source_file_path text not null,
  status public.job_status not null default 'scheduled',
  total_rows integer not null default 0 check (total_rows >= 0),
  success_rows integer not null default 0 check (success_rows >= 0),
  failed_rows integer not null default 0 check (failed_rows >= 0),
  validation_errors jsonb not null default '[]'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.backup_exports (
  id uuid primary key default gen_random_uuid(),
  export_type text not null
    check (export_type in ('weekly_backup', 'monthly_archive', 'report')),
  period_start date not null,
  period_end date not null,
  storage_path text,
  checksum text,
  requested_by uuid not null references auth.users(id) on delete restrict,
  status public.job_status not null default 'scheduled',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint backup_exports_date_range check (period_end >= period_start)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'employment_statuses',
    'job_positions',
    'employees',
    'user_accounts',
    'emergency_contacts',
    'outlets',
    'employee_placements',
    'outlet_shift_templates',
    'outlet_staffing_requirements',
    'roster_periods',
    'roster_versions',
    'employee_off_days',
    'schedule_assignments',
    'shift_swap_requests',
    'attendance_records',
    'attendance_correction_requests',
    'leave_types',
    'leave_entitlements',
    'leave_requests',
    'overtime_requests',
    'announcements',
    'announcement_receipts',
    'notification_receipts',
    'push_subscriptions',
    'file_deletion_jobs',
    'data_import_jobs',
    'backup_exports'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      table_name || '_set_updated_at',
      table_name
    );
  end loop;
end;
$$;

create or replace function public.prevent_request_self_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.decided_by is not null and exists (
    select 1
    from public.user_accounts account
    where account.user_id = new.decided_by
      and account.employee_id = new.employee_id
  ) then
    raise exception 'Self-approval is not allowed';
  end if;

  return new;
end;
$$;

create trigger leave_requests_prevent_self_approval
before insert or update of decided_by on public.leave_requests
for each row execute function public.prevent_request_self_approval();

create trigger overtime_requests_prevent_self_approval
before insert or update of decided_by on public.overtime_requests
for each row execute function public.prevent_request_self_approval();

create or replace function public.prevent_attendance_self_validation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.attendance_records attendance
    join public.user_accounts account
      on account.employee_id = attendance.employee_id
    where attendance.id = new.attendance_record_id
      and account.user_id = new.decided_by
  ) then
    raise exception 'Self-validation is not allowed';
  end if;

  return new;
end;
$$;

create trigger attendance_validations_prevent_self_approval
before insert or update of decided_by on public.attendance_validations
for each row execute function public.prevent_attendance_self_validation();

insert into public.employment_statuses (code, name)
values
  ('permanent', 'Tetap'),
  ('contract', 'Kontrak'),
  ('intern', 'Magang');

insert into public.job_positions (code, name, auto_roster_eligible)
values
  ('cashier', 'Kasir', true),
  ('sales_hr_supervisor', 'Supervisor Penjualan & SDM', false),
  ('facility_supervisor', 'Supervisor Sarana & Prasarana', false),
  ('outlet_stock_supervisor', 'Supervisor Stock Outlet', false),
  ('management', 'Manajemen', false);

insert into public.leave_types (
  code,
  name,
  deducts_annual_balance,
  minimum_notice_days,
  same_day_allowed,
  requires_document,
  document_required_after_days
)
values
  ('annual', 'Cuti Tahunan', true, 3, false, false, null),
  ('sick', 'Sakit', false, 0, true, false, 1),
  ('important', 'Izin Penting', false, 0, true, false, null),
  ('maternity', 'Cuti Melahirkan', false, 0, false, false, null),
  ('paternity', 'Cuti Ayah', false, 0, false, false, null),
  ('unpaid', 'Cuti Tidak Dibayar', false, 3, false, false, null);

insert into public.policy_versions (
  policy_type,
  version_number,
  configuration
)
values
  (
    'attendance',
    1,
    '{
      "clock_in_early_minutes": 60,
      "late_tolerance_minutes": 15,
      "early_checkout_tolerance_minutes": 15,
      "validation_deadline_days": 3,
      "approved_selfie_retention_days": 0,
      "rejected_selfie_max_retention_days": 30
    }'::jsonb
  ),
  (
    'roster',
    1,
    '{
      "weekly_off_days": 1,
      "max_middle_per_week": 1,
      "consecutive_work_day_warning": 6,
      "publish_lead_days": 7,
      "public_holidays_affect_roster": false
    }'::jsonb
  ),
  (
    'leave',
    1,
    '{
      "annual_entitlement_days": 12,
      "carry_forward": false,
      "attachment_retention": "end_of_year"
    }'::jsonb
  ),
  (
    'overtime',
    1,
    '{
      "minimum_minutes": 60,
      "increment_minutes": 30
    }'::jsonb
  );
