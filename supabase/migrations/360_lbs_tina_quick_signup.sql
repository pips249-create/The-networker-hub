-- London Business Show TINA QR: persist join source + 24h finish-profile reminder claim.

alter table public.attendees
  add column if not exists signup_source text,
  add column if not exists lbs_finish_profile_email_sent_at timestamptz;

comment on column public.attendees.signup_source is
  'Acquisition source at signup (e.g. tina_lbs for Business Show leaflet QR).';

comment on column public.attendees.lbs_finish_profile_email_sent_at is
  'When the ~24h Business Show / TINA finish-profile reminder was sent.';

create index if not exists attendees_signup_source_created_idx
  on public.attendees (signup_source, created_at desc)
  where signup_source is not null;

create index if not exists attendees_lbs_finish_profile_due_idx
  on public.attendees (created_at)
  where signup_source = 'tina_lbs'
    and lbs_finish_profile_email_sent_at is null;

notify pgrst, 'reload schema';
