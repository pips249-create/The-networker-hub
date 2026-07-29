-- First-party Promote / LinkedIn share action log (no cookie consent required).
-- Organiser tool usage + UTM landing clicks for ROI.

create table if not exists public.organiser_promote_actions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  action text not null
    check (action in (
      'download',
      'copy_caption',
      'open_linkedin',
      'landing'
    )),
  source text not null default 'post_builder'
    check (char_length(source) <= 64),
  organiser_account_id uuid,
  organiser_id uuid,
  event_id uuid,
  template_id text,
  actor_email text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists organiser_promote_actions_created_idx
  on public.organiser_promote_actions (created_at desc);

create index if not exists organiser_promote_actions_action_created_idx
  on public.organiser_promote_actions (action, created_at desc);

create index if not exists organiser_promote_actions_organiser_idx
  on public.organiser_promote_actions (organiser_id, created_at desc)
  where organiser_id is not null;

create index if not exists organiser_promote_actions_event_idx
  on public.organiser_promote_actions (event_id, created_at desc)
  where event_id is not null;

comment on table public.organiser_promote_actions is
  'Authenticated Promote/LinkedIn tool usage and public UTM landing hits for organiser share ROI.';

alter table public.organiser_promote_actions enable row level security;

revoke all on table public.organiser_promote_actions from anon, authenticated;
grant select, insert on table public.organiser_promote_actions to service_role;
