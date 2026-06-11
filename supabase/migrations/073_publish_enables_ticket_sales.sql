-- Published events with ticket types should allow checkout (fixes nudge-only state after publish).

update public.events e
set ticket_sales_enabled = true
where e.status = 'published'
  and e.approval_status = 'Approved'
  and coalesce(e.ticket_sales_enabled, false) = false
  and exists (
    select 1
    from public.tickets t
    where t.event_id = e.id
  );

comment on column public.events.ticket_sales_enabled is
  'When false, the event may be listed but buyers cannot purchase until sales are enabled. Publish with tickets sets this true.';
