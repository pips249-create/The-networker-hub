-- Keep organiser payout audit rows when empty events are hard-deleted.

alter table public.organiser_payouts
  add column if not exists event_title_snapshot text,
  add column if not exists event_archived_at timestamptz;

comment on column public.organiser_payouts.event_title_snapshot is
  'Event title preserved when the linked event row is deleted.';

alter table public.organiser_payouts
  alter column event_id drop not null;

alter table public.organiser_payouts
  drop constraint if exists organiser_payouts_event_id_fkey;

alter table public.organiser_payouts
  add constraint organiser_payouts_event_id_fkey
  foreign key (event_id) references public.events(id) on delete set null;
