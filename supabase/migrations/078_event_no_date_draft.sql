-- Events without a start date must stay in draft (not public browse).

update public.events
set
  status = 'draft',
  approval_status = 'Pending Review',
  ticket_sales_enabled = false
where starts_at is null
  and (
    status = 'published'
    or approval_status = 'Approved'
  );

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
