-- Manual opt-out for the Yorkshire Society group inbox.
-- Suppression covers addresses with no Hub account. If a login exists,
-- account flags win over that row, so those are turned off too.

insert into public.email_suppressions (email, source)
values ('contact@theyorkshiresociety.org', 'manual')
on conflict (email) do nothing;

update public.hub_accounts
set
  emails_enabled = false,
  email_pref_event_reminders = false,
  email_pref_organiser_alerts = false,
  email_pref_organiser_roundups = false
where user_id in (
  select id from auth.users where lower(email) = 'contact@theyorkshiresociety.org'
);
