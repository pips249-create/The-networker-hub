-- Extra Attendee round-up / Who’s going send credits (Hub platform Checkout).
-- Free: 1 send per organiser page (lifetime). Paid extras roll over until used.

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

alter table public.event_connections_sends
  add column if not exists used_extra_credit boolean not null default false;

comment on column public.event_connections_sends.used_extra_credit is
  'True when this send redeemed a paid connections_extra_credits balance.';
