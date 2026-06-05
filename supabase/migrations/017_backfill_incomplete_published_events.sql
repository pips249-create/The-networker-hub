-- Backfill approved listings that were seeded without dates, organiser, or type metadata.

update public.events
set event_type = 'Networking meeting'
where approval_status = 'Approved'
  and coalesce(trim(event_type), '') = '';

update public.events
set meeting_type = case
  when coalesce(trim(meeting_link), '') <> '' then 'Online'
  when coalesce(trim(venue), '') <> ''
    or coalesce(trim(postcode), '') <> ''
    or coalesce(trim(city), '') <> '' then 'In person'
  else 'In person'
end
where approval_status = 'Approved'
  and coalesce(trim(meeting_type), '') = '';

with default_org as (
  select id
  from public.organisers
  where listing_status = 'published'
  order by
    case when coalesce(trim(photo_url), '') <> '' then 0 else 1 end,
    created_at
  limit 1
)
update public.events e
set organiser_id = default_org.id
from default_org
where e.approval_status = 'Approved'
  and e.organiser_id is null;

with dated as (
  select
    id,
    row_number() over (order by title, id) as rn
  from public.events
  where approval_status = 'Approved'
    and starts_at is null
)
update public.events e
set
  starts_at = (
    date_trunc('day', now() at time zone 'Europe/London')
    + ((dated.rn + 10) || ' days')::interval
    + interval '18 hours 30 minutes'
  ) at time zone 'Europe/London',
  ends_at = (
    date_trunc('day', now() at time zone 'Europe/London')
    + ((dated.rn + 10) || ' days')::interval
    + interval '21 hours'
  ) at time zone 'Europe/London'
from dated
where e.id = dated.id;

update public.events e
set vat_treatment = 'included'
where e.approval_status = 'Approved'
  and e.vat_treatment is null
  and exists (
    select 1
    from public.tickets t
    where t.event_id = e.id
      and coalesce(t.price, 0) > 0
  );
