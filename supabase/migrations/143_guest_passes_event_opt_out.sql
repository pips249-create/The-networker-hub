-- Per-event opt-out: organisers can disallow complimentary guest passes on specific events.

alter table public.events
  add column if not exists guest_passes_disabled boolean not null default false;

comment on column public.events.guest_passes_disabled is
  'When true, complimentary guest passes are not offered on this event (member tickets remain available).';
