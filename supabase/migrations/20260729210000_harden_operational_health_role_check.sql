-- The initial M8 health function used `role not in (...)`. In PostgreSQL that
-- expression is NULL (not true) when an authenticated JWT has no active
-- application account. Keep the aggregate implementation private and put a
-- NULL-safe account-role gate in front of it.

alter function public.get_operational_health_workspace()
  rename to get_operational_health_workspace_internal;

revoke all on function public.get_operational_health_workspace_internal()
  from public, anon, authenticated, service_role;

create function public.get_operational_health_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_role public.access_role := public.current_access_role();
begin
  if viewer_role is null
    or viewer_role not in ('supervisor', 'management') then
    raise exception using
      errcode = '42501',
      message = 'Kesehatan operasional hanya tersedia untuk supervisor dan management.';
  end if;

  return public.get_operational_health_workspace_internal();
end;
$$;

revoke all on function public.get_operational_health_workspace()
  from public, anon, authenticated, service_role;
grant execute on function public.get_operational_health_workspace()
  to authenticated;

comment on function public.get_operational_health_workspace_internal() is
  'Internal redacted operational aggregates; execute only through the NULL-safe account-role wrapper.';

comment on function public.get_operational_health_workspace() is
  'NULL-safe supervisor/management operational health workspace.';
