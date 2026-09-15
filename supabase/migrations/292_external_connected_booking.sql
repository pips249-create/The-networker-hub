-- Connected external booking: organiser checkout on their site, registrations via webhook.

alter table public.organiser_accounts
  add column if not exists connected_booking_plan text
    check (
      connected_booking_plan is null
      or connected_booking_plan in ('starter', 'growth', 'scale', 'enterprise')
    ),
  add column if not exists connected_booking_status text not null default 'inactive'
    check (connected_booking_status in ('inactive', 'active', 'past_due', 'cancelled')),
  add column if not exists connected_booking_stripe_subscription_id text,
  add column if not exists connected_booking_webhook_secret text;

comment on column public.organiser_accounts.connected_booking_plan is
  'starter=1 group, growth=5, scale=20, enterprise=unlimited (POA)';

alter table public.events
  add column if not exists checkout_mode text not null default 'hub'
    check (checkout_mode in ('hub', 'external_connected')),
  add column if not exists external_booking_url text,
  add column if not exists external_price_label text;

alter table public.registrations
  add column if not exists booking_source text not null default 'hub'
    check (booking_source in ('hub', 'external')),
  add column if not exists external_order_id text;

create unique index if not exists registrations_external_order_per_event_idx
  on public.registrations (event_id, external_order_id)
  where external_order_id is not null and external_order_id <> '';

create table if not exists public.external_booking_sync_log (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  organiser_account_id uuid references public.organiser_accounts(id) on delete set null,
  organiser_id uuid references public.organisers(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  external_order_id text,
  outcome text not null check (outcome in ('accepted', 'duplicate', 'rejected', 'error')),
  http_status integer,
  message text,
  payload jsonb
);

create index if not exists external_booking_sync_log_account_created_idx
  on public.external_booking_sync_log (organiser_account_id, created_at desc);

grant select, insert, update, delete on public.external_booking_sync_log to service_role;
alter table public.external_booking_sync_log enable row level security;
