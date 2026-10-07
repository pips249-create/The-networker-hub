-- Addresses that used Unsubscribe, including people with no hub account yet.
-- Optional mail checks this table. Service messages (bookings, password resets) do not.

create table if not exists public.email_suppressions (
  email text primary key,
  unsubscribed_at timestamptz not null default now(),
  source text not null default 'unsubscribe',
  constraint email_suppressions_email_len check (char_length(email) between 3 and 320)
);

comment on table public.email_suppressions is
  'Optional-email opt-out. Checked before marketing, reminders, organiser alerts, and group roundups.';

alter table public.email_suppressions enable row level security;

revoke all on table public.email_suppressions from anon, authenticated;
grant select, insert, update, delete on table public.email_suppressions to service_role;

-- Manual opt-out requested for this group inbox.
insert into public.email_suppressions (email, source)
values ('contact@theyorkshiresociety.org', 'manual')
on conflict (email) do nothing;

-- If they already have a Hub login, account flags win over the suppression row.
update public.hub_accounts
set
  emails_enabled = false,
  email_pref_event_reminders = false,
  email_pref_organiser_alerts = false,
  email_pref_organiser_roundups = false
where user_id in (
  select id from auth.users where lower(email) = 'contact@theyorkshiresociety.org'
);
