-- Additional attendee names for multi-ticket bookings (excludes primary booker on attendees row)
alter table public.registrations
  add column if not exists guest_names text[];

comment on column public.registrations.guest_names is
  'Names of additional ticket holders when quantity > 1; primary booker name lives on attendees.name';
