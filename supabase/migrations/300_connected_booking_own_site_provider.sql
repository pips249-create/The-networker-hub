-- Allow "own website" Connected booking provider (token webhook + TNH eventId in payload).

alter table public.connected_booking_provider_connections
  drop constraint if exists connected_booking_provider_connections_provider_check;

alter table public.connected_booking_provider_connections
  add constraint connected_booking_provider_connections_provider_check check (
    provider in ('eventbrite', 'ticket_tailor', 'luma', 'trybooking', 'own_site', 'custom')
  );

alter table public.connected_booking_event_links
  drop constraint if exists connected_booking_event_links_provider_check;

alter table public.connected_booking_event_links
  add constraint connected_booking_event_links_provider_check check (
    provider in ('eventbrite', 'ticket_tailor', 'luma', 'trybooking', 'own_site', 'custom')
  );
