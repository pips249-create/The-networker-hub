-- Optional public name shown on attendee reviews (not the legal booking name).
alter table public.attendees
  add column if not exists public_review_name text;

comment on column public.attendees.public_review_name is
  'Optional public display name for reviews; legal name stays on attendees.name for bookings and badges.';
