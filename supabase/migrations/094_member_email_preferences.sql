-- Granular member email preferences on hub_accounts (master emails_enabled remains).

alter table public.hub_accounts
  add column if not exists email_pref_newsletter boolean not null default true,
  add column if not exists email_pref_event_reminders boolean not null default true,
  add column if not exists email_pref_organiser_alerts boolean not null default true;

-- Align newsletter pref with existing marketing opt-in.
update public.hub_accounts
set email_pref_newsletter = emails_enabled
where emails_enabled = false;
