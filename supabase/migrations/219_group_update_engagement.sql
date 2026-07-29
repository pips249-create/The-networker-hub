-- Engagement tracking + smarter audience support for monthly group updates.

alter table public.organiser_group_update_queue
  add column if not exists tracking_token uuid,
  add column if not exists resend_email_id text,
  add column if not exists opened_at timestamptz,
  add column if not exists open_count integer not null default 0,
  add column if not exists clicked_at timestamptz,
  add column if not exists click_count integer not null default 0;

create unique index if not exists organiser_group_update_queue_tracking_token_uniq
  on public.organiser_group_update_queue (tracking_token)
  where tracking_token is not null;

create index if not exists idx_ogu_queue_resend_email_id
  on public.organiser_group_update_queue (resend_email_id)
  where resend_email_id is not null;

create table if not exists public.organiser_group_update_link_clicks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  update_id uuid not null references public.organiser_group_updates(id) on delete cascade,
  url text not null,
  click_count integer not null default 0,
  unique (update_id, url)
);

create index if not exists idx_ogu_link_clicks_update
  on public.organiser_group_update_link_clicks (update_id);

alter table public.organiser_group_update_link_clicks enable row level security;

grant select, insert, update on public.organiser_group_update_link_clicks to service_role;
grant select, update on public.organiser_group_update_queue to service_role;
