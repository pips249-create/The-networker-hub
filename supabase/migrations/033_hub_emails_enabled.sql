-- Per-user email opt-in (admin provisions organiser logins with emails off by default).

alter table public.hub_accounts
  add column if not exists emails_enabled boolean not null default false;

-- Existing accounts keep receiving mail until an admin turns it off.
update public.hub_accounts
set emails_enabled = true
where emails_enabled = false;
