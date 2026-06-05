-- Attendee booking extras and public listing slug (separate from description text)

alter table public.events
  add column if not exists food_included boolean default false,
  add column if not exists collect_dietary boolean default false,
  add column if not exists collect_accessibility boolean default false,
  add column if not exists slug text;

create unique index if not exists events_slug_unique_idx
  on public.events(slug)
  where slug is not null and slug <> '';
