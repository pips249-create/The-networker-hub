-- Structured home base for members (networking region slug — city, county, or London area).

alter table public.attendees
  add column if not exists home_region_slug text;

comment on column public.attendees.home_region_slug is
  'Allow-listed networking region slug (e.g. manchester, cheshire, central-london) from signup onboarding.';

create index if not exists attendees_home_region_slug_idx
  on public.attendees (home_region_slug)
  where home_region_slug is not null;
