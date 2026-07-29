-- M8 operational health workspace. This function deliberately returns only
-- aggregate queue state and a redacted audit timeline: Storage paths, audit
-- payloads, error bodies, actor identifiers, and secrets never leave the
-- database through this RPC.

create index if not exists audit_logs_created_at_desc
  on public.audit_logs (created_at desc);

create index if not exists backup_exports_status_updated
  on public.backup_exports (status, updated_at desc);

create index if not exists roster_generation_runs_status_created
  on public.roster_generation_runs (status, created_at desc);

create or replace function public.get_operational_health_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_role public.access_role := public.current_access_role();
  generated_at timestamptz := now();
  stale_worker_before timestamptz := now() - interval '15 minutes';
  stale_cron_before timestamptz := now() - interval '26 hours';
  last_cron public.audit_logs;
  retention_scheduled integer;
  retention_retrying integer;
  retention_overdue integer;
  retention_stale_processing integer;
  retention_exhausted integer;
  export_scheduled integer;
  export_stale_scheduled integer;
  export_processing integer;
  export_stale_processing integer;
  export_retrying integer;
  export_exhausted integer;
  export_last_completed_at timestamptz;
  roster_active integer;
  roster_stale integer;
  roster_failed integer;
  roster_last_completed_at timestamptz;
  audit_events_24h integer;
  audit_failures_24h integer;
  audit_last_event_at timestamptz;
  application_backups integer;
  application_backup_last_completed_at timestamptz;
  issue_count integer;
  critical_count integer;
begin
  if viewer_role not in ('supervisor', 'management') then
    raise exception using
      errcode = '42501',
      message = 'Kesehatan operasional hanya tersedia untuk supervisor dan management.';
  end if;

  select *
  into last_cron
  from public.audit_logs audit
  where audit.entity_type = 'attendance_retention_worker'
    and audit.user_agent = 'vercel-cron/1.0'
    and audit.action in ('cron_completed', 'cron_failed')
  order by audit.created_at desc
  limit 1;

  select
    count(*) filter (where job.status = 'scheduled'),
    count(*) filter (
      where job.status = 'failed' and job.attempt_count < 6
    ),
    count(*) filter (
      where job.status in ('scheduled', 'failed')
        and job.scheduled_for <= generated_at
        and job.attempt_count < 6
    ),
    count(*) filter (
      where job.status = 'processing'
        and job.updated_at < stale_worker_before
    ),
    count(*) filter (
      where job.status = 'failed' and job.attempt_count >= 6
    )
  into
    retention_scheduled,
    retention_retrying,
    retention_overdue,
    retention_stale_processing,
    retention_exhausted
  from public.file_deletion_jobs job
  where job.evidence_id is not null;

  select
    count(*) filter (where export.status = 'scheduled'),
    count(*) filter (
      where export.status = 'scheduled'
        and export.created_at < stale_worker_before
    ),
    count(*) filter (where export.status = 'processing'),
    count(*) filter (
      where export.status = 'processing'
        and coalesce(export.started_at, export.updated_at) < stale_worker_before
    ),
    count(*) filter (
      where export.status = 'failed' and export.attempt_count < 3
    ),
    count(*) filter (
      where export.status = 'failed' and export.attempt_count >= 3
    ),
    max(export.completed_at) filter (where export.status = 'completed')
  into
    export_scheduled,
    export_stale_scheduled,
    export_processing,
    export_stale_processing,
    export_retrying,
    export_exhausted,
    export_last_completed_at
  from public.backup_exports export
  where export.export_type = 'report';

  select
    count(*) filter (
      where run.status in ('scheduled', 'processing')
    ),
    count(*) filter (
      where run.status in ('scheduled', 'processing')
        and run.created_at < stale_worker_before
    ),
    count(*) filter (where run.status = 'failed'),
    max(run.completed_at) filter (where run.status = 'completed')
  into
    roster_active,
    roster_stale,
    roster_failed,
    roster_last_completed_at
  from public.roster_generation_runs run;

  select
    count(*) filter (where audit.created_at >= generated_at - interval '24 hours'),
    count(*) filter (
      where audit.created_at >= generated_at - interval '24 hours'
        and (
          audit.action like '%failed'
          or audit.action like '%rejected'
        )
    ),
    max(audit.created_at)
  into audit_events_24h, audit_failures_24h, audit_last_event_at
  from public.audit_logs audit;

  select
    count(*) filter (where export.status = 'completed'),
    max(export.completed_at) filter (where export.status = 'completed')
  into application_backups, application_backup_last_completed_at
  from public.backup_exports export
  where export.export_type in ('weekly_backup', 'monthly_archive');

  critical_count :=
    retention_stale_processing
    + retention_exhausted
    + export_stale_processing
    + export_exhausted
    + roster_stale
    + roster_failed;

  issue_count :=
    critical_count
    + retention_retrying
    + retention_overdue
    + export_stale_scheduled
    + export_retrying
    + case
        when last_cron.id is null
          or last_cron.action = 'cron_failed'
          or last_cron.created_at < stale_cron_before
        then 1
        else 0
      end;

  return jsonb_build_object(
    'role', viewer_role,
    'generated_at', generated_at,
    'overall_status', case
      when critical_count > 0 then 'critical'
      when issue_count > 0 then 'attention'
      else 'healthy'
    end,
    'issue_count', issue_count,
    'retention', jsonb_build_object(
      'scheduled', retention_scheduled,
      'retrying', retention_retrying,
      'overdue', retention_overdue,
      'stale_processing', retention_stale_processing,
      'exhausted', retention_exhausted,
      'last_cron_at', last_cron.created_at,
      'last_cron_status', case
        when last_cron.action = 'cron_completed' then 'completed'
        when last_cron.action = 'cron_failed' then 'failed'
        else null
      end,
      'last_cron_stale', (
        last_cron.id is null or last_cron.created_at < stale_cron_before
      )
    ),
    'report_exports', jsonb_build_object(
      'scheduled', export_scheduled,
      'stale_scheduled', export_stale_scheduled,
      'processing', export_processing,
      'stale_processing', export_stale_processing,
      'retrying', export_retrying,
      'exhausted', export_exhausted,
      'last_completed_at', export_last_completed_at
    ),
    'roster_generation', jsonb_build_object(
      'active', roster_active,
      'stale', roster_stale,
      'failed', roster_failed,
      'last_completed_at', roster_last_completed_at
    ),
    'audit', jsonb_build_object(
      'events_24h', audit_events_24h,
      'failures_24h', audit_failures_24h,
      'last_event_at', audit_last_event_at,
      'recent_events', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'action', recent.action,
            'entity_type', recent.entity_type,
            'created_at', recent.created_at,
            'source', case
              when recent.actor_user_id is null then 'system'
              else 'user'
            end,
            'outcome', case
              when recent.action like '%failed'
                or recent.action like '%rejected'
              then 'attention'
              else 'recorded'
            end
          )
          order by recent.created_at desc
        )
        from (
          select
            audit.action,
            audit.entity_type,
            audit.actor_user_id,
            audit.created_at
          from public.audit_logs audit
          order by audit.created_at desc
          limit 12
        ) recent
      ), '[]'::jsonb)
    ),
    'application_backups', jsonb_build_object(
      'completed_artifacts', application_backups,
      'last_completed_at', application_backup_last_completed_at,
      'provider_backup_verified', false,
      'note', 'Backup provider harus diverifikasi melalui dashboard dan drill terpisah.'
    )
  );
end;
$$;

revoke all on function public.get_operational_health_workspace()
  from public, anon, authenticated;
grant execute on function public.get_operational_health_workspace()
  to authenticated;

comment on function public.get_operational_health_workspace() is
  'Supervisor/management operational health aggregates with a redacted audit timeline.';
