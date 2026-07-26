revoke all on function public.current_employee_id() from public;
revoke all on function public.current_employee_id() from anon;

revoke all on function public.current_access_role() from public;
revoke all on function public.current_access_role() from anon;

revoke all on function public.is_supervisor() from public;
revoke all on function public.is_supervisor() from anon;

revoke all on function public.can_view_sensitive_operations() from public;
revoke all on function public.can_view_sensitive_operations() from anon;

grant execute on function public.current_employee_id() to authenticated;
grant execute on function public.current_access_role() to authenticated;
grant execute on function public.is_supervisor() to authenticated;
grant execute on function public.can_view_sensitive_operations() to authenticated;
