-- Resend-backed sponsor email open/click aggregates for performance packs.
-- Complements sponsor_email_send_daily (235). Dispatch map links Resend email ids → brand(s).

create table if not exists public.sponsor_email_dispatch (
  resend_email_id text not null,
  company_name text not null default '',
  placement text not null default 'email_sponsor',
  email_slug text not null default '',
  created_at timestamptz not null default now(),
  primary key (resend_email_id, company_name)
);

create index if not exists sponsor_email_dispatch_company_idx
  on public.sponsor_email_dispatch (company_name, created_at desc)
  where company_name <> '';

create index if not exists sponsor_email_dispatch_resend_idx
  on public.sponsor_email_dispatch (resend_email_id);

create table if not exists public.sponsor_email_open_daily (
  day date not null,
  company_name text not null default '',
  open_count integer not null default 0,
  primary key (day, company_name)
);

create index if not exists sponsor_email_open_daily_day_idx
  on public.sponsor_email_open_daily (day desc);

create table if not exists public.sponsor_email_click_daily (
  day date not null,
  company_name text not null default '',
  click_count integer not null default 0,
  primary key (day, company_name)
);

create index if not exists sponsor_email_click_daily_day_idx
  on public.sponsor_email_click_daily (day desc);

comment on table public.sponsor_email_dispatch is
  'Maps Resend email ids to sponsor brands for open/click webhooks. No recipient stored.';
comment on table public.sponsor_email_open_daily is
  'Daily Resend open counts for emails that included a sponsor logo.';
comment on table public.sponsor_email_click_daily is
  'Daily Resend click counts for emails that included a sponsor logo.';

alter table public.sponsor_email_dispatch enable row level security;
alter table public.sponsor_email_open_daily enable row level security;
alter table public.sponsor_email_click_daily enable row level security;

revoke all on table public.sponsor_email_dispatch from anon, authenticated;
revoke all on table public.sponsor_email_open_daily from anon, authenticated;
revoke all on table public.sponsor_email_click_daily from anon, authenticated;
grant select, insert, update, delete on table public.sponsor_email_dispatch to service_role;
grant select, insert, update, delete on table public.sponsor_email_open_daily to service_role;
grant select, insert, update, delete on table public.sponsor_email_click_daily to service_role;

create or replace function public.bump_sponsor_email_open_daily(
  p_day date,
  p_company_name text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sponsor_email_open_daily (day, company_name, open_count)
  values (p_day, coalesce(trim(p_company_name), ''), 1)
  on conflict (day, company_name)
  do update set open_count = public.sponsor_email_open_daily.open_count + 1;
end;
$$;

create or replace function public.bump_sponsor_email_click_daily(
  p_day date,
  p_company_name text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sponsor_email_click_daily (day, company_name, click_count)
  values (p_day, coalesce(trim(p_company_name), ''), 1)
  on conflict (day, company_name)
  do update set click_count = public.sponsor_email_click_daily.click_count + 1;
end;
$$;

revoke all on function public.bump_sponsor_email_open_daily(date, text) from public, anon, authenticated;
revoke all on function public.bump_sponsor_email_click_daily(date, text) from public, anon, authenticated;
grant execute on function public.bump_sponsor_email_open_daily(date, text) to service_role;
grant execute on function public.bump_sponsor_email_click_daily(date, text) to service_role;
