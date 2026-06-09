-- Canonical event cover image column (replaces photo_url for events).

alter table public.events
  add column if not exists image_url text;

update public.events
set image_url = photo_url
where coalesce(trim(image_url), '') = ''
  and coalesce(trim(photo_url), '') <> '';
