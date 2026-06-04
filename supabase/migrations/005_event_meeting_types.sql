-- Meeting types for events (organiser form + public filters)
alter table public.events drop constraint if exists events_event_type_check;

alter table public.events add constraint events_event_type_check check (
  event_type in (
    'Networking meeting',
    'Netwalking',
    'Conference',
    'Exhibition',
    'Awards ceremony',
    'Networking / Meeting',
    'Networking Event'
  )
);

-- Normalise legacy sample row
update public.events
set event_type = 'Networking meeting'
where event_type in ('Networking / Meeting', 'Networking Event');
