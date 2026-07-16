-- event_cancellations may predate cancelled_by (008/120 use create table if not exists).

alter table public.event_cancellations
  add column if not exists refund_terms_confirmed boolean not null default false,
  add column if not exists refunds_confirmed_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null;

comment on column public.event_cancellations.cancelled_by is
  'Organiser user who confirmed the cancellation.';
