-- Harden member-roster access after migrations 159-164 are already deployed.

-- Roster data is API-only. The service role remains the sole direct data path.
revoke all on table public.organiser_member_roster from anon, authenticated;

-- Application writes are normalized already; enforce that invariant for exact,
-- non-wildcard membership lookups.
update public.organiser_member_roster
set email = lower(trim(email))
where email <> lower(trim(email));

alter table public.organiser_member_roster
  drop constraint if exists organiser_member_roster_email_normalized;

alter table public.organiser_member_roster
  add constraint organiser_member_roster_email_normalized
  check (email = lower(trim(email)));

comment on table public.organiser_member_roster is
  'Many-to-many organiser membership junction. One row per organiser + normalized email; expires_at is scoped to that organiser membership.';

-- Anonymous/authenticated direct ticket reads must never reveal member tiers.
drop policy if exists "Public can view tickets for approved events" on public.tickets;

create policy "Public can view public tickets for approved events"
  on public.tickets for select
  using (
    coalesce(visibility, 'public') = 'public'
    and exists (
      select 1
      from public.events e
      where e.id = event_id
        and e.approval_status = 'Approved'
    )
  );

-- Public browse prices must not include members-only rates.
create or replace function public.refresh_event_min_ticket_price()
returns trigger
language plpgsql
as $$
declare
  target_event_id uuid;
begin
  target_event_id := coalesce(new.event_id, old.event_id);
  update public.events e
  set min_ticket_price = coalesce(
    (
      select min(coalesce(t.price, 0))::numeric
      from public.tickets t
      where t.event_id = target_event_id
        and coalesce(t.visibility, 'public') = 'public'
    ),
    0
  )
  where e.id = target_event_id;
  return coalesce(new, old);
end;
$$;

update public.events e
set min_ticket_price = coalesce(
  (
    select min(coalesce(t.price, 0))::numeric
    from public.tickets t
    where t.event_id = e.id
      and coalesce(t.visibility, 'public') = 'public'
  ),
  0
);
