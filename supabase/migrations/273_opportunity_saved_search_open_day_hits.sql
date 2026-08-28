-- Dedupe saved-search emails when a listing gets a new open day.

create table if not exists public.opportunity_saved_search_open_day_hits (
  search_id      uuid not null references public.opportunity_saved_searches(id) on delete cascade,
  open_day_id    uuid not null references public.opportunity_open_days(id) on delete cascade,
  notified_at    timestamptz not null default now(),
  primary key (search_id, open_day_id)
);

create index if not exists opportunity_saved_search_open_day_hits_open_day_idx
  on public.opportunity_saved_search_open_day_hits (open_day_id);

alter table public.opportunity_saved_search_open_day_hits enable row level security;

grant select, insert, update, delete on public.opportunity_saved_search_open_day_hits to service_role;
