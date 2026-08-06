-- First-party sponsor / partner outbound click log for Command Centre monthly packs.
-- Written only via service role (public POST rate-limited); no user or IP stored.

create table if not exists public.sponsor_clicks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  placement text not null default 'sponsor',
  company_name text not null default '',
  destination_url text not null default '',
  path text not null default ''
);

create index if not exists sponsor_clicks_created_at_idx
  on public.sponsor_clicks (created_at desc);

create index if not exists sponsor_clicks_company_idx
  on public.sponsor_clicks (company_name, created_at desc)
  where company_name <> '';

create index if not exists sponsor_clicks_placement_idx
  on public.sponsor_clicks (placement, created_at desc);

comment on table public.sponsor_clicks is
  'Aggregatable sponsor/partner outbound clicks for monthly reporting. No user or IP stored.';

alter table public.sponsor_clicks enable row level security;

revoke all on table public.sponsor_clicks from anon, authenticated;
grant select, insert, delete on table public.sponsor_clicks to service_role;
