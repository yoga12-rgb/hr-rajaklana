begin;

select plan(10);

select ok(
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'employees'
  ),
  'employees table exists'
);

select ok(
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'schedule_assignments'
  ),
  'schedule assignments table exists'
);

select ok(
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'attendance_records'
  ),
  'attendance records table exists'
);

select is(
  (
    select count(*)::integer
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'employees',
        'schedule_assignments',
        'attendance_records',
        'leave_requests',
        'overtime_requests'
      )
      and relation.relrowsecurity
  ),
  5,
  'core workforce tables have RLS enabled'
);

select is(
  (
    select count(*)::integer
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'decide_leave_request',
        'decide_overtime_request',
        'decide_attendance_correction',
        'validate_attendance'
      )
      and procedure.prosecdef
  ),
  4,
  'approval RPCs are security definer functions'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'leave_requests',
        'overtime_requests',
        'attendance_correction_requests'
      )
      and cmd in ('UPDATE', 'ALL')
  ),
  0,
  'approval subjects cannot be updated directly through RLS'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = 'attendance_validations'
      and cmd in ('INSERT', 'UPDATE', 'ALL')
  ),
  0,
  'attendance validations can only be written through the validation RPC'
);

select is(
  (
    select count(*)::integer
    from storage.buckets
    where id in (
      'attendance-selfies',
      'leave-documents',
      'imports',
      'exports'
    )
      and public
  ),
  0,
  'all application storage buckets are private'
);

select is(
  (
    select count(*)::integer
    from storage.buckets
    where id in (
      'attendance-selfies',
      'leave-documents',
      'imports',
      'exports'
    )
  ),
  4,
  'all required storage buckets exist'
);

select ok(
  exists (
    select 1
    from pg_constraint constraint_definition
    join pg_class relation on relation.oid = constraint_definition.conrelid
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'attendance_validations'
      and constraint_definition.contype = 'u'
      and pg_get_constraintdef(constraint_definition.oid)
        like '%attendance_record_id, record_version%'
  ),
  'attendance validation history is unique per record version'
);

select * from finish();

rollback;
