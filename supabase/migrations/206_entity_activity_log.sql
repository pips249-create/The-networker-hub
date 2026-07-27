-- Append-only activity log for organiser profiles, events, and team access.
-- Used to show who changed what when an owner disputes Hub edits.

create table if not exists public.entity_activity_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid,
  actor_email text,
  actor_role text not null default 'unknown'
    check (actor_role in ('owner', 'team', 'admin', 'system', 'unknown')),
  entity_type text not null
    check (entity_type in ('organiser', 'event', 'team_member')),
  entity_id uuid not null,
  organiser_id uuid,
  action text not null,
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists entity_activity_log_entity_idx
  on public.entity_activity_log (entity_type, entity_id, created_at desc);

create index if not exists entity_activity_log_organiser_idx
  on public.entity_activity_log (organiser_id, created_at desc)
  where organiser_id is not null;

create index if not exists entity_activity_log_created_at_idx
  on public.entity_activity_log (created_at desc);

comment on table public.entity_activity_log is
  'Who changed organiser profiles, events, or team access — for support disputes and admin cleanup Activity.';

alter table public.entity_activity_log enable row level security;

revoke all on table public.entity_activity_log from anon, authenticated;
grant select, insert on table public.entity_activity_log to service_role;
