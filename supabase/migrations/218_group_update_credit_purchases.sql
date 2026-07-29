-- Ledger for Stripe purchases of extra monthly group-update send credits.

create table if not exists public.organiser_group_update_credit_purchases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  stripe_checkout_session_id text not null,
  organiser_id uuid not null references public.organisers(id) on delete cascade,
  credits integer not null check (credits > 0),
  amount_pence integer not null default 0,
  pack_id text not null default ''
);

create unique index if not exists organiser_group_update_credit_purchases_session_uniq
  on public.organiser_group_update_credit_purchases (stripe_checkout_session_id);

create index if not exists idx_ogu_credit_purchases_organiser
  on public.organiser_group_update_credit_purchases (organiser_id, created_at desc);

alter table public.organiser_group_update_credit_purchases enable row level security;

grant select, insert on public.organiser_group_update_credit_purchases to service_role;
