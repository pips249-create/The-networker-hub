-- Backfill event_cancellations.details when the table predates 008/120 column lists.

alter table public.event_cancellations
  add column if not exists details text;

comment on column public.event_cancellations.details is
  'Optional organiser or admin notes explaining the cancellation.';
