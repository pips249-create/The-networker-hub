-- Member roster per organiser page + members_only ticket visibility.

alter table public.tickets
  drop constraint if exists tickets_visibility_check;

alter table public.tickets
  add constraint tickets_visibility_check
  check (visibility in ('public', 'members_only'));

comment on column public.tickets.visibility is
  'public = event page; members_only = roster members when signed in.';

create table if not exists public.organiser_member_roster (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organiser_id uuid not null references public.organisers(id) on delete cascade,
  email text not null,
  name text,
  expires_at date,
  status text not null default 'active'
    check (status in ('active', 'removed')),
  attendee_id uuid references public.attendees(id) on delete set null,
  invited_at timestamptz,
  claimed_at timestamptz,
  constraint organiser_member_roster_email_nonempty check (char_length(trim(email)) > 0)
);

create unique index if not exists organiser_member_roster_organiser_email_unique
  on public.organiser_member_roster (organiser_id, lower(email));

create index if not exists organiser_member_roster_organiser_status_idx
  on public.organiser_member_roster (organiser_id, status);

create index if not exists organiser_member_roster_expires_idx
  on public.organiser_member_roster (organiser_id, expires_at)
  where status = 'active' and expires_at is not null;

create index if not exists organiser_member_roster_attendee_idx
  on public.organiser_member_roster (attendee_id)
  where attendee_id is not null;

comment on table public.organiser_member_roster is
  'Per organiser page: member emails for members_only tickets and organiser reports.';

grant select, insert, update, delete on public.organiser_member_roster to service_role;
alter table public.organiser_member_roster enable row level security;
