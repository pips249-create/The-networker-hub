-- Attend interest for Link Out / email-to-book events (hub-mediated enquiry).
create table if not exists public.event_attend_enquiries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  organiser_id uuid references public.organisers(id) on delete set null,
  organiser_email text not null,
  attendee_name text not null,
  attendee_email text not null,
  message text,
  source text not null default 'link_out_email'
    check (source in ('link_out_email', 'link_out', 'manual')),
  created_at timestamptz not null default now()
);

create index if not exists event_attend_enquiries_event_id_idx
  on public.event_attend_enquiries (event_id, created_at desc);

create index if not exists event_attend_enquiries_organiser_email_idx
  on public.event_attend_enquiries (lower(organiser_email));

create index if not exists event_attend_enquiries_attendee_email_idx
  on public.event_attend_enquiries (lower(attendee_email), event_id);

alter table public.event_attend_enquiries enable row level security;

revoke all on table public.event_attend_enquiries from anon, authenticated;
grant select, insert, update, delete on table public.event_attend_enquiries to service_role;
