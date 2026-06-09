-- Simplify event_type to Meeting, Events, Exhibition, Awards
-- Drop the old check constraint BEFORE backfill (updates to new values fail otherwise).

alter table public.events drop constraint if exists events_event_type_check;

update public.events
set event_type = 'Meeting'
where event_type in (
  'Networking meeting',
  'Netwalking',
  'Sport & social',
  'Women''s networking',
  'Networking / Meeting',
  'Networking Event',
  'Conference',
  'Awards ceremony'
);

alter table public.events add constraint events_event_type_check check (
  event_type in ('Meeting', 'Events', 'Exhibition', 'Awards')
);
