-- Align international_event_listings with organiser identity columns.
--
-- Early production may still have the first 324 shape (description / price_label)
-- because that migration file was later rewritten in-repo to use organiser_name /
-- organiser_website. CREATE TABLE IF NOT EXISTS does not add those columns when
-- the table already exists, which surfaces as:
--   column international_event_listings.organiser_name does not exist

alter table public.international_event_listings
  add column if not exists organiser_name text,
  add column if not exists organiser_website text,
  add column if not exists starts_at_local time,
  add column if not exists image_url text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'international_event_listings'
      and column_name = 'description'
  ) then
    update public.international_event_listings
    set organiser_name = coalesce(
      nullif(btrim(organiser_name), ''),
      nullif(btrim(description), ''),
      'Organiser'
    )
    where organiser_name is null or btrim(organiser_name) = '';
  else
    update public.international_event_listings
    set organiser_name = coalesce(nullif(btrim(organiser_name), ''), 'Organiser')
    where organiser_name is null or btrim(organiser_name) = '';
  end if;
end $$;

alter table public.international_event_listings
  alter column organiser_name set not null;

-- Match 325 (optional contact name) for DBs that never applied it.
alter table public.international_event_listings
  alter column contact_name drop not null;

alter table public.international_event_listings
  drop column if exists description,
  drop column if exists price_label;

comment on column public.international_event_listings.organiser_name is
  'Organiser or group name shown on International link-out cards.';

comment on column public.international_event_listings.organiser_website is
  'Optional organiser / group website URL.';
