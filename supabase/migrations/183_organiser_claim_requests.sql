-- Public "request to claim this page" queue for unclaimed organiser profiles

create table if not exists public.organiser_claim_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organiser_id uuid references public.organisers(id) on delete set null,
  organiser_name text,
  profile_email text,
  claimant_name text not null,
  claimant_email text not null,
  claimant_role text,
  message text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_at timestamptz,
  admin_notes text
);

create index if not exists idx_organiser_claim_requests_status_created
  on public.organiser_claim_requests(status, created_at desc);

create index if not exists idx_organiser_claim_requests_organiser_open
  on public.organiser_claim_requests(organiser_id, claimant_email)
  where status = 'open';

comment on table public.organiser_claim_requests is
  'Someone asked to claim a public organiser profile — verify in Command Centre, update contact email, send claim invite.';

alter table public.organiser_claim_requests enable row level security;
