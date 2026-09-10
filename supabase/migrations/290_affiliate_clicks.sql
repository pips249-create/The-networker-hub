-- Partner programme: first-party referral link click log for Command Centre.
-- Counts only when someone lands with ?ref=CODE (not every cookie pageview).

create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.affiliate_partners (id) on delete cascade,
  code text not null,
  path text,
  landing_url text,
  created_at timestamptz not null default now()
);

create index if not exists affiliate_clicks_partner_created_idx
  on public.affiliate_clicks (partner_id, created_at desc);

create index if not exists affiliate_clicks_code_created_idx
  on public.affiliate_clicks (code, created_at desc);

comment on table public.affiliate_clicks is
  'Referral partner link landings (?ref=CODE). Used for Command Centre click counts.';

alter table public.affiliate_clicks enable row level security;

revoke all on table public.affiliate_clicks from anon, authenticated;
grant select, insert, update, delete on table public.affiliate_clicks to service_role;
