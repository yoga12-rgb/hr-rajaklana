begin;

set local search_path = extensions, public, pg_catalog;

select extensions.plan(10);

select extensions.ok(
  exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'employees'
      and relation.relkind = 'r'
  ),
  'employees table exists'
);

select extensions.ok(
  exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'schedule_assignments'
      and relation.relkind = 'r'
  ),
  'schedule assignments table exists'
);

select extensions.ok(
  exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'attendance_records'
      and relation.relkind = 'r'
  ),
  'attendance records table exists'
);

select extensions.is(
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

select extensions.is(
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

select extensions.is(
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

select extensions.is(
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

select extensions.is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'attendance_selfies_insert_own',
        'attendance_selfies_read_authorized',
        'leave_documents_insert_own',
        'leave_documents_read_authorized',
        'imports_manage_supervisor',
        'exports_read_operations',
        'exports_manage_supervisor'
      )
  ),
  7,
  'all private storage access policies exist'
);

select extensions.is(
  (
    select count(*)::integer
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'storage'
      and relation.relname = 'objects'
      and relation.relrowsecurity
  ),
  1,
  'storage objects table has RLS enabled'
);

select extensions.ok(
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

select * from extensions.finish();

rollback;
