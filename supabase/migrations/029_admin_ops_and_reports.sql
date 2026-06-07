-- Admin completion log + public listing reports

create table if not exists public.admin_event_health_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid references public.events(id) on delete set null,
  event_title text not null,
  event_slug text,
  fixed_issues text[] not null default '{}',
  admin_email text
);

create index if not exists idx_admin_event_health_log_created
  on public.admin_event_health_log(created_at desc);

create table if not exists public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  listing_type text not null check (listing_type in ('event', 'organiser')),
  event_id uuid references public.events(id) on delete set null,
  organiser_id uuid references public.organisers(id) on delete set null,
  listing_title text not null default '',
  reporter_user_id uuid references auth.users(id) on delete set null,
  reporter_email text,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed'))
);

create index if not exists idx_listing_reports_status_created
  on public.listing_reports(status, created_at desc);
