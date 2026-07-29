-- Platform-hosted monthly/annual membership billing via Stripe Connect.
-- Members pay membership price + Hub fee (4.5% + 20p); organisers receive 100% of the price they set.

create table if not exists public.organiser_membership_plans (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organiser_id uuid not null references public.organisers(id) on delete cascade,
  monthly_amount_pence integer
    check (monthly_amount_pence is null or monthly_amount_pence >= 100),
  annual_amount_pence integer
    check (annual_amount_pence is null or annual_amount_pence >= 100),
  active boolean not null default true,
  constraint organiser_membership_plans_has_price check (
    monthly_amount_pence is not null or annual_amount_pence is not null
  )
);

create unique index if not exists organiser_membership_plans_organiser_unique
  on public.organiser_membership_plans (organiser_id);

comment on table public.organiser_membership_plans is
  'Per organiser page: optional monthly/annual membership prices charged through Hub Stripe Connect.';

alter table public.organiser_member_roster
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_customer_id text,
  add column if not exists billing_interval text
    check (billing_interval is null or billing_interval in ('month', 'year')),
  add column if not exists subscription_status text,
  add column if not exists membership_amount_pence integer;

create index if not exists organiser_member_roster_stripe_sub_idx
  on public.organiser_member_roster (stripe_subscription_id)
  where stripe_subscription_id is not null;

comment on column public.organiser_member_roster.stripe_subscription_id is
  'Stripe subscription id when membership dues are paid through the Hub.';
comment on column public.organiser_member_roster.billing_interval is
  'month or year when billed through Hub; null for manually managed roster rows.';

grant select, insert, update, delete on public.organiser_membership_plans to service_role;
alter table public.organiser_membership_plans enable row level security;
