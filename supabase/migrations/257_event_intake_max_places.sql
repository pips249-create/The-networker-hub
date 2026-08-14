-- Optional capacity on public event intake submissions.

alter table public.event_intake_submissions
  add column if not exists max_places integer;

comment on column public.event_intake_submissions.max_places is
  'Optional maximum attendees supplied on /add-your-event.';
