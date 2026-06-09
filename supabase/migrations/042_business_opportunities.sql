-- Business opportunity listings (user-submitted; not tied to group profiles)
create table if not exists public.business_opportunities (
  id uuid primary key default gen_random_uuid(),
  organiser_id uuid references public.organisers(id) on delete set null,
  owner_email text,
  supabase_user_id uuid,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'unpublished', 'archived')),
  approval_status text not null default 'Pending Review'
    check (approval_status in ('Pending Review', 'Approved', 'Rejected')),
  featured boolean not null default false,
  type text not null
    check (type in (
      'franchise',
      'side-hustle',
      'partnership',
      'networking',
      'distributorship',
      'business-opportunity'
    )),
  category text,
  title text not null,
  description text,
  about text[] not null default '{}',
  host text not null,
  host_initials text,
  host_color text,
  contact_email text,
  image_url text,
  meta jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  package_tier text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists business_opportunities_organiser_id_idx
  on public.business_opportunities (organiser_id);

create index if not exists business_opportunities_owner_email_idx
  on public.business_opportunities (lower(owner_email));

create index if not exists business_opportunities_owner_user_idx
  on public.business_opportunities (supabase_user_id);

create index if not exists business_opportunities_status_idx
  on public.business_opportunities (status, approval_status);

create or replace view public.published_opportunities as
select *
from public.business_opportunities
where status = 'published'
  and approval_status = 'Approved';

grant select on public.published_opportunities to anon, authenticated, service_role;

grant select, insert, update, delete on public.business_opportunities to authenticated, service_role;
