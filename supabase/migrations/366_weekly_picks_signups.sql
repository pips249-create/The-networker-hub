-- Browse / city-page signup for TINA’s weekly networking picks (Friday digest).

create table if not exists public.weekly_picks_signups (
  id uuid primary key default uuid_generate_v4(),
  email text not null,
  location text not null default '',
  region_slug text not null default '',
  source text not null default 'browse_rail',
  created_at timestamptz not null default now(),
  constraint weekly_picks_signups_email_unique unique (email)
);

create index if not exists weekly_picks_signups_created_at_idx
  on public.weekly_picks_signups (created_at desc);

create index if not exists weekly_picks_signups_region_slug_idx
  on public.weekly_picks_signups (region_slug)
  where region_slug <> '';

comment on table public.weekly_picks_signups is
  'Email captures from the browse/city weekly-picks rail. Marketing opt-in implied by the form submit.';

alter table public.weekly_picks_signups enable row level security;

grant select, insert, update, delete on public.weekly_picks_signups to service_role;
