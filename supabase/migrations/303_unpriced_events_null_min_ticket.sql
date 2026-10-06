-- A missing public ticket is not a free event. min_ticket_price stays null until
-- a public tier exists, so browse "Free" (min_ticket_price = 0) no longer
-- includes listings where the visitor has to ask the organiser for the price.

alter table public.events
  alter column min_ticket_price drop not null;

alter table public.events
  alter column min_ticket_price set default null;

create or replace function public.refresh_event_min_ticket_price()
returns trigger
language plpgsql
as $$
declare
  target_event_id uuid;
begin
  target_event_id := coalesce(new.event_id, old.event_id);
  update public.events e
  set min_ticket_price = (
    select min(coalesce(t.price, 0))::numeric
    from public.tickets t
    where t.event_id = target_event_id
      and coalesce(t.visibility, 'public') = 'public'
      and coalesce(t.ticket_type, '') <> 'Alumni'
  )
  where e.id = target_event_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists tickets_refresh_event_min_price on public.tickets;

create trigger tickets_refresh_event_min_price
after insert or update of price, event_id, visibility, ticket_type or delete on public.tickets
for each row
execute function public.refresh_event_min_ticket_price();

update public.events e
set min_ticket_price = (
  select min(coalesce(t.price, 0))::numeric
  from public.tickets t
  where t.event_id = e.id
    and coalesce(t.visibility, 'public') = 'public'
    and coalesce(t.ticket_type, '') <> 'Alumni'
);
