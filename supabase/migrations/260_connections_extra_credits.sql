-- Extra Attendee round-up / Who’s going send credits (Hub platform Checkout).
-- Free: 1 send per organiser page (lifetime). Paid extras roll over until used.
-- Also ensures event_connections_* tracking tables exist (originally migration 228).

alter table public.organisers
  add column if not exists connections_extra_credits integer not null default 0;

comment on column public.organisers.connections_extra_credits is
  'Purchased extra Attendee round-up / Who’s going sends. Consumed after the free page allowance.';

create table if not exists public.organiser_connections_credit_purchases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  stripe_checkout_session_id text not null,
  organiser_id uuid not null references public.organisers(id) on delete cascade,
  credits integer not null check (credits > 0),
  amount_pence integer not null default 0,
  pack_id text not null default ''
);

create unique index if not exists organiser_connections_credit_purchases_session_uniq
  on public.organiser_connections_credit_purchases (stripe_checkout_session_id);

create index if not exists idx_connections_credit_purchases_organiser
  on public.organiser_connections_credit_purchases (organiser_id, created_at desc);

alter table public.organiser_connections_credit_purchases enable row level security;

grant select, insert on public.organiser_connections_credit_purchases to service_role;

-- Tracking tables (from 228) — create if this environment never ran that migration.
create table if not exists public.event_connections_sends (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid not null references public.events(id) on delete cascade,
  organiser_id uuid not null references public.organisers(id) on delete cascade,
  list_kind text not null default 'attended',
  subject text,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0
);

create index if not exists idx_event_connections_sends_organiser
  on public.event_connections_sends (organiser_id, created_at desc);

create index if not exists idx_event_connections_sends_event
  on public.event_connections_sends (event_id, created_at desc);

create table if not exists public.event_connections_recipients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  send_id uuid not null references public.event_connections_sends(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  organiser_id uuid not null references public.organisers(id) on delete cascade,
  email text not null,
  tracking_token uuid,
  sent_at timestamptz,
  opened_at timestamptz,
  open_count integer not null default 0,
  clicked_at timestamptz,
  click_count integer not null default 0
);

create unique index if not exists event_connections_recipients_tracking_token_uniq
  on public.event_connections_recipients (tracking_token)
  where tracking_token is not null;

create index if not exists idx_event_connections_recipients_send
  on public.event_connections_recipients (send_id);

create index if not exists idx_event_connections_recipients_organiser
  on public.event_connections_recipients (organiser_id, created_at desc);

alter table public.event_connections_sends enable row level security;
alter table public.event_connections_recipients enable row level security;

grant select, insert, update on public.event_connections_sends to service_role;
grant select, insert, update on public.event_connections_recipients to service_role;

comment on table public.event_connections_sends is
  'One row per Attendee round-up / Who’s going send batch.';
comment on table public.event_connections_recipients is
  'Per-recipient delivery + open/click tracking for event connections emails.';

alter table public.event_connections_sends
  add column if not exists used_extra_credit boolean not null default false;

comment on column public.event_connections_sends.used_extra_credit is
  'True when this send redeemed a paid connections_extra_credits balance.';
