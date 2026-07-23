-- Heal published listing-only events stuck in Pending Review (admin create regression).

update public.events e
set
  approval_status = 'Approved',
  published_at = coalesce(e.published_at, now())
where e.status = 'published'
  and e.approval_status = 'Pending Review'
  and e.starts_at is not null
  and not exists (
    select 1
    from public.tickets t
    where t.event_id = e.id
  );

comment on column public.events.approval_status is
  'Hub review state. Admin listing-only publishes are Approved on create; organiser publishes may stay Pending Review until tickets and refund terms are complete.';
