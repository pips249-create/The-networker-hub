-- UK Regional Networking Index foundations:
-- normalised region_slug on events / browse searches / opportunities,
-- plus structured attendee professional_role for founder-density metrics.

-- ── Events ──────────────────────────────────────────────────────────────
alter table public.events
  add column if not exists region_slug text;

comment on column public.events.region_slug is
  'Normalised networking region slug (e.g. manchester, central-london) for city Index rollups.';

create index if not exists events_region_slug_idx
  on public.events (region_slug)
  where region_slug is not null;

-- Best-effort backfill from city / location_label names (non-London first).
update public.events e
set region_slug = m.slug
from (
  select id, slug
  from (
    select
      e2.id,
      v.slug,
      row_number() over (partition by e2.id order by length(v.needle) desc) as rn
    from public.events e2
    cross join (values
      ('manchester', 'manchester'),
      ('birmingham', 'birmingham'),
      ('glasgow', 'glasgow'),
      ('edinburgh', 'edinburgh'),
      ('leeds', 'leeds'),
      ('liverpool', 'liverpool'),
      ('newcastle', 'newcastle'),
      ('bristol', 'bristol'),
      ('sheffield', 'sheffield'),
      ('nottingham', 'nottingham'),
      ('cardiff', 'cardiff'),
      ('brighton', 'brighton'),
      ('cambridge', 'cambridge'),
      ('oxford', 'oxford'),
      ('chester', 'chester'),
      ('belfast', 'belfast'),
      ('reading', 'reading'),
      ('leicester', 'leicester'),
      ('bournemouth', 'bournemouth'),
      ('central london', 'central-london'),
      ('north london', 'north-london'),
      ('south london', 'south-london'),
      ('east london', 'east-london'),
      ('west london', 'west-london'),
      ('london', 'london')
    ) as v(needle, slug)
    where coalesce(e2.region_slug, '') = ''
      and (
        lower(coalesce(e2.city, '')) like '%' || v.needle || '%'
        or lower(coalesce(e2.location_label, '')) like '%' || v.needle || '%'
      )
  ) ranked
  where rn = 1
) m
where e.id = m.id;

-- ── Browse search telemetry ─────────────────────────────────────────────
alter table public.browse_search_events
  add column if not exists region_slug text;

comment on column public.browse_search_events.region_slug is
  'Resolved networking region slug from location_text / client region hint.';

comment on column public.browse_search_events.source is
  'Browse surface: events_browse | organisers_browse | opportunities_browse.';

create index if not exists browse_search_events_region_idx
  on public.browse_search_events (region_slug, created_at desc)
  where region_slug is not null;

create index if not exists browse_search_events_source_idx
  on public.browse_search_events (source, created_at desc);

-- ── Business opportunities ──────────────────────────────────────────────
alter table public.business_opportunities
  add column if not exists outcode text,
  add column if not exists region_slug text;

comment on column public.business_opportunities.outcode is
  'UK postcode outcode derived from Location / Territory meta when available.';
comment on column public.business_opportunities.region_slug is
  'Normalised networking region slug for Index B2B-intent rollups.';

create index if not exists business_opportunities_region_slug_idx
  on public.business_opportunities (region_slug)
  where region_slug is not null;

create index if not exists business_opportunities_outcode_idx
  on public.business_opportunities (outcode)
  where outcode is not null;

-- Best-effort backfill from Location / Territory meta text (longest needle wins).
update public.business_opportunities bo
set region_slug = m.slug
from (
  select id, slug
  from (
    select
      o.id,
      v.slug,
      row_number() over (partition by o.id order by length(v.needle) desc) as rn
    from public.business_opportunities o
    cross join (values
      ('manchester', 'manchester'),
      ('birmingham', 'birmingham'),
      ('glasgow', 'glasgow'),
      ('edinburgh', 'edinburgh'),
      ('leeds', 'leeds'),
      ('liverpool', 'liverpool'),
      ('newcastle', 'newcastle'),
      ('bristol', 'bristol'),
      ('sheffield', 'sheffield'),
      ('nottingham', 'nottingham'),
      ('cardiff', 'cardiff'),
      ('brighton', 'brighton'),
      ('cambridge', 'cambridge'),
      ('oxford', 'oxford'),
      ('chester', 'chester'),
      ('belfast', 'belfast'),
      ('reading', 'reading'),
      ('leicester', 'leicester'),
      ('bournemouth', 'bournemouth'),
      ('central london', 'central-london'),
      ('north london', 'north-london'),
      ('south london', 'south-london'),
      ('east london', 'east-london'),
      ('west london', 'west-london'),
      ('london', 'london')
    ) as v(needle, slug)
    where coalesce(o.region_slug, '') = ''
      and exists (
        select 1
        from jsonb_array_elements(coalesce(o.meta, '[]'::jsonb)) meta
        where lower(coalesce(meta->>'key', '')) in ('location', 'territory')
          and lower(coalesce(meta->>'val', '')) like '%' || v.needle || '%'
      )
  ) ranked
  where rn = 1
) m
where bo.id = m.id;

-- ── Attendee professional role ──────────────────────────────────────────
alter table public.attendees
  add column if not exists professional_role text;

alter table public.attendees
  drop constraint if exists attendees_professional_role_check;

alter table public.attendees
  add constraint attendees_professional_role_check
  check (
    professional_role is null
    or professional_role in (
      'founder',
      'director',
      'employee',
      'freelancer',
      'investor',
      'other'
    )
  );

comment on column public.attendees.professional_role is
  'Structured role for founder-density Index metrics (optional profile field).';

create index if not exists attendees_professional_role_idx
  on public.attendees (professional_role)
  where professional_role is not null;

-- ── Browse index view includes region_slug ──────────────────────────────
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
