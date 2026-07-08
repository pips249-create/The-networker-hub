-- Lock down backend-only tables and restrict direct Supabase client access.
-- Safe to re-run: skips tables that are not present in this project/database.
-- Note: admin_mfa_secrets is intentionally omitted — migration 072 dropped it.

create or replace function public._hub_harden_table_rls(target_table text)
returns void
language plpgsql
as $$
declare
  rel regclass;
begin
  rel := to_regclass(target_table);
  if rel is null then
    return;
  end if;

  execute format('alter table %s enable row level security', rel);
  execute format('revoke all on table %s from anon, authenticated', rel);
end;
$$;

-- ── business_opportunities ───────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.business_opportunities') is not null then
    alter table public.business_opportunities enable row level security;

    drop policy if exists business_opportunities_public_read on public.business_opportunities;
    create policy business_opportunities_public_read
      on public.business_opportunities
      for select
      to anon, authenticated
      using (status = 'published' and approval_status = 'Approved');

    revoke insert, update, delete on public.business_opportunities from anon, authenticated;
  end if;
end $$;

-- ── opportunity_enquiries (API/service role only) ────────────────────────────
do $$
begin
  perform public._hub_harden_table_rls('public.opportunity_enquiries');
  if to_regclass('public.opportunity_enquiries') is not null then
    grant select, insert, update, delete on public.opportunity_enquiries to service_role;
  end if;
end $$;

-- ── cms_blocks (public read active slots only) ───────────────────────────────
do $$
begin
  if to_regclass('public.cms_blocks') is not null then
    alter table public.cms_blocks enable row level security;

    drop policy if exists cms_blocks_public_read on public.cms_blocks;
    create policy cms_blocks_public_read
      on public.cms_blocks
      for select
      to anon, authenticated
      using (active = true);

    revoke insert, update, delete on public.cms_blocks from anon, authenticated;
  end if;
end $$;

-- ── email templates & test recipients ────────────────────────────────────────
do $$
begin
  perform public._hub_harden_table_rls('public.email_templates');
  if to_regclass('public.email_templates') is not null then
    grant select, insert, update, delete on public.email_templates to service_role;
  end if;

  perform public._hub_harden_table_rls('public.email_test_recipients');
  if to_regclass('public.email_test_recipients') is not null then
    grant select, insert, update, delete on public.email_test_recipients to service_role;
  end if;
end $$;

-- ── admin ops & reports ────────────────────────────────────────────────────
do $$
begin
  perform public._hub_harden_table_rls('public.admin_event_health_log');
  if to_regclass('public.admin_event_health_log') is not null then
    grant select, insert, update, delete on public.admin_event_health_log to service_role;
  end if;

  perform public._hub_harden_table_rls('public.listing_reports');
  if to_regclass('public.listing_reports') is not null then
    grant select, insert, update, delete on public.listing_reports to service_role;
  end if;

  perform public._hub_harden_table_rls('public.review_reports');
  if to_regclass('public.review_reports') is not null then
    grant select, insert, update, delete on public.review_reports to service_role;
  end if;
end $$;

-- ── organiser ranking (cron/admin only) ──────────────────────────────────────
do $$
begin
  perform public._hub_harden_table_rls('public.organiser_ranking_snapshots');
  perform public._hub_harden_table_rls('public.organiser_ranking_entries');
  perform public._hub_harden_table_rls('public.organiser_ranking_emails');
end $$;

-- ── service-role-only tables that already had RLS but broad grants ───────────
-- admin_mfa_secrets deliberately excluded (dropped in 072_drop_admin_mfa.sql).
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'organiser_team_members',
    'event_favourites',
    'organiser_favourites',
    'organiser_favourite_listing_alerts',
    'event_ticket_sales_nudges',
    'organiser_claim_disputes',
    'organiser_accounts',
    'organiser_payouts',
    'event_cancellations'
  ]
  loop
    perform public._hub_harden_table_rls('public.' || tbl);
  end loop;
end $$;

drop function if exists public._hub_harden_table_rls(text);
drop function if exists public._hub_harden_table_rls(regclass);
