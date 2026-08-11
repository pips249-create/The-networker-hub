-- Public "send us your event details" intake from /add-your-event.
-- Staff create the real event in Command Centre from these submissions.

create table if not exists public.event_intake_submissions (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  email text not null,
  group_name text not null,
  event_title text not null,
  event_dates text not null,
  start_time text,
  end_time text,
  format text not null default 'In person',
  venue text,
  address_line1 text,
  city text,
  postcode text,
  meeting_link text,
  pricing text not null default 'Free',
  ticket_details text,
  description text,
  photo_url text,
  notes text,
  status text not null default 'open'
    check (status in ('open', 'done', 'spam')),
  source text not null default 'add_your_event',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);

create index if not exists event_intake_submissions_created_at_idx
  on public.event_intake_submissions (created_at desc);

create index if not exists event_intake_submissions_status_idx
  on public.event_intake_submissions (status, created_at desc);

create index if not exists event_intake_submissions_email_idx
  on public.event_intake_submissions (lower(email), created_at desc);

comment on table public.event_intake_submissions is
  'Organiser-submitted event details from /add-your-event for staff to list on their behalf.';

alter table public.event_intake_submissions enable row level security;

revoke all on table public.event_intake_submissions from anon, authenticated;
grant select, insert, update, delete on table public.event_intake_submissions to service_role;
