-- Guest visit programme: organiser-level complimentary visits (platform max 2),
-- guest_programme attendance mode, and registration_kind tracking.

alter table public.organisers
  add column if not exists complimentary_visits_allowed smallint not null default 0;

alter table public.organisers
  drop constraint if exists organisers_complimentary_visits_allowed_check;

alter table public.organisers
  add constraint organisers_complimentary_visits_allowed_check
  check (complimentary_visits_allowed >= 0 and complimentary_visits_allowed <= 2);

alter table public.events
  add column if not exists attendance_mode text not null default 'tickets';

alter table public.events
  drop constraint if exists events_attendance_mode_check;

alter table public.events
  add constraint events_attendance_mode_check
  check (attendance_mode in ('tickets', 'category_exclusivity', 'guest_programme'));

update public.events e
set attendance_mode = 'category_exclusivity'
where e.auto_approve = false
  and coalesce(e.attendance_mode, 'tickets') = 'tickets';

alter table public.registrations
  add column if not exists registration_kind text not null default 'standard';

alter table public.registrations
  drop constraint if exists registrations_registration_kind_check;

alter table public.registrations
  add constraint registrations_registration_kind_check
  check (registration_kind in ('standard', 'guest_visit', 'application'));

alter table public.tickets
  drop constraint if exists tickets_ticket_type_check;

alter table public.tickets
  add constraint tickets_ticket_type_check
  check (ticket_type in ('Standard', 'Application-based', 'Guest-visit'));

update public.registrations r
set registration_kind = 'application'
from public.tickets t
where r.ticket_id = t.id
  and t.ticket_type = 'Application-based'
  and r.registration_kind = 'standard';

update public.registrations r
set registration_kind = 'guest_visit'
from public.tickets t
where r.ticket_id = t.id
  and t.ticket_type = 'Guest-visit'
  and r.registration_kind = 'standard';
