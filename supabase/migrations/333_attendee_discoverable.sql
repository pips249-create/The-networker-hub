-- Hubert Matchmaker: opt-in discoverability for Hub members in BOH shortlists.

alter table public.attendees
  add column if not exists discoverable_at timestamptz,
  add column if not exists looking_to_meet text[] not null default '{}',
  add column if not exists matchmaker_blurb text;

create index if not exists attendees_discoverable_at_idx
  on public.attendees (discoverable_at desc)
  where discoverable_at is not null;

comment on column public.attendees.discoverable_at is
  'When set, member may appear in Hubert Matchmaker shortlists (opt-in).';
comment on column public.attendees.looking_to_meet is
  'Matchmaker tags: who they want to meet (Clients, Investors, …).';
comment on column public.attendees.matchmaker_blurb is
  'Optional short headline for Hubert matching (not a public bio page).';
