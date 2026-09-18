-- Connected booking: link TNH events to external ticketing providers (Eventbrite, Ticket Tailor, Luma, TryBooking).

create table if not exists public.connected_booking_provider_connections (
  id uuid primary key default gen_random_uuid(),
  organiser_account_id uuid not null references public.organiser_accounts(id) on delete cascade,
  provider text not null check (
    provider in ('eventbrite', 'ticket_tailor', 'luma', 'trybooking', 'custom')
  ),
  status text not null default 'pending' check (status in ('pending', 'active', 'disabled', 'error')),
  webhook_token text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organiser_account_id, provider)
);

comment on table public.connected_booking_provider_connections is
  'Per-account Connected booking provider setup (OAuth/API keys later; webhook_token for inbound URLs now).';

create table if not exists public.connected_booking_event_links (
  id uuid primary key default gen_random_uuid(),
  organiser_account_id uuid not null references public.organiser_accounts(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  provider text not null check (
    provider in ('eventbrite', 'ticket_tailor', 'luma', 'trybooking', 'custom')
  ),
  external_event_id text not null,
  external_event_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id),
  unique (provider, external_event_id)
);

comment on table public.connected_booking_event_links is
  'Maps a TNH Connected event to one external provider event/listing id for webhook routing.';

create index if not exists connected_booking_event_links_provider_ext_idx
  on public.connected_booking_event_links (provider, external_event_id);

grant select, insert, update, delete on public.connected_booking_provider_connections to service_role;
grant select, insert, update, delete on public.connected_booking_event_links to service_role;

alter table public.connected_booking_provider_connections enable row level security;
alter table public.connected_booking_event_links enable row level security;
