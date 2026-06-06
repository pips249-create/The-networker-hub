-- Saved events for attendees (browse hearts + My Hub). Email reminders wired via API/cron later.

create table if not exists public.event_favourites (
  id           uuid primary key default uuid_generate_v4(),
  created_at   timestamptz not null default now(),
  attendee_id  uuid not null references public.attendees(id) on delete cascade,
  event_id     uuid not null references public.events(id) on delete cascade,
  notify_email boolean not null default true,
  reminded_at  timestamptz,
  unique (attendee_id, event_id)
);

create index if not exists event_favourites_attendee_idx on public.event_favourites(attendee_id);
create index if not exists event_favourites_event_idx on public.event_favourites(event_id);

alter table public.event_favourites enable row level security;

grant select, insert, update, delete on public.event_favourites to service_role;
