-- Fix organiser approve/deny: registrations.application_decided_at (from 087, if not yet applied)

alter table public.registrations
  add column if not exists application_decided_at timestamptz,
  add column if not exists post_event_review_sent_at timestamptz,
  add column if not exists osop_payment_reminder_sent_at timestamptz;

comment on column public.registrations.application_decided_at is
  'When the organiser approved or denied an application.';

comment on column public.registrations.post_event_review_sent_at is
  'When the post-event review request email was sent.';

comment on column public.registrations.osop_payment_reminder_sent_at is
  'When the OSOP payment reminder was sent after approval.';
