-- Explicit RLS for service-role-only tables that were previously hardened only via
-- dynamic SQL in 114_rls_hardening.sql. Scanners look for literal ENABLE ROW LEVEL
-- SECURITY / CREATE POLICY text; keep this migration idempotent and safe to re-run.
-- No policies on purpose: with RLS on + grants revoked from anon/authenticated,
-- only service_role (which bypasses RLS) can access these tables.

alter table if exists public.email_templates enable row level security;
alter table if exists public.email_test_recipients enable row level security;
alter table if exists public.admin_event_health_log enable row level security;
alter table if exists public.listing_reports enable row level security;
alter table if exists public.review_reports enable row level security;
alter table if exists public.opportunity_enquiries enable row level security;
alter table if exists public.organiser_ranking_snapshots enable row level security;
alter table if exists public.organiser_ranking_entries enable row level security;
alter table if exists public.organiser_ranking_emails enable row level security;
alter table if exists public.ranking_badge_impressions enable row level security;

revoke all on table public.email_templates from anon, authenticated;
revoke all on table public.email_test_recipients from anon, authenticated;
revoke all on table public.admin_event_health_log from anon, authenticated;
revoke all on table public.listing_reports from anon, authenticated;
revoke all on table public.review_reports from anon, authenticated;
revoke all on table public.opportunity_enquiries from anon, authenticated;
revoke all on table public.organiser_ranking_snapshots from anon, authenticated;
revoke all on table public.organiser_ranking_entries from anon, authenticated;
revoke all on table public.organiser_ranking_emails from anon, authenticated;
revoke all on table public.ranking_badge_impressions from anon, authenticated;

grant select, insert, update, delete on public.email_templates to service_role;
grant select, insert, update, delete on public.email_test_recipients to service_role;
grant select, insert, update, delete on public.admin_event_health_log to service_role;
grant select, insert, update, delete on public.listing_reports to service_role;
grant select, insert, update, delete on public.review_reports to service_role;
grant select, insert, update, delete on public.opportunity_enquiries to service_role;
grant select, insert, update, delete on public.organiser_ranking_snapshots to service_role;
grant select, insert, update, delete on public.organiser_ranking_entries to service_role;
grant select, insert, update, delete on public.organiser_ranking_emails to service_role;
grant select, insert, update, delete on public.ranking_badge_impressions to service_role;
