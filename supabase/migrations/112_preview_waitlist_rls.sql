-- Explicit RLS: preview waitlist is service-role only.

alter table public.preview_waitlist enable row level security;

drop policy if exists preview_waitlist_service_role_all on public.preview_waitlist;

create policy preview_waitlist_service_role_all
  on public.preview_waitlist
  for all
  to service_role
  using (true)
  with check (true);

revoke all on table public.preview_waitlist from anon, authenticated;
grant select, insert, update, delete on table public.preview_waitlist to service_role;
