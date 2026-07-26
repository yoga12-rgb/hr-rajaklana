create or replace function public.complete_password_change()
returns public.user_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  previous_account public.user_accounts%rowtype;
  updated_account public.user_accounts%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication is required';
  end if;

  select *
  into previous_account
  from public.user_accounts
  where user_id = actor_id
  for update;

  if not found then
    raise exception 'User account not found';
  end if;

  if previous_account.account_status in ('locked', 'deactivated') then
    raise exception 'User account cannot change password';
  end if;

  update public.user_accounts
  set
    account_status = 'active',
    must_change_password = false,
    last_login_at = now()
  where user_id = actor_id
  returning * into updated_account;

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
    actor_id,
    'change_password',
    'user_account',
    actor_id,
    to_jsonb(previous_account),
    to_jsonb(updated_account),
    'first_login_or_manual_change'
  );

  return updated_account;
end;
$$;

revoke all on function public.complete_password_change() from public;
revoke all on function public.complete_password_change() from anon;
grant execute on function public.complete_password_change() to authenticated;
