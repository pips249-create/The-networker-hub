-- Adds optional organiser website URL to event intake submissions.

alter table public.event_intake_submissions
  add column if not exists phone text,
  add column if not exists organiser_website_url text;

