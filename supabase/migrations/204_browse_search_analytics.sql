-- Anonymous events-browse search/filter telemetry for Command Centre Demand insights.
-- Written only via service role (public POST rate-limited); no personal identifiers stored.

create table if not exists public.browse_search_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null default 'events_browse',
  query_text text not null default '',
  location_text text not null default '',
  filters jsonb not null default '{}'::jsonb,
  result_count integer not null default 0,
  zero_results boolean not null default false
);

create index if not exists browse_search_events_created_at_idx
  on public.browse_search_events (created_at desc);

create index if not exists browse_search_events_query_idx
  on public.browse_search_events (query_text, created_at desc)
  where query_text <> '';

create index if not exists browse_search_events_location_idx
  on public.browse_search_events (location_text, created_at desc)
  where location_text <> '';

create index if not exists browse_search_events_zero_idx
  on public.browse_search_events (created_at desc)
  where zero_results = true;

comment on table public.browse_search_events is
  'Aggregatable events-browse search and filter usage (consent-gated client posts). No user or IP stored.';

alter table public.browse_search_events enable row level security;

revoke all on table public.browse_search_events from anon, authenticated;
grant select, insert, delete on table public.browse_search_events to service_role;
