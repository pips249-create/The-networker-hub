-- Organisers can recentre their event cover photo (CSS object-position, e.g. "50% 30%").

alter table public.events
  add column if not exists image_position text;

comment on column public.events.image_position is
  'CSS object-position for the event cover image (e.g. "50% 30%"). Null means centred.';

-- Recreate published_events so the view picks up the new column (e.* is expanded at creation).
drop view if exists public.published_events cascade;

create view public.published_events as
select
  e.*,
  e.starts_at as next_date
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

grant select on public.published_events to anon, authenticated, service_role;
