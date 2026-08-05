-- Admin / paid organiser spotlight placements can expire.
alter table public.organisers
  add column if not exists featured_until timestamptz;

comment on column public.organisers.featured_until is
  'When featured organiser spotlight ends; null means no expiry (until removed).';

create index if not exists idx_organisers_featured_until
  on public.organisers(featured_until)
  where featured = true and featured_until is not null;
