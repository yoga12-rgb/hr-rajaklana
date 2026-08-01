-- Reconcile leave requests that were approved before roster synchronization was
-- introduced. Published roster versions remain immutable: the existing helper
-- creates or reuses an editable draft and records the change in the audit log.

do $migration$
declare
  original_claim_sub text := current_setting('request.jwt.claim.sub', true);
  approved_request record;
begin
  for approved_request in
    select
      leave_request.id,
      coalesce(
        active_decider.user_id,
        fallback_supervisor.user_id
      ) as actor_user_id
    from public.leave_requests leave_request
    left join public.user_accounts active_decider
      on active_decider.user_id = leave_request.decided_by
      and active_decider.access_role = 'supervisor'
      and active_decider.account_status = 'active'
    left join lateral (
      select account.user_id
      from public.user_accounts account
      join public.employees employee
        on employee.id = account.employee_id
      where account.access_role = 'supervisor'
        and account.account_status = 'active'
        and employee.archived_at is null
      order by account.created_at, account.user_id
      limit 1
    ) fallback_supervisor on true
    where leave_request.status = 'approved'
      and coalesce(
        active_decider.user_id,
        fallback_supervisor.user_id
      ) is not null
      and exists (
        select 1
        from public.roster_periods period
        where period.month_start <= leave_request.ends_on
          and (period.month_start + interval '1 month - 1 day')::date
            >= leave_request.starts_on
          and period.status <> 'closed'
      )
      and not exists (
        select 1
        from public.audit_logs audit
        where audit.action = 'sync_approved_leave_to_roster'
          and audit.entity_type = 'leave_request'
          and audit.entity_id = leave_request.id
      )
    order by leave_request.created_at, leave_request.id
  loop
    perform set_config(
      'request.jwt.claim.sub',
      approved_request.actor_user_id::text,
      true
    );
    perform public.sync_approved_leave_to_roster(approved_request.id);
  end loop;

  perform set_config(
    'request.jwt.claim.sub',
    coalesce(original_claim_sub, ''),
    true
  );
end;
$migration$;

-- Keep manual edits and bulk fill from becoming an official roster while an
-- approved leave day is still represented as scheduled work. The function is
-- patched from its current database definition so later roster validations are
-- preserved without duplicating the entire publisher implementation here.

do $migration$
declare
  function_definition text;
  declaration_anchor text := '  staffing_conflict_count integer;';
  declaration_replacement text := E'  staffing_conflict_count integer;\n  approved_leave_conflict_count integer;';
  publish_anchor text := E'  update public.roster_versions\n  set\n    status = ''superseded'',';
  publish_guard text := E'  select count(*)\n  into approved_leave_conflict_count\n  from public.schedule_assignments assignment\n  join public.leave_requests leave_request\n    on leave_request.employee_id = assignment.employee_id\n    and leave_request.status = ''approved''\n    and assignment.work_date between\n      leave_request.starts_on and leave_request.ends_on\n  where assignment.roster_version_id = version_row.id\n    and assignment.status = ''scheduled'';\n\n  if approved_leave_conflict_count > 0 then\n    raise exception\n      ''Roster memuat % jadwal kerja pada tanggal cuti approved'',\n      approved_leave_conflict_count;\n  end if;\n\n  update public.roster_versions\n  set\n    status = ''superseded'',';
begin
  select pg_get_functiondef(
    'public.publish_manual_roster(uuid,text)'::regprocedure
  )
  into function_definition;

  if function_definition is null then
    raise exception 'Fungsi publish_manual_roster tidak ditemukan';
  end if;

  if position('approved_leave_conflict_count integer' in function_definition) = 0 then
    if position(declaration_anchor in function_definition) = 0 then
      raise exception 'Anchor deklarasi publish_manual_roster tidak ditemukan';
    end if;

    function_definition := replace(
      function_definition,
      declaration_anchor,
      declaration_replacement
    );
  end if;

  if position(
    'jadwal kerja pada tanggal cuti approved' in function_definition
  ) = 0 then
    if position(publish_anchor in function_definition) = 0 then
      raise exception 'Anchor publikasi publish_manual_roster tidak ditemukan';
    end if;

    function_definition := replace(
      function_definition,
      publish_anchor,
      publish_guard
    );
  end if;

  execute function_definition;
end;
$migration$;
