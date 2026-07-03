-- Manual advertising & sponsorship revenue logged in Command Centre → Revenue targets.

create table if not exists public.hub_revenue_deals (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  category text not null
    check (category in ('events', 'opportunities', 'newsletter', 'ticket_sales', 'browse_organisers', 'awards')),

  source_label text not null default '',
  amount_gbp numeric(10, 2) not null check (amount_gbp > 0),
  recorded_at timestamptz not null default now(),
  notes text not null default '',
  cms_slot text,
  created_by text not null default ''
);

create index if not exists hub_revenue_deals_category_recorded_idx
  on public.hub_revenue_deals (category, recorded_at desc);

comment on table public.hub_revenue_deals is
  'Manually logged Hub advertising revenue (sponsorship, newsletter ads, awards) for revenue target tracking.';

grant select, insert, update, delete on public.hub_revenue_deals to service_role;
