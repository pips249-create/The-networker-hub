-- Track when ticket-interest nudgers were emailed that sales are now open.
alter table public.event_ticket_sales_nudges
  add column if not exists notified_at timestamptz;

create index if not exists idx_event_ticket_sales_nudges_event_pending_notify
  on public.event_ticket_sales_nudges(event_id)
  where notified_at is null;

comment on column public.event_ticket_sales_nudges.notified_at is
  'When the visitor was emailed that ticket sales opened for this event.';
