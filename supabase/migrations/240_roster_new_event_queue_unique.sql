-- Prevent re-queuing the same member new-event alert after it has already been
-- processed. The previous unique index only covered pending rows, so the daily
-- listing-alerts catch-up could insert fresh queue rows and double/triple-send.

-- Keep one row per (kind, roster_member_id, event_id) for new_event.
with ranked as (
  select
    id,
    row_number() over (
      partition by kind, roster_member_id, event_id
      order by
        case when sent_at is not null then 0 else 1 end,
        coalesce(sent_at, created_at) asc nulls last,
        created_at asc
    ) as rn
  from public.organiser_roster_email_queue
  where kind = 'new_event'
    and event_id is not null
)
delete from public.organiser_roster_email_queue q
using ranked r
where q.id = r.id
  and r.rn > 1;

drop index if exists public.organiser_roster_email_queue_pending_unique;

create unique index if not exists organiser_roster_email_queue_pending_unique
  on public.organiser_roster_email_queue (
    kind,
    roster_member_id,
    coalesce(event_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where sent_at is null and failed_at is null
    and kind in ('invite', 'booking_reminder', 'pay_invite');

create unique index if not exists organiser_roster_email_queue_new_event_unique
  on public.organiser_roster_email_queue (roster_member_id, event_id)
  where kind = 'new_event' and event_id is not null;
