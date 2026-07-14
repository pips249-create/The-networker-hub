-- Close hub_accounts self-service privilege escalation; revoke broad grants on backend-only tables.

-- ── hub_accounts: read own row only; all writes via API (service_role) ───────
drop policy if exists "Users update own hub account" on public.hub_accounts;

revoke all on table public.hub_accounts from anon;
revoke insert, update, delete on table public.hub_accounts from authenticated;

-- ── Backend-only tables added after 114_rls_hardening (defense in depth) ─────
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'alumni_invites',
    'opportunity_favourites',
    'opportunity_saved_searches',
    'opportunity_saved_search_hits',
    'complaints'
  ]
  loop
    if to_regclass('public.' || tbl) is not null then
      execute format('revoke all on table public.%I from anon, authenticated', tbl);
    end if;
  end loop;
end $$;
