-- Which organiser (group) profiles use Connected booking slots on an account plan.

alter table public.organisers
  add column if not exists connected_booking_slot_assigned_at timestamptz;

comment on column public.organisers.connected_booking_slot_assigned_at is
  'When set, this group profile consumes one Connected booking plan slot on the organiser account.';

create index if not exists organisers_connected_booking_slot_idx
  on public.organisers (organiser_account_id)
  where connected_booking_slot_assigned_at is not null;
