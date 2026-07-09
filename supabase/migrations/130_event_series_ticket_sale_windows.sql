-- Repair series listings: align recurrence metadata and reopen ticket sales per event date.

-- One recurrence end date per active series group.
with series_meta as (
  select
    series_group_id,
    (array_agg(recurrence_pattern) filter (where recurrence_pattern is not null))[1] as pattern,
    max(recurrence_end_date) as end_date
  from public.events
  where series_group_id is not null
    and status not in ('archived', 'cancelled')
  group by series_group_id
)
update public.events e
set
  recurrence_pattern = coalesce(e.recurrence_pattern, s.pattern),
  recurrence_end_date = s.end_date
from series_meta s
where e.series_group_id = s.series_group_id
  and e.status not in ('archived', 'cancelled')
  and (
    e.recurrence_end_date is distinct from s.end_date
    or e.recurrence_pattern is null
  );

-- Ticket sales closed before the event — extend sale end to event start.
update public.tickets t
set sale_ends_at = e.starts_at
from public.events e
where t.event_id = e.id
  and e.starts_at is not null
  and t.sale_ends_at is not null
  and t.sale_ends_at < e.starts_at
  and e.status = 'published'
  and e.approval_status = 'Approved';

-- Zero-price tiers on published series dates where siblings have a paid tier.
with series_prices as (
  select
    e.series_group_id,
    min(t.price) filter (where t.price > 0) as sibling_price
  from public.events e
  inner join public.tickets t on t.event_id = e.id
  where e.series_group_id is not null
    and e.status = 'published'
    and e.approval_status = 'Approved'
  group by e.series_group_id
  having min(t.price) filter (where t.price > 0) > 0
)
update public.tickets t
set price = sp.sibling_price
from public.events e
inner join series_prices sp on sp.series_group_id = e.series_group_id
where t.event_id = e.id
  and t.price = 0
  and e.status = 'published'
  and e.approval_status = 'Approved';
