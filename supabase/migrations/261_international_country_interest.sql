-- International expansion interest — lightweight waitlist per country.

create table if not exists public.international_country_interest (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  country_code text not null,
  country_name text not null,
  intent text not null check (intent in ('attend', 'list')),
  source text not null default 'international_map',
  created_at timestamptz not null default now()
);

create unique index if not exists international_country_interest_email_country_intent_key
  on public.international_country_interest (lower(email), country_code, intent);

create index if not exists international_country_interest_country_created_idx
  on public.international_country_interest (country_code, created_at desc);

comment on table public.international_country_interest is
  'Expansion waitlist from thenetworkerinternational.com — attend vs list intent per country.';

alter table public.international_country_interest enable row level security;

revoke all on table public.international_country_interest from anon, authenticated;
grant select, insert, update, delete on table public.international_country_interest to service_role;
