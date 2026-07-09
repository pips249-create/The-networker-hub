-- Backfill events.locked for listings that already have active registrations.
update public.events e
set
  locked = true,
  locked_reason = coalesce(e.locked_reason, 'backfill_registrations'),
  locked_at = coalesce(e.locked_at, now())
where e.locked = false
  and exists (
    select 1
    from public.registrations r
    where r.event_id = e.id
      and r.cancelled_at is null
      and coalesce(r.payment_status, '') <> 'Refunded'
      and coalesce(r.application_status, '') <> 'Denied'
  );
