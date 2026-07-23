-- Allow published Approved events on browse before ticket types exist (listing-only + nudge flow).

drop view if exists public.browse_events_index;

create view public.browse_events_index as
select
  e.id,
  e.organiser_id,
  o.name as organiser_name,
  e.title,
  e.slug,
  e.description,
  e.image_url,
  e.photo_url,
  e.image_position,
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
  e.created_at,
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
  (
    exists (
      select 1
      from public.tickets t
      where t.event_id = e.id
        and coalesce(t.visibility, 'public') = 'members_only'
    )
    and not exists (
      select 1
      from public.tickets t
      where t.event_id = e.id
        and coalesce(t.visibility, 'public') = 'public'
    )
  ) as members_only_event,
  case
    when trim(coalesce(e.event_type, '')) ilike 'Conference' then 'conference'
    when trim(coalesce(e.event_type, '')) ilike 'Events' then 'events'
    when trim(coalesce(e.event_type, '')) ilike 'Exhibition' then 'exhibition'
    when trim(coalesce(e.event_type, '')) ilike 'Awards' then 'awards'
    when trim(coalesce(e.event_type, '')) ilike 'Webinar' then 'webinar'
    when trim(coalesce(e.event_type, '')) ilike 'Workshop' then 'workshop'
    when trim(coalesce(e.event_type, '')) ilike 'Masterclass' then 'masterclass'
    when trim(coalesce(e.event_type, '')) ilike 'Session' then 'masterclass'
    else 'meeting'
  end as type_tab,
  case
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
  and (
    e.organiser_id is null
    or o.listing_status is null
    or o.listing_status not in ('draft', 'unpublished')
  );

grant select on public.browse_events_index to anon, authenticated, service_role;

comment on view public.browse_events_index is
  'Public browse catalogue — includes listing-only events before ticket types are added.';
