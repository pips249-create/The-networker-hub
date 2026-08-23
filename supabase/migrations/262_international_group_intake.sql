-- Networking group / training org intake from international map (building markets).

create table if not exists public.international_group_intake (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  email text not null,
  phone text,
  group_name text not null,
  website_url text,
  org_type text not null default 'networking_group'
    check (org_type in ('networking_group', 'training', 'both')),
  description text,
  country_code text not null,
  country_name text not null,
  status text not null default 'open'
    check (status in ('open', 'done', 'spam')),
  source text not null default 'international_map',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);

create index if not exists international_group_intake_created_at_idx
  on public.international_group_intake (created_at desc);

create index if not exists international_group_intake_country_idx
  on public.international_group_intake (country_code, created_at desc);

create index if not exists international_group_intake_status_idx
  on public.international_group_intake (status, created_at desc);

comment on table public.international_group_intake is
  'Organiser submissions from thenetworkerinternational.com building markets.';

alter table public.international_group_intake enable row level security;

revoke all on table public.international_group_intake from anon, authenticated;
grant select, insert, update, delete on table public.international_group_intake to service_role;
