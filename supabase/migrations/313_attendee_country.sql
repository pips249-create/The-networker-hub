-- Member country, separate from the free-text city or postcode.
-- GB (the default) keeps Near Me and nearby emails on UK location matching.
-- Any other ISO code is stored and must not be geocoded as a UK place.

alter table public.attendees
  add column if not exists country_code text not null default 'GB';

comment on column public.attendees.country_code is
  'ISO 3166-1 alpha-2. GB uses location for Near Me and nearby emails. Other countries are stored and skip UK matching.';
