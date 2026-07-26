revoke all on function public.attendance_distance_m(
  numeric, numeric, numeric, numeric
) from public, anon, authenticated;

revoke all on function public.get_attendance_workspace()
  from public, anon;
revoke all on function public.clock_in_attendance(
  uuid, uuid, numeric, numeric, numeric, timestamptz, boolean, jsonb, text
) from public, anon;
revoke all on function public.clock_out_attendance(
  uuid, numeric, numeric, numeric, timestamptz, boolean
) from public, anon;

grant execute on function public.get_attendance_workspace()
  to authenticated;
grant execute on function public.clock_in_attendance(
  uuid, uuid, numeric, numeric, numeric, timestamptz, boolean, jsonb, text
) to authenticated;
grant execute on function public.clock_out_attendance(
  uuid, numeric, numeric, numeric, timestamptz, boolean
) to authenticated;
