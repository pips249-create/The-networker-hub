-- Networking group meeting: complimentary guest visits + free member ticket,
-- then join Hub monthly/annual membership (no public event ticket).

alter table public.events
  drop constraint if exists events_attendance_mode_check;

alter table public.events
  add constraint events_attendance_mode_check
  check (
    attendance_mode in (
      'tickets',
      'category_exclusivity',
      'guest_programme',
      'membership_meeting'
    )
  );

comment on column public.events.attendance_mode is
  'tickets = open booking; guest_programme = open booking + complimentary visits; membership_meeting = complimentary visits + members_only ticket (join Hub membership after visits); category_exclusivity = apply first.';
