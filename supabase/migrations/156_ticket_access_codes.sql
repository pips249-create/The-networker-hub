-- Hidden ticket tiers unlocked by access codes (Eventbrite-style).

alter table public.tickets
  add column if not exists visibility text not null default 'public';

alter table public.tickets
  drop constraint if exists tickets_visibility_check;

alter table public.tickets
  add constraint tickets_visibility_check
  check (visibility in ('public', 'hidden'));

comment on column public.tickets.visibility is
  'public = shown on the event page; hidden = only visible after a valid access code.';

create table if not exists public.ticket_access_codes (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  event_id uuid not null references public.events(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  code text not null,
  max_uses integer,
  uses_count integer not null default 0,
  expires_at timestamptz,
  constraint ticket_access_codes_max_uses_positive check (max_uses is null or max_uses > 0)
);

create unique index if not exists ticket_access_codes_event_code_unique
  on public.ticket_access_codes (event_id, lower(code));

create unique index if not exists ticket_access_codes_ticket_unique
  on public.ticket_access_codes (ticket_id);

create index if not exists ticket_access_codes_event_id_idx
  on public.ticket_access_codes (event_id);

alter table public.registrations
  add column if not exists access_code_id uuid references public.ticket_access_codes(id) on delete set null;

comment on table public.ticket_access_codes is
  'Access codes that unlock hidden ticket tiers at checkout.';
