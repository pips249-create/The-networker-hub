-- Repair cancellation/refund bookkeeping for revenue and dashboard visibility.

-- Backfill organiser_id on registrations where missing (organiser cancellations query).
update public.registrations r
set organiser_id = e.organiser_id
from public.events e
where r.event_id = e.id
  and r.organiser_id is null
  and e.organiser_id is not null;

-- Refunded bookings should always have cancelled_at for reporting.
update public.registrations
set cancelled_at = coalesce(cancelled_at, refund_email_sent_at, created_at, now())
where payment_status = 'Refunded'
  and cancelled_at is null;
