-- Connected booking listings publish a price label without hub ticket rows.
-- Keep that price on browse (min_ticket_price + catalogue columns) so they are
-- not treated as unpriced "Ask organiser" events.

create or replace function public.external_price_label_to_min(label text)
returns numeric
language plpgsql
immutable
as $$
declare
  cleaned text;
  matched text[];
begin
  cleaned := trim(coalesce(label, ''));
  if cleaned = '' then
    return null;
  end if;
  if cleaned ~* '^free$' then
    return 0;
  end if;
  matched := regexp_match(cleaned, '([0-9]+(?:[.][0-9]+)?)');
  if matched is null then
    return null;
  end if;
  return matched[1]::numeric;
end;
$$;

create or replace function public.event_min_ticket_price_value(target_event_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(
    (
      select min(coalesce(t.price, 0))::numeric
      from public.tickets t
      where t.event_id = target_event_id
        and coalesce(t.visibility, 'public') = 'public'
        and coalesce(t.ticket_type, '') <> 'Alumni'
    ),
    (
      select public.external_price_label_to_min(e.external_price_label)
      from public.events e
      where e.id = target_event_id
        and (
          e.checkout_mode = 'external_connected'
          or (
            coalesce(trim(e.external_booking_url), '') <> ''
            and coalesce(trim(e.external_price_label), '') <> ''
          )
        )
    )
  );
$$;

create or replace function public.refresh_event_min_ticket_price()
returns trigger
language plpgsql
as $$
declare
  target_event_id uuid;
begin
  target_event_id := coalesce(new.event_id, old.event_id);
  update public.events e
  set min_ticket_price = public.event_min_ticket_price_value(target_event_id)
  where e.id = target_event_id;
  return coalesce(new, old);
end;
$$;

create or replace function public.refresh_event_min_ticket_price_from_event()
returns trigger
language plpgsql
as $$
begin
  new.min_ticket_price := public.event_min_ticket_price_value(new.id);
  return new;
end;
$$;

drop trigger if exists tickets_refresh_event_min_price on public.tickets;

create trigger tickets_refresh_event_min_price
after insert or update of price, event_id, visibility, ticket_type or delete on public.tickets
for each row
execute function public.refresh_event_min_ticket_price();

drop trigger if exists events_refresh_min_ticket_price on public.events;

create trigger events_refresh_min_ticket_price
before insert or update of checkout_mode, external_price_label, external_booking_url on public.events
for each row
execute function public.refresh_event_min_ticket_price_from_event();

update public.events e
set min_ticket_price = public.event_min_ticket_price_value(e.id);

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
  e.region_slug,
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
  coalesce(e.attendance_mode, 'tickets') as attendance_mode,
  coalesce(e.checkout_mode, 'hub') as checkout_mode,
  e.external_booking_url,
  e.external_price_label,
  (
    coalesce(e.attendance_mode, 'tickets') not in ('category_exclusivity', 'osop')
    and exists (
      select 1
      from public.tickets t
      where t.event_id = e.id
        and coalesce(t.visibility, 'public') = 'members_only'
    )
    and not exists (
      select 1
      from public.tickets t
      where t.event_id = e.id
        and coalesce(t.ticket_type, '') <> 'Alumni'
        and (
          coalesce(t.visibility, 'public') = 'public'
          or t.ticket_type = 'Guest-visit'
        )
    )
  ) as members_only_event,
  case
    when trim(coalesce(e.event_type, '')) ilike 'Conference' then 'conference'
    when trim(coalesce(e.event_type, '')) ilike 'Events' then 'events'
    when trim(coalesce(e.event_type, '')) ilike 'Exhibition' then 'exhibition'
    when trim(coalesce(e.event_type, '')) ilike 'Awards' then 'awards'
    when trim(coalesce(e.event_type, '')) ilike 'Webinar' then 'webinar'
    when trim(coalesce(e.event_type, '')) ilike 'Workshop' then 'workshop'
    when trim(coalesce(e.event_type, '')) ilike 'Seminar' then 'seminar'
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
  'Public browse catalogue — includes Connected booking price fields so external listings are not treated as unpriced.';
