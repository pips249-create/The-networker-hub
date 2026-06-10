-- Safe recipients for Command Centre test sends (admin-managed allowlist)

create table if not exists public.email_test_recipients (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email      text not null,
  label      text,
  added_by   text
);

create unique index if not exists idx_email_test_recipients_email_lower
  on public.email_test_recipients (lower(trim(email)));

grant select, insert, update, delete on public.email_test_recipients to service_role;
