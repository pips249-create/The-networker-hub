-- Browse page: outcode on events + next_date on published_events view

alter table public.events
  add column if not exists outcode text;

update public.events
set outcode = upper(
  substring(
    regexp_replace(coalesce(postcode, ''), '\s+', '', 'g')
    from '^([A-Z]{1,2}[0-9]{1,2}[A-Z]?)'
  )
)
where coalesce(outcode, '') = ''
  and coalesce(postcode, '') <> '';

drop view if exists public.published_events cascade;

create view public.published_events as
select
  e.*,
  e.starts_at as next_date
from public.events e
left join public.organisers o on o.id = e.organiser_id
where e.approval_status = 'Approved'
  and (
    e.organiser_id is null
    or o.listing_status is null
    or o.listing_status not in ('draft', 'unpublished')
  );

grant select on public.published_events to anon, authenticated, service_role;
