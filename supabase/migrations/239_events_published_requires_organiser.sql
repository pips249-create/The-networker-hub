-- Published events must be linked to an organiser (reviews, emails, and profiles depend on it).

-- Heal existing orphans so the constraint can apply.
update public.events
set
  status = 'unpublished',
  ticket_sales_enabled = false
where organiser_id is null
  and status = 'published';

alter table public.events
  drop constraint if exists events_published_requires_organiser;

alter table public.events
  add constraint events_published_requires_organiser
  check (status is distinct from 'published' or organiser_id is not null);

comment on constraint events_published_requires_organiser on public.events is
  'Live directory listings must have an organiser profile so attendees can review the group.';
