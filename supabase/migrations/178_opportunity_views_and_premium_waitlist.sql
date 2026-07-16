-- Business opportunity directory views (aggregate) + premium spotlight waitlist.

alter table public.business_opportunities
  add column if not exists view_count integer not null default 0;

comment on column public.business_opportunities.view_count is
  'Aggregate detail-page views for organiser ROI (incremented via public API).';

create table if not exists public.opportunity_premium_waitlist (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  supabase_user_id text,
  opportunity_id uuid references public.business_opportunities(id) on delete set null,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists opportunity_premium_waitlist_owner_email_key
  on public.opportunity_premium_waitlist (lower(owner_email))
  where notified_at is null;

create index if not exists opportunity_premium_waitlist_pending_idx
  on public.opportunity_premium_waitlist (created_at)
  where notified_at is null;

comment on table public.opportunity_premium_waitlist is
  'Organisers waiting for a premium spotlight slot — notified when capacity opens.';

alter table public.opportunity_premium_waitlist enable row level security;

revoke all on table public.opportunity_premium_waitlist from anon, authenticated;
grant select, insert, update, delete on public.opportunity_premium_waitlist to service_role;
