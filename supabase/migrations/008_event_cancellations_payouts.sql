-- Event cancellations and organiser payouts
-- Run before 009_payout_breakdown.sql

alter table public.events
  add column if not exists payout_held boolean default false;

-- Required by organiser_payouts.organiser_account_id (created in app code if missing)
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
  requested_at          timestamptz default now()
);

create index if not exists organiser_payouts_event_id_idx
  on public.organiser_payouts(event_id);

-- Hold payout when an event is cancelled with active ticket sales
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

-- Server-only tables: RLS on, no anon/authenticated policies (API uses service_role)
alter table public.organiser_accounts enable row level security;
alter table public.event_cancellations enable row level security;
alter table public.organiser_payouts enable row level security;
