-- Optional contact name on international intake; optional local start time + photo on link-out events.

alter table public.international_event_listings
  alter column contact_name drop not null;

alter table public.international_event_listings
  add column if not exists starts_at_local time,
  add column if not exists image_url text;

comment on column public.international_event_listings.starts_at_local is
  'Optional local wall-clock start time for the event city (no timezone stored).';

comment on column public.international_event_listings.image_url is
  'Optional public image URL for browse cards (https).';

alter table public.international_group_intake
  alter column contact_name drop not null;
