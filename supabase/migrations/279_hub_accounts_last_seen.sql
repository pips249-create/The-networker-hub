-- Admin-only member activity timestamps (last seen while signed in).
alter table public.hub_accounts
  add column if not exists last_seen_at timestamptz;

comment on column public.hub_accounts.last_seen_at is
  'Updated when the member uses the site while signed in (throttled). Visible to platform admins only for support and security.';

create index if not exists hub_accounts_last_seen_at_idx
  on public.hub_accounts (last_seen_at desc)
  where last_seen_at is not null;

create or replace function public.touch_hub_account_last_seen(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.hub_accounts
  set last_seen_at = now()
  where user_id = p_user_id
    and (last_seen_at is null or last_seen_at < now() - interval '3 minutes');
end;
$$;

revoke all on function public.touch_hub_account_last_seen(uuid) from public;
