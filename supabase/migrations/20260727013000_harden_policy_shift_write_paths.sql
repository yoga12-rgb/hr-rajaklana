revoke insert, update, delete
  on table public.policy_versions
  from authenticated;

revoke insert, update, delete
  on table public.outlet_shift_templates
  from authenticated;

grant select
  on table public.policy_versions, public.outlet_shift_templates
  to authenticated;
