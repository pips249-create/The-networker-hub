-- Saved organisers for attendees (browse hearts + attendee dashboard).

create table if not exists public.organiser_favourites (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz not null default now(),
  attendee_id   uuid not null references public.attendees(id) on delete cascade,
  organiser_id  uuid not null references public.organisers(id) on delete cascade,
  unique (attendee_id, organiser_id)
);

create index if not exists organiser_favourites_attendee_idx on public.organiser_favourites(attendee_id);
create index if not exists organiser_favourites_organiser_idx on public.organiser_favourites(organiser_id);

alter table public.organiser_favourites enable row level security;

grant select, insert, update, delete on public.organiser_favourites to service_role;
