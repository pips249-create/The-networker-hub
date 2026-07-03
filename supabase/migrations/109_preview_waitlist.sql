-- Early-access waitlist from the pre-launch site-access page.

create table if not exists public.preview_waitlist (
  id uuid primary key default uuid_generate_v4(),
  email text not null,
  created_at timestamptz not null default now(),
  source text not null default 'site_access',
  constraint preview_waitlist_email_unique unique (email)
);

create index if not exists preview_waitlist_created_at_idx
  on public.preview_waitlist (created_at desc);

comment on table public.preview_waitlist is
  'Emails collected on the pre-launch site-access page for early preview access.';

alter table public.preview_waitlist enable row level security;

grant select, insert, update, delete on public.preview_waitlist to service_role;
