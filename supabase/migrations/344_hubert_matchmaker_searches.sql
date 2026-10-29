-- Hubert Matchmaker: log member searches for the 3 / week soft cap (admins higher).
-- Spec: docs/HUBERT-MATCHMAKER-SPEC.md — Search quota (members) = 3 searches / week.

create table if not exists public.hubert_matchmaker_searches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  attendee_id uuid not null references public.attendees (id) on delete cascade,
  user_id uuid,
  query text not null,
  match_count integer not null default 0
    check (match_count >= 0)
);

create index if not exists hubert_matchmaker_searches_attendee_week_idx
  on public.hubert_matchmaker_searches (attendee_id, created_at desc);

comment on table public.hubert_matchmaker_searches is
  'Hubert Matchmaker search runs for weekly member quota (3 / week). Not a browse log for admins.';

alter table public.hubert_matchmaker_searches enable row level security;

notify pgrst, 'reload schema';
