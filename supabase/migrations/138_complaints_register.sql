-- Complaints register for Command Centre (UK complaints procedure).

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  complainant_name text not null default '',
  complainant_email text not null,
  category text not null default 'other' check (
    category in (
      'platform',
      'refund',
      'listing',
      'advertising',
      'data_protection',
      'payments',
      'accessibility',
      'other'
    )
  ),
  subject text not null default '',
  body text not null default '',
  related_registration_id uuid references public.registrations(id) on delete set null,
  related_event_id uuid references public.events(id) on delete set null,
  related_opportunity_id uuid references public.business_opportunities(id) on delete set null,
  related_reference text,
  acknowledgement_sent_at timestamptz,
  due_date date,
  status text not null default 'open' check (
    status in (
      'open',
      'investigating',
      'awaiting_third_party',
      'resolved',
      'escalated',
      'closed'
    )
  ),
  outcome text check (
    outcome is null
    or outcome in ('upheld', 'partly_upheld', 'not_upheld', 'referred')
  ),
  assigned_to text,
  notes text,
  resolution_summary text,
  closed_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_by_email text
);

create index if not exists idx_complaints_status_created
  on public.complaints(status, created_at desc);

create index if not exists idx_complaints_due_date
  on public.complaints(due_date)
  where status not in ('resolved', 'closed');

create index if not exists idx_complaints_complainant_email
  on public.complaints(lower(complainant_email));

comment on table public.complaints is 'Internal complaints register — logged from hello@thenetworkerhub.com via Command Centre';

create or replace function public.complaints_before_insert()
returns trigger
language plpgsql
as $$
declare
  yr text;
  n int;
begin
  if new.reference is null or btrim(new.reference) = '' then
    yr := to_char(coalesce(new.created_at, now()), 'YYYY');
    select count(*) + 1
      into n
      from public.complaints
     where reference like 'CMP-' || yr || '-%';
    new.reference := 'CMP-' || yr || '-' || lpad(n::text, 3, '0');
  end if;

  if new.due_date is null then
    new.due_date := (coalesce(new.created_at, now())::date + 14);
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists complaints_before_insert on public.complaints;
create trigger complaints_before_insert
  before insert on public.complaints
  for each row
  execute function public.complaints_before_insert();

create or replace function public.complaints_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status in ('resolved', 'closed') and new.closed_at is null then
    new.closed_at := now();
  elsif new.status not in ('resolved', 'closed') then
    new.closed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists complaints_touch_updated_at on public.complaints;
create trigger complaints_touch_updated_at
  before update on public.complaints
  for each row
  execute function public.complaints_touch_updated_at();

alter table public.complaints enable row level security;

do $$
begin
  if to_regprocedure('public._hub_harden_table_rls(text)') is not null then
    perform public._hub_harden_table_rls('public.complaints');
  elsif to_regprocedure('public._hub_harden_table_rls(regclass)') is not null then
    perform public._hub_harden_table_rls('public.complaints'::regclass);
  end if;
end $$;

grant select, insert, update, delete on public.complaints to service_role;
