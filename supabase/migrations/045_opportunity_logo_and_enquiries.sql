-- Business logo (avatar) separate from cover image; store opportunity enquiries
alter table public.business_opportunities
  add column if not exists logo_url text;

create table if not exists public.opportunity_enquiries (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.business_opportunities(id) on delete cascade,
  owner_email text,
  enquirer_name text not null,
  enquirer_email text not null,
  message text not null,
  status text not null default 'new'
    check (status in ('new', 'read', 'responded')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  responded_at timestamptz
);

create index if not exists opportunity_enquiries_owner_email_idx
  on public.opportunity_enquiries (lower(owner_email));

create index if not exists opportunity_enquiries_opportunity_id_idx
  on public.opportunity_enquiries (opportunity_id);

create index if not exists opportunity_enquiries_status_idx
  on public.opportunity_enquiries (status, created_at desc);

grant select, insert, update on public.opportunity_enquiries to authenticated, service_role;
