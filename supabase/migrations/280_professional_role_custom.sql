-- Allow free-text professional roles when members choose "Other".
-- Known slugs (founder, director, employee, freelancer, investor) stay unchanged;
-- custom roles are stored as the typed label (not the bare value "other").

alter table public.attendees
  drop constraint if exists attendees_professional_role_check;

comment on column public.attendees.professional_role is
  'Optional role for founder-density Index metrics. Known slugs: founder, director, employee, freelancer, investor. Other = free-text label.';
