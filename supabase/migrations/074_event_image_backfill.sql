-- Recreate published_events so new columns (e.g. image_url) are exposed to browse API.
drop view if exists public.published_events cascade;

create view public.published_events as
select
  e.*,
  e.starts_at as next_date
from public.events e
left join public.organisers o on o.id = e.organiser_id
where e.approval_status = 'Approved'
  and e.status = 'published'
  and (
    e.organiser_id is null
    or o.listing_status is null
    or o.listing_status not in ('draft', 'unpublished')
  );

grant select on public.published_events to anon, authenticated, service_role;

-- Backfill missing event cover images from group logos; unwrap Eventbrite proxy URLs.

update public.events e
set image_url = o.photo_url
from public.organisers o
where e.organiser_id = o.id
  and coalesce(trim(e.image_url), '') = ''
  and coalesce(trim(o.photo_url), '') <> '';

-- Eventbrite / Next.js image proxy → cdn.evbuc.com (regex unwrap)
update public.events
set image_url = substring(
  image_url
  from 'https://cdn\.evbuc\.com/[^[:space:]"'']+'
)
where image_url like '%eventbrite%/_next/image%'
   or image_url like '%img.evbuc.com/https%';
