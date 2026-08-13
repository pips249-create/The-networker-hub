-- Organiser-page scoped attendance blocks: stop a person booking future events
-- for that organiser page (not a platform-wide ban).

create table if not exists public.organiser_attendee_blocks (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organiser_id uuid not null references public.organisers(id) on delete cascade,
  email text not null,
  attendee_id uuid references public.attendees(id) on delete set null,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'removed')),
  constraint organiser_attendee_blocks_email_nonempty check (char_length(trim(email)) > 0),
  constraint organiser_attendee_blocks_email_normalized check (email = lower(trim(email))),
  constraint organiser_attendee_blocks_reason_len check (
    reason is null or char_length(reason) <= 500
  )
);

create unique index if not exists organiser_attendee_blocks_organiser_email_unique
  on public.organiser_attendee_blocks (organiser_id, email);

create index if not exists organiser_attendee_blocks_organiser_status_idx
  on public.organiser_attendee_blocks (organiser_id, status);

create index if not exists organiser_attendee_blocks_attendee_idx
  on public.organiser_attendee_blocks (attendee_id)
  where attendee_id is not null;

comment on table public.organiser_attendee_blocks is
  'Per organiser page: emails blocked from booking that organiser''s future events. Soft status; service-role / API only.';

grant select, insert, update, delete on public.organiser_attendee_blocks to service_role;
alter table public.organiser_attendee_blocks enable row level security;
revoke all on table public.organiser_attendee_blocks from anon, authenticated;
