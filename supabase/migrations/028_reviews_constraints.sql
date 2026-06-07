-- One review per attendee per event; keep organiser profile ratings in sync

create unique index if not exists reviews_attendee_event_unique_idx
  on public.reviews (attendee_id, event_id)
  where attendee_id is not null and event_id is not null;

create or replace function update_organiser_rating()
returns trigger as $$
declare
  oid uuid;
begin
  oid := coalesce(new.organiser_id, old.organiser_id);
  if oid is null then
    return coalesce(new, old);
  end if;

  update public.organisers
  set
    average_rating = coalesce((
      select round(avg(rating)::numeric, 2)
      from public.reviews
      where organiser_id = oid and rating is not null
    ), 0),
    review_count = (
      select count(*)
      from public.reviews
      where organiser_id = oid
    )
  where id = oid;

  return coalesce(new, old);
end;
$$ language plpgsql;

drop trigger if exists trg_update_organiser_rating on public.reviews;
create trigger trg_update_organiser_rating
  after insert or update or delete on public.reviews
  for each row execute function update_organiser_rating();

-- Backfill organiser ratings from existing reviews
update public.organisers o
set
  average_rating = coalesce((
    select round(avg(r.rating)::numeric, 2)
    from public.reviews r
    where r.organiser_id = o.id and r.rating is not null
  ), 0),
  review_count = (
    select count(*)
    from public.reviews r
    where r.organiser_id = o.id
  );
