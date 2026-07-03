-- Explicit RLS: hub revenue deals are backend/admin only.

alter table public.hub_revenue_deals enable row level security;

drop policy if exists hub_revenue_deals_service_role_all on public.hub_revenue_deals;

create policy hub_revenue_deals_service_role_all
  on public.hub_revenue_deals
  for all
  to service_role
  using (true)
  with check (true);

revoke all on table public.hub_revenue_deals from anon, authenticated;
grant select, insert, update, delete on table public.hub_revenue_deals to service_role;
