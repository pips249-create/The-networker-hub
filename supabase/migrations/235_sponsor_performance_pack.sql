-- Sponsor performance pack: page impressions + emails that included a sponsor logo.
-- Aggregated daily (service role only). Complements sponsor_clicks (234).

create table if not exists public.sponsor_impression_daily (
  day date not null,
  placement text not null,
  company_name text not null default '',
  impressions integer not null default 0,
  primary key (day, placement, company_name)
);

create index if not exists sponsor_impression_daily_day_idx
  on public.sponsor_impression_daily (day desc);

create index if not exists sponsor_impression_daily_company_idx
  on public.sponsor_impression_daily (company_name, day desc)
  where company_name <> '';

comment on table public.sponsor_impression_daily is
  'Daily page-view impressions for active sponsor placements. No user or IP stored.';

create table if not exists public.sponsor_email_send_daily (
  day date not null,
  placement text not null,
  company_name text not null default '',
  email_slug text not null default '',
  send_count integer not null default 0,
  primary key (day, placement, company_name, email_slug)
);

create index if not exists sponsor_email_send_daily_day_idx
  on public.sponsor_email_send_daily (day desc);

create index if not exists sponsor_email_send_daily_company_idx
  on public.sponsor_email_send_daily (company_name, day desc)
  where company_name <> '';

comment on table public.sponsor_email_send_daily is
  'Daily count of Hub emails that included a sponsor logo. No recipient stored.';

alter table public.sponsor_impression_daily enable row level security;
alter table public.sponsor_email_send_daily enable row level security;

revoke all on table public.sponsor_impression_daily from anon, authenticated;
revoke all on table public.sponsor_email_send_daily from anon, authenticated;
grant select, insert, update, delete on table public.sponsor_impression_daily to service_role;
grant select, insert, update, delete on table public.sponsor_email_send_daily to service_role;

create or replace function public.bump_sponsor_impression_daily(
  p_day date,
  p_placement text,
  p_company_name text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sponsor_impression_daily (day, placement, company_name, impressions)
  values (
    p_day,
    coalesce(nullif(trim(p_placement), ''), 'sponsor'),
    coalesce(trim(p_company_name), ''),
    1
  )
  on conflict (day, placement, company_name)
  do update set impressions = public.sponsor_impression_daily.impressions + 1;
end;
$$;

create or replace function public.bump_sponsor_email_send_daily(
  p_day date,
  p_placement text,
  p_company_name text,
  p_email_slug text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sponsor_email_send_daily (day, placement, company_name, email_slug, send_count)
  values (
    p_day,
    coalesce(nullif(trim(p_placement), ''), 'email_sponsor'),
    coalesce(trim(p_company_name), ''),
    coalesce(trim(p_email_slug), ''),
    1
  )
  on conflict (day, placement, company_name, email_slug)
  do update set send_count = public.sponsor_email_send_daily.send_count + 1;
end;
$$;

revoke all on function public.bump_sponsor_impression_daily(date, text, text) from public, anon, authenticated;
revoke all on function public.bump_sponsor_email_send_daily(date, text, text, text) from public, anon, authenticated;
grant execute on function public.bump_sponsor_impression_daily(date, text, text) to service_role;
grant execute on function public.bump_sponsor_email_send_daily(date, text, text, text) to service_role;
