-- Fix attendance_mode check (allow category_exclusivity; migrate leftover osop)
-- and raise complimentary guest visits platform max from 2 to 3.

update public.events
set attendance_mode = 'category_exclusivity'
where attendance_mode = 'osop';

alter table public.events
  drop constraint if exists events_attendance_mode_check;

alter table public.events
  add constraint events_attendance_mode_check
  check (attendance_mode in ('tickets', 'category_exclusivity', 'guest_programme'));

alter table public.organisers
  drop constraint if exists organisers_complimentary_visits_allowed_check;

alter table public.organisers
  add constraint organisers_complimentary_visits_allowed_check
  check (complimentary_visits_allowed >= 0 and complimentary_visits_allowed <= 3);

comment on column public.organisers.complimentary_visits_allowed is
  'How many complimentary guest visits a new attendee gets with this organiser before paid member tickets unlock. Platform maximum is 3.';
