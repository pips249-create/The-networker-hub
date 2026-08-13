-- Organiser sales kit: pinned walkthrough demo group + shared "who we showed" log.

alter table public.organisers
  add column if not exists is_walkthrough_demo boolean not null default false;

comment on column public.organisers.is_walkthrough_demo is
  'True for the agreed Command Centre demo group used on organiser walkthroughs. At most one should be true.';

create unique index if not exists organisers_one_walkthrough_demo_idx
  on public.organisers (is_walkthrough_demo)
  where is_walkthrough_demo = true;

create table if not exists public.organiser_sales_demos (
  id uuid primary key default gen_random_uuid(),
  shown_at date not null default (timezone('utc', now()))::date,
  shown_by text not null
    check (shown_by in ('Catherine', 'Rosie', 'Jamie', 'Other')),
  organiser_name text not null,
  organiser_email text,
  organiser_id uuid references public.organisers(id) on delete set null,
  outcome text not null default 'follow_up'
    check (outcome in ('interested', 'listed', 'follow_up', 'not_now', 'other')),
  notes text,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organiser_sales_demos_shown_at_idx
  on public.organiser_sales_demos (shown_at desc, created_at desc);

create index if not exists organiser_sales_demos_shown_by_idx
  on public.organiser_sales_demos (shown_by, shown_at desc);

create index if not exists organiser_sales_demos_organiser_email_idx
  on public.organiser_sales_demos (lower(organiser_email), shown_at desc)
  where organiser_email is not null;

comment on table public.organiser_sales_demos is
  'Shared log of organiser walkthroughs / demos so Catherine, Rosie and Jamie avoid double-pitching.';

alter table public.organiser_sales_demos enable row level security;

revoke all on table public.organiser_sales_demos from anon, authenticated;
grant select, insert, update, delete on table public.organiser_sales_demos to service_role;
