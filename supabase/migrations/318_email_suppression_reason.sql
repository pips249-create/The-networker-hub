-- Why someone unsubscribed. Older rows stay blank until they opt out again.

alter table public.email_suppressions
  add column if not exists reason text,
  add column if not exists reason_note text;
