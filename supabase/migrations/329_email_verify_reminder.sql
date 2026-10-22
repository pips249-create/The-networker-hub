-- One follow-up when a signup still has not confirmed their email.
-- Sent ~3 hours after account creation (hourly cron); once only.

alter table public.hub_accounts
  add column if not exists organiser_email_verify_reminder_sent_at timestamptz;

comment on column public.hub_accounts.organiser_email_verify_reminder_sent_at is
  'When the one-off confirm-email reminder was sent. Null until the reminder cron claims it.';

create index if not exists hub_accounts_email_verify_reminder_due_idx
  on public.hub_accounts (created_at)
  where organiser_email_verified_at is null
    and organiser_email_verify_reminder_sent_at is null;

insert into public.email_templates (
  slug,
  name,
  description,
  subject,
  body_html,
  placeholders,
  category
)
values (
  'organiser_email_verify_reminder',
  'Confirm email reminder',
  'One follow-up a few hours after signup if the address is still unconfirmed. Issues a fresh code.',
  'Still need to confirm your Networker UK email?',
  '<p>stub — see email-templates/organiser-email-verify-reminder.html</p>',
  array[
    'user_name',
    'user_email',
    'verify_code',
    'verify_url',
    'site_url',
    'logo_url',
    'logo_footer_url',
    'privacy_url',
    'terms_url',
    'refunds_url',
    'contact_url',
    'support_email',
    'sponsor_row',
    'unsubscribe_url'
  ],
  'auth'
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  placeholders = excluded.placeholders,
  category = excluded.category,
  updated_at = now();
