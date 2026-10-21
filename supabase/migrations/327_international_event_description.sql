-- Optional short description for international link-out event listings.

alter table public.international_event_listings
  add column if not exists description text;

comment on column public.international_event_listings.description is
  'Optional short blurb shown on International browse cards.';
