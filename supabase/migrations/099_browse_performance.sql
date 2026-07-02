-- Browse performance: materialized min_ticket_price, geo indexes, faster browse view.

alter table public.events
  add column if not exists min_ticket_price numeric(10, 2) not null default 0;

update public.events e
set min_ticket_price = coalesce(
  (
    select min(coalesce(t.price, 0))::numeric
    from public.tickets t
    where t.event_id = e.id
  ),
  0
);

create or replace function public.refresh_event_min_ticket_price()
returns trigger
language plpgsql
as $$
declare
  target_event_id uuid;
begin
  target_event_id := coalesce(new.event_id, old.event_id);
  update public.events e
  set min_ticket_price = coalesce(
    (
      select min(coalesce(t.price, 0))::numeric
      from public.tickets t
      where t.event_id = target_event_id
    ),
    0
  )
  where e.id = target_event_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists tickets_refresh_event_min_price on public.tickets;

create trigger tickets_refresh_event_min_price
after insert or update of price, event_id or delete on public.tickets
for each row
execute function public.refresh_event_min_ticket_price();

create index if not exists idx_events_browse_min_price
  on public.events (min_ticket_price)
  where approval_status = 'Approved'
    and status = 'published';

create index if not exists idx_events_browse_lat_lng
  on public.events (latitude, longitude)
  where approval_status = 'Approved'
    and status = 'published'
    and latitude is not null
    and longitude is not null;

-- Matches api/_lib/uk-outcode.js haversineMiles (3958.8 mile earth radius).
create or replace function public.haversine_miles(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
returns double precision
language sql
immutable
as $$
  select 3958.8 * 2 * atan2(sqrt(a), sqrt(1 - a))
  from (
    select
      sin(radians(lat2 - lat1) / 2) ^ 2
      + cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lng2 - lng1) / 2) ^ 2 as a
  ) s;
$$;

drop view if exists public.browse_events_index;

create view public.browse_events_index as
select
  e.id,
  e.organiser_id,
  e.title,
  e.slug,
  e.description,
  e.image_url,
  e.photo_url,
  e.event_type,
  e.meeting_type,
  e.meeting_link,
  e.venue,
  e.city,
  e.location_label,
  e.postcode,
  e.outcode,
  e.address,
  e.latitude,
  e.longitude,
  e.starts_at,
  e.ends_at,
  e.featured,
  e.featured_until,
  e.average_rating,
  e.review_count,
  e.approval_status,
  e.status,
  e.ticket_sales_enabled,
  e.auto_approve,
  e.highlights,
  e.food_included,
  e.refund_policy,
  e.refund_policy_details,
  e.refund_cutoff_days,
  e.vat_treatment,
  e.stripe_payment_link,
  e.recurrence_pattern,
  e.recurrence_end_date,
  e.series_group_id,
  e.industries,
  e.min_ticket_price,
  case
    when trim(coalesce(e.event_type, '')) ilike 'Events' then 'events'
    when trim(coalesce(e.event_type, '')) ilike 'Exhibition' then 'exhibition'
    when trim(coalesce(e.event_type, '')) ilike 'Awards' then 'awards'
    when trim(coalesce(e.event_type, '')) ilike 'Webinar' then 'webinar'
    when trim(coalesce(e.event_type, '')) ilike 'Workshop' then 'workshop'
    when trim(coalesce(e.event_type, '')) ilike 'Session' then 'session'
    else 'meeting'
  end as type_tab,
  case
    when coalesce(e.meeting_type, '') ilike '%hybrid%' then 'hybrid'
    when coalesce(e.meeting_type, '') ilike '%online%'
      and coalesce(e.meeting_type, '') not ilike '%person%' then 'online'
    when coalesce(trim(e.meeting_link), '') <> '' then 'online'
    else 'in-person'
  end as format_tab
from public.events e
left join public.organisers o on o.id = e.organiser_id
where e.approval_status = 'Approved'
  and e.status = 'published'
  and e.starts_at is not null
  and exists (select 1 from public.tickets t where t.event_id = e.id)
  and (
    e.organiser_id is null
    or o.listing_status is null
    or o.listing_status not in ('draft', 'unpublished')
  );

grant select on public.browse_events_index to anon, authenticated, service_role;
