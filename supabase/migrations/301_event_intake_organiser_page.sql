-- Event requests from /add-your-event must already belong to an organiser page.
-- Staff then add the event to that page instead of creating the group as well.

alter table public.event_intake_submissions
  add column if not exists organiser_id uuid references public.organisers (id) on delete set null;

create index if not exists event_intake_submissions_organiser_id_idx
  on public.event_intake_submissions (organiser_id);

comment on column public.event_intake_submissions.organiser_id is
  'Organiser page the submitter already owns. Staff add the event to this page.';
