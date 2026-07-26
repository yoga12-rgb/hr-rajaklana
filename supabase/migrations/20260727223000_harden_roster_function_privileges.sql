-- Supabase hosted may grant newly-created functions directly to API roles.
-- Revoke every implicit/direct grant first, then expose only the intended RPCs.

revoke all on function public.prevent_published_schedule_mutation()
  from public, anon, authenticated;
revoke all on function public.ensure_manual_roster_draft(date, text)
  from public, anon, authenticated;

revoke all on function public.save_manual_roster_assignment(
  date,
  uuid,
  date,
  uuid,
  public.shift_type,
  public.schedule_status,
  text,
  text,
  date,
  boolean
) from public, anon, authenticated;
revoke all on function public.get_monthly_roster(date)
  from public, anon, authenticated;
revoke all on function public.publish_manual_roster(uuid, text)
  from public, anon, authenticated;
revoke all on function public.acknowledge_monthly_roster(date)
  from public, anon, authenticated;
revoke all on function public.get_shift_swap_options(uuid)
  from public, anon, authenticated;
revoke all on function public.request_shift_swap(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.decide_shift_swap_colleague(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.decide_shift_swap_supervisor(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.save_manual_roster_assignment(
  date,
  uuid,
  date,
  uuid,
  public.shift_type,
  public.schedule_status,
  text,
  text,
  date,
  boolean
) to authenticated;
grant execute on function public.get_monthly_roster(date) to authenticated;
grant execute on function public.publish_manual_roster(uuid, text)
  to authenticated;
grant execute on function public.acknowledge_monthly_roster(date)
  to authenticated;
grant execute on function public.get_shift_swap_options(uuid)
  to authenticated;
grant execute on function public.request_shift_swap(uuid, uuid, text)
  to authenticated;
grant execute on function public.decide_shift_swap_colleague(uuid, text, text)
  to authenticated;
grant execute on function public.decide_shift_swap_supervisor(uuid, text, text)
  to authenticated;
