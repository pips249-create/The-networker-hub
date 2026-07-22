-- Advertising page enquiries submitted via /api/advertising.

create table if not exists public.advertising_enquiries (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text not null,
  email text not null,
  section text not null,
  package_name text not null,
  budget text,
  message text,
  source text not null default 'advertising_page',
  created_at timestamptz not null default now()
);

create index if not exists advertising_enquiries_created_at_idx
  on public.advertising_enquiries (created_at desc);

create index if not exists advertising_enquiries_email_idx
  on public.advertising_enquiries (lower(email), created_at desc);

comment on table public.advertising_enquiries is
  'Sponsorship and advertising enquiries from /advertising — stored for follow-up and reporting.';

alter table public.advertising_enquiries enable row level security;

revoke all on table public.advertising_enquiries from anon, authenticated;
grant select, insert, update, delete on table public.advertising_enquiries to service_role;
