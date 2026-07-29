-- Repair: ensure monthly group-update tables exist (safe to re-run).
-- Fixes: Could not find the table 'public.organiser_group_updates' in the schema cache

alter table public.organisers
  add column if not exists group_update_extra_credits integer not null default 0;

create table if not exists public.organiser_group_updates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organiser_id uuid not null references public.organisers(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'queued', 'sending', 'sent', 'failed', 'cancelled')),
  period_key text not null default '',
  subject text not null default '',
  content jsonb not null default '{}'::jsonb,
  audience text not null default 'hub_attendees'
    check (audience in ('hub_attendees', 'roster', 'both')),
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  used_free_allowance boolean not null default false,
  used_extra_credit boolean not null default false,
  queued_at timestamptz,
  sent_at timestamptz,
  last_error text
);

create index if not exists idx_organiser_group_updates_organiser
  on public.organiser_group_updates (organiser_id, created_at desc);

create index if not exists idx_organiser_group_updates_period
  on public.organiser_group_updates (organiser_id, period_key, status);

create table if not exists public.organiser_group_update_queue (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz,
  last_error text,
  update_id uuid not null references public.organiser_group_updates(id) on delete cascade,
  organiser_id uuid not null references public.organisers(id) on delete cascade,
  email text not null,
  recipient_name text not null default ''
);

create unique index if not exists organiser_group_update_queue_pending_uniq
  on public.organiser_group_update_queue (update_id, lower(email))
  where sent_at is null and failed_at is null;

create index if not exists idx_organiser_group_update_queue_due
  on public.organiser_group_update_queue (scheduled_for)
  where sent_at is null and failed_at is null;

alter table public.organiser_group_updates enable row level security;
alter table public.organiser_group_update_queue enable row level security;

grant select, insert, update, delete on public.organiser_group_updates to service_role;
grant select, insert, update, delete on public.organiser_group_update_queue to service_role;

notify pgrst, 'reload schema';
