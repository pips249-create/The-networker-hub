-- Backfill organiser payout tables if 008/009 were skipped on this project.
-- Safe to run on databases that already have these tables.

alter table public.events
  add column if not exists payout_held boolean default false;

create table if not exists public.organiser_accounts (
  id               uuid primary key default uuid_generate_v4(),
  created_at       timestamptz default now(),
  email            text unique,
  supabase_user_id uuid references auth.users(id) on delete set null
);

create table if not exists public.event_cancellations (
  id                      uuid primary key default uuid_generate_v4(),
  created_at              timestamptz default now(),
  event_id                uuid not null references public.events(id) on delete cascade,
  reason                  text not null,
  details                 text,
  refund_terms_confirmed  boolean not null default false,
  refunds_confirmed_at    timestamptz,
  cancelled_by            uuid references auth.users(id) on delete set null
);

create index if not exists event_cancellations_event_id_idx
  on public.event_cancellations(event_id);

create table if not exists public.organiser_payouts (
  id                    uuid primary key default uuid_generate_v4(),
  created_at            timestamptz default now(),
  event_id              uuid not null references public.events(id) on delete cascade,
  organiser_account_id  uuid references public.organiser_accounts(id) on delete set null,
  status                text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'paid', 'held')),
  amount                numeric(10,2),
  amount_gross          numeric(10,2),
  stripe_fee            numeric(10,2),
  platform_fee          numeric(10,2),
  amount_net            numeric(10,2),
  total_transactions    integer,
  requested_at          timestamptz default now()
);

alter table public.organiser_payouts
  add column if not exists amount_gross numeric(10,2),
  add column if not exists stripe_fee numeric(10,2),
  add column if not exists platform_fee numeric(10,2),
  add column if not exists amount_net numeric(10,2),
  add column if not exists total_transactions integer;

create index if not exists organiser_payouts_event_id_idx
  on public.organiser_payouts(event_id);

comment on column public.organiser_payouts.amount_net is
  'Net payout to organiser after Stripe and platform fees';

create or replace function public.hold_payout_on_event_cancellation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.events
  set payout_held = true
  where id = new.event_id;
  return new;
end;
$$;

drop trigger if exists trg_hold_payout_on_cancellation on public.event_cancellations;
create trigger trg_hold_payout_on_cancellation
  after insert on public.event_cancellations
  for each row
  execute function public.hold_payout_on_event_cancellation();

grant select, insert, update, delete on public.organiser_accounts to service_role;
grant select, insert, update, delete on public.event_cancellations to service_role;
grant select, insert, update, delete on public.organiser_payouts to service_role;

alter table public.organiser_accounts enable row level security;
alter table public.event_cancellations enable row level security;
alter table public.organiser_payouts enable row level security;
