-- Align event intake with the organiser ticket setup flow.

alter table public.event_intake_submissions
  add column if not exists attendance_door text,
  add column if not exists pay_how text,
  add column if not exists free_trial_visits text,
  add column if not exists free_trial_details text;

comment on column public.event_intake_submissions.attendance_door is
  'How people get in: general | category_exclusivity.';

comment on column public.event_intake_submissions.pay_how is
  'Access / payment: free_tickets | paid_tickets | membership | both.';

comment on column public.event_intake_submissions.free_trial_visits is
  'Whether free trial visits are offered: yes | no.';
