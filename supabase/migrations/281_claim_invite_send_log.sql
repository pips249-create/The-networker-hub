-- Log opportunity/franchise/affiliate claim-invite sends for 24h rate limiting.

create table if not exists public.claim_invite_send_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null,
  slug text not null,
  opportunity_id uuid,
  resend_id text,
  source text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists claim_invite_send_log_email_slug_created_idx
  on public.claim_invite_send_log (email, slug, created_at desc);

comment on table public.claim_invite_send_log is
  'Claim invite email sends — used to allow at most one of each template per recipient email per 24 hours.';

alter table public.claim_invite_send_log enable row level security;

revoke all on table public.claim_invite_send_log from anon, authenticated;
grant select, insert on table public.claim_invite_send_log to service_role;
