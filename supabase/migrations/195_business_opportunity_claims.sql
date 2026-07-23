-- First-login business opportunity claim / dispute flow (mirrors organiser group claims)

alter table public.business_opportunities
  add column if not exists ownership_claim_status text
    check (ownership_claim_status in ('pending', 'claimed', 'disputed')),
  add column if not exists ownership_claimed_at timestamptz,
  add column if not exists ownership_disputed_at timestamptz,
  add column if not exists ownership_disputed_by_email text;

comment on column public.business_opportunities.ownership_claim_status is
  'pending = awaiting first-login claim; claimed = owner confirmed; disputed = user said not theirs.';
comment on column public.business_opportunities.ownership_claimed_at is
  'When the lister confirmed ownership of a hub-seeded or pre-assigned listing.';
comment on column public.business_opportunities.ownership_disputed_at is
  'When a user rejected a suggested listing match.';
comment on column public.business_opportunities.ownership_disputed_by_email is
  'Email of the user who disputed ownership.';

create table if not exists public.opportunity_claim_disputes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  opportunity_id uuid references public.business_opportunities(id) on delete set null,
  opportunity_title text,
  profile_email text,
  reporter_email text not null,
  reporter_user_id uuid,
  status text not null default 'open' check (status in ('open', 'resolved')),
  notes text
);

create index if not exists idx_opportunity_claim_disputes_status_created
  on public.opportunity_claim_disputes(status, created_at desc);

comment on table public.opportunity_claim_disputes is
  'User reported that a pre-assigned business opportunity listing is not theirs — review in Command Centre.';

alter table public.opportunity_claim_disputes enable row level security;
