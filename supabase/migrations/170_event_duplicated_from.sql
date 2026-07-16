-- Track draft copies created via Duplicate event so title guards stay separate from the source series.

alter table public.events
  add column if not exists duplicated_from_event_id uuid references public.events(id) on delete set null;

comment on column public.events.duplicated_from_event_id is
  'Set on draft copies from Duplicate event. Cleared once the organiser renames the listing away from the default “(copy)” title.';

create index if not exists events_duplicated_from_event_id_idx
  on public.events (duplicated_from_event_id)
  where duplicated_from_event_id is not null;
