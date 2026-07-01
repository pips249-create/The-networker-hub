-- Browse at scale: indexed view for paginated public listings.

create index if not exists idx_events_browse_starts
  on public.events (starts_at asc)
  where approval_status = 'Approved'
    and status = 'published'
    and starts_at is not null;

create index if not exists idx_events_browse_outcode
  on public.events (outcode)
  where approval_status = 'Approved'
    and status = 'published';

create index if not exists idx_events_browse_organiser
  on public.events (organiser_id)
  where approval_status = 'Approved'
    and status = 'published';

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
  (
    select min(coalesce(t.price, 0))
    from public.tickets t
    where t.event_id = e.id
  ) as min_ticket_price,
  case
    when trim(coalesce(e.event_type, '')) ilike 'Events' then 'events'
    when trim(coalesce(e.event_type, '')) ilike 'Exhibition' then 'exhibition'
    when trim(coalesce(e.event_type, '')) ilike 'Awards' then 'awards'
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
