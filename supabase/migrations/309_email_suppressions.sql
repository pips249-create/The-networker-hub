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
