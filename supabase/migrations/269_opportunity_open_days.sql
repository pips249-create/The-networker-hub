-- Franchise / listing open days (separate from Hub events) + interest registrations.

create table if not exists public.opportunity_open_days (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.business_opportunities(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue_name text,
  address_line text not null,
  city text,
  postcode text,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists opportunity_open_days_opportunity_id_idx
  on public.opportunity_open_days (opportunity_id, starts_at);

create index if not exists opportunity_open_days_upcoming_idx
  on public.opportunity_open_days (starts_at);

create table if not exists public.opportunity_open_day_interests (
  id uuid primary key default gen_random_uuid(),
  open_day_id uuid not null references public.opportunity_open_days(id) on delete cascade,
  opportunity_id uuid not null references public.business_opportunities(id) on delete cascade,
  owner_email text,
  registrant_name text not null,
  registrant_email text not null,
  registrant_phone text,
  status text not null default 'new'
    check (status in ('new', 'read', 'responded')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  responded_at timestamptz
);

create index if not exists opportunity_open_day_interests_open_day_id_idx
  on public.opportunity_open_day_interests (open_day_id, created_at desc);

create index if not exists opportunity_open_day_interests_opportunity_id_idx
  on public.opportunity_open_day_interests (opportunity_id, created_at desc);

create index if not exists opportunity_open_day_interests_owner_email_idx
  on public.opportunity_open_day_interests (lower(owner_email));

create index if not exists opportunity_open_day_interests_status_idx
  on public.opportunity_open_day_interests (status, created_at desc);

alter table public.opportunity_open_days enable row level security;
alter table public.opportunity_open_day_interests enable row level security;

revoke all on table public.opportunity_open_days from anon, authenticated;
revoke all on table public.opportunity_open_day_interests from anon, authenticated;

grant select, insert, update, delete on public.opportunity_open_days to service_role;
grant select, insert, update, delete on public.opportunity_open_day_interests to service_role;

insert into public.email_templates (slug, name, description, subject, body_html, placeholders, category)
values
  (
    'opportunity_open_day_interest_received',
    'Open day interest — lister',
    'Sent to the listing owner when someone registers interest in an open day.',
    'Open day interest: {{registrant_name}} — {{opportunity_title}}',
    '<p>stub</p>',
    array[
      'owner_name',
      'opportunity_title',
      'registrant_name',
      'registrant_email',
      'registrant_phone',
      'registrant_phone_line',
      'open_day_summary',
      'open_day_date',
      'open_day_address',
      'dashboard_url',
      'reply_mailto_url',
      'opportunity_url',
      'site_url',
      'logo_url',
      'logo_footer_url',
      'privacy_url',
      'terms_url',
      'contact_url',
      'unsubscribe_url',
      'support_email'
    ],
    'opportunities'
  ),
  (
    'opportunity_open_day_interest_sent',
    'Open day interest — visitor ack',
    'Soft acknowledgement when a visitor registers interest in an open day.',
    'Thanks — we have received your open day interest — {{opportunity_title}}',
    '<p>stub</p>',
    array[
      'registrant_name',
      'opportunity_title',
      'opportunity_url',
      'open_day_summary',
      'open_day_date',
      'open_day_address',
      'lister_name',
      'site_url',
      'logo_url',
      'logo_footer_url',
      'privacy_url',
      'terms_url',
      'contact_url',
      'unsubscribe_url',
      'support_email'
    ],
    'opportunities'
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  placeholders = excluded.placeholders,
  category = excluded.category,
  updated_at = now();
