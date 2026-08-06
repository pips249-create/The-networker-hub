-- First-party sales-pitch open log for Command Centre (confidential /p-tnh-* decks).
-- Written only via service role (public POST rate-limited); no user or IP stored.

create table if not exists public.pitch_page_views (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  path text not null default '',
  label text not null default '',
  action text not null default 'view',
  referrer_host text not null default ''
);

create index if not exists pitch_page_views_created_at_idx
  on public.pitch_page_views (created_at desc);

create index if not exists pitch_page_views_path_idx
  on public.pitch_page_views (path, created_at desc)
  where path <> '';

create index if not exists pitch_page_views_action_idx
  on public.pitch_page_views (action, created_at desc);

comment on table public.pitch_page_views is
  'Aggregatable opens of confidential sales pitch decks (/p-tnh-*). No user or IP stored.';

alter table public.pitch_page_views enable row level security;

revoke all on table public.pitch_page_views from anon, authenticated;
grant select, insert, delete on table public.pitch_page_views to service_role;
