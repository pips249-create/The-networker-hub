-- Simplify event_type to Meeting, Events, Exhibition, Awards

update public.events
set event_type = 'Meeting'
where event_type in (
  'Networking meeting',
  'Netwalking',
  'Sport & social',
  'Women''s networking',
  'Networking / Meeting',
  'Networking Event'
);

update public.events
set event_type = 'Events'
where event_type = 'Conference';

update public.events
set event_type = 'Awards'
where event_type = 'Awards ceremony';

alter table public.events drop constraint if exists events_event_type_check;

alter table public.events add constraint events_event_type_check check (
  event_type in ('Meeting', 'Events', 'Exhibition', 'Awards')
);
