-- First-login group profile claim / dispute flow

alter table public.organisers
  add column if not exists ownership_claim_status text
    check (ownership_claim_status in ('pending', 'claimed', 'disputed')),
  add column if not exists ownership_claimed_at timestamptz,
  add column if not exists ownership_disputed_at timestamptz,
  add column if not exists ownership_disputed_by_email text;

comment on column public.organisers.ownership_claim_status is
  'pending = awaiting first-login claim; claimed = owner confirmed; disputed = user said not theirs.';
comment on column public.organisers.ownership_claimed_at is 'When the organiser confirmed profile ownership.';
comment on column public.organisers.ownership_disputed_at is 'When a user rejected a suggested profile match.';
comment on column public.organisers.ownership_disputed_by_email is 'Email of the user who disputed ownership.';

-- All existing profiles require an explicit claim on first dashboard visit
update public.organisers
set ownership_claim_status = 'pending'
where ownership_claim_status is null
  and coalesce(nullif(trim(email), ''), nullif(trim(contact_email), '')) is not null;

update public.organisers
set ownership_claim_status = 'pending'
where ownership_claim_status is null
  and supabase_user_id is not null;

create table if not exists public.organiser_claim_disputes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organiser_id uuid references public.organisers(id) on delete set null,
  organiser_name text,
  profile_email text,
  reporter_email text not null,
  reporter_user_id uuid,
  status text not null default 'open' check (status in ('open', 'resolved')),
  notes text
);

create index if not exists idx_organiser_claim_disputes_status_created
  on public.organiser_claim_disputes(status, created_at desc);

comment on table public.organiser_claim_disputes is
  'User reported that a pre-imported group profile is not theirs — review in Command Centre.';

alter table public.organiser_claim_disputes enable row level security;
