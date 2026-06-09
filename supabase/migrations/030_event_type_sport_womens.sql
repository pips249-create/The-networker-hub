-- Align events.event_type check constraint with frontend + api/_lib/event-types.js

alter table public.events drop constraint if exists events_event_type_check;

alter table public.events add constraint events_event_type_check check (
  event_type in (
    'Networking meeting',
    'Netwalking',
    'Sport & social',
    'Conference',
    'Exhibition',
    'Awards ceremony',
    'Women''s networking',
    'Networking / Meeting',
    'Networking Event'
  )
);
