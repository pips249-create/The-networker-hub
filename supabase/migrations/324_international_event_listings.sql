-- Link-out event submissions for The Networker International (moderated directory).

create table if not exists public.international_event_listings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_on date not null,
  ends_on date,
  city text not null,
  country_code text not null,
  country_name text not null,
  description text,
  external_url text not null,
  price_label text,
  contact_name text not null,
  email text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'spam')),
  source text not null default 'international_map',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text
);

create index if not exists international_event_listings_status_starts_idx
  on public.international_event_listings (status, starts_on asc);

create index if not exists international_event_listings_country_status_idx
  on public.international_event_listings (country_code, status, starts_on asc);

create index if not exists international_event_listings_created_at_idx
  on public.international_event_listings (created_at desc);

create index if not exists international_event_listings_email_idx
  on public.international_event_listings (lower(email));

comment on table public.international_event_listings is
  'Worldwide link-out networking events submitted on thenetworkerinternational.com; staff approve before public browse.';

alter table public.international_event_listings enable row level security;

revoke all on table public.international_event_listings from anon, authenticated;
grant select, insert, update, delete on table public.international_event_listings to service_role;
