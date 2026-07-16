-- Staggered member-list emails (invites, new-event alerts, booking reminders).

create table if not exists public.organiser_roster_email_queue (
  id               uuid primary key default uuid_generate_v4(),
  created_at       timestamptz not null default now(),
  scheduled_for    timestamptz not null default now(),
  sent_at          timestamptz,
  failed_at        timestamptz,
  last_error       text,
  kind             text not null
    check (kind in ('invite', 'new_event', 'booking_reminder')),
  organiser_id     uuid not null references public.organisers(id) on delete cascade,
  roster_member_id uuid not null references public.organiser_member_roster(id) on delete cascade,
  event_id         uuid references public.events(id) on delete cascade,
  constraint organiser_roster_email_queue_event_required check (
    kind = 'invite' or event_id is not null
  )
);

create index if not exists organiser_roster_email_queue_due_idx
  on public.organiser_roster_email_queue (scheduled_for)
  where sent_at is null and failed_at is null;

create index if not exists organiser_roster_email_queue_organiser_idx
  on public.organiser_roster_email_queue (organiser_id, created_at desc);

create unique index if not exists organiser_roster_email_queue_pending_unique
  on public.organiser_roster_email_queue (
    kind,
    roster_member_id,
    coalesce(event_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where sent_at is null and failed_at is null;

comment on table public.organiser_roster_email_queue is
  'Outbound member-list emails processed by cron in small batches.';

grant select, insert, update, delete on public.organiser_roster_email_queue to service_role;
alter table public.organiser_roster_email_queue enable row level security;
