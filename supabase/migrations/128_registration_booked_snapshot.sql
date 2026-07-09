-- Immutable booking snapshot at purchase — audit trail for disputes and chargebacks.

alter table public.registrations
  add column if not exists booked_snapshot jsonb;

comment on column public.registrations.booked_snapshot is
  'Point-in-time copy of event and ticket terms when the booking was completed (paid, free, or application lock-in).';

-- Best-effort backfill for existing rows from current event/ticket data (not a true historical record).
update public.registrations r
set booked_snapshot = jsonb_build_object(
  'v', 1,
  'captured_at', coalesce(r.created_at, now()),
  'backfill', true,
  'event', jsonb_build_object(
    'id', e.id,
    'title', e.title,
    'starts_at', e.starts_at,
    'ends_at', e.ends_at,
    'venue', e.venue,
    'city', e.city,
    'postcode', e.postcode,
    'location_label', coalesce(e.location_label, e.venue, e.city),
    'meeting_type', e.meeting_type,
    'meeting_link', e.meeting_link,
    'refund_policy', e.refund_policy,
    'refund_policy_details', e.refund_policy_details,
    'refund_cutoff_days', e.refund_cutoff_days,
    'vat_treatment', e.vat_treatment
  ),
  'ticket', (
    select jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'price', t.price
    )
    from public.tickets t
    where t.id = r.ticket_id
  ),
  'quantity', greatest(1, coalesce(r.quantity, 1)),
  'amount_paid', coalesce(r.amount_paid, 0),
  'payment_status', r.payment_status
)
from public.events e
where r.booked_snapshot is null
  and r.event_id = e.id
  and r.cancelled_at is null
  and coalesce(r.application_status, '') <> 'Denied';
