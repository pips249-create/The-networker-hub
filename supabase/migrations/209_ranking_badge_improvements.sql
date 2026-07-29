-- Ranking improvements: shout-out preference, badge embed analytics, email CTA A/B

alter table public.organisers
  add column if not exists ranking_shoutout_opt_in boolean not null default true;

comment on column public.organisers.ranking_shoutout_opt_in is
  'When true, group may be named on the public Top groups list and Hub LinkedIn shout-outs. Opt out anytime.';

alter table public.organiser_ranking_emails
  add column if not exists primary_cta text;

alter table public.organiser_ranking_emails
  drop constraint if exists organiser_ranking_emails_primary_cta_check;

alter table public.organiser_ranking_emails
  add constraint organiser_ranking_emails_primary_cta_check
  check (primary_cta is null or primary_cta in ('badge', 'rankings'));

comment on column public.organiser_ranking_emails.primary_cta is
  'A/B primary CTA on ranking badge email: badge share page vs Top groups list.';

create table if not exists public.ranking_badge_impressions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tier text not null check (tier in ('top10', 'top25', 'top50')),
  period_label text not null default '',
  organiser_id uuid references public.organisers(id) on delete set null,
  format text not null default 'svg' check (format in ('svg', 'png')),
  referrer text,
  user_agent text
);

create index if not exists idx_ranking_badge_impressions_created
  on public.ranking_badge_impressions (created_at desc);

create index if not exists idx_ranking_badge_impressions_organiser
  on public.ranking_badge_impressions (organiser_id, created_at desc);

create index if not exists idx_ranking_badge_impressions_tier_period
  on public.ranking_badge_impressions (tier, period_label);

grant select, insert, update, delete on table public.ranking_badge_impressions to service_role;

comment on table public.ranking_badge_impressions is
  'Counts loads of /api/ranking-badge embeds (website award plaques).';
