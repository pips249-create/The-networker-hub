-- Remove listings that have no ticket tiers and no bookings (not shown on public browse).
delete from public.events e
where not exists (
  select 1 from public.tickets t where t.event_id = e.id
)
and not exists (
  select 1 from public.registrations r where r.event_id = e.id
);
