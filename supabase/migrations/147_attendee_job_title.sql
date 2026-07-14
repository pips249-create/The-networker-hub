-- Profile job title for account settings and printable name badges.
-- Company already exists on attendees; job title did not.

alter table public.attendees
  add column if not exists job_title text;

comment on column public.attendees.company is
  'Business or organisation name from account profile; used on name badges.';

comment on column public.attendees.job_title is
  'Job title from account profile; used on name badges.';
