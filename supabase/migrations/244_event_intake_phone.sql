-- Contact phone on /add-your-event submissions so staff can call organisers.

alter table public.event_intake_submissions
  add column if not exists phone text;

comment on column public.event_intake_submissions.phone is
  'Organiser contact phone from /add-your-event (required on new submissions).';
