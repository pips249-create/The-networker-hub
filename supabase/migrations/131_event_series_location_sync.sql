-- Copy the best geocoded location in each series to every sibling date.

with ranked as (
  select
    e.id,
    e.series_group_id,
    e.venue,
    e.address,
    e.city,
    e.postcode,
    e.location_label,
    e.latitude,
    e.longitude,
    e.outcode,
    row_number() over (
      partition by e.series_group_id
      order by
        case when e.latitude is not null and e.longitude is not null then 0 else 1 end,
        case when nullif(trim(e.postcode), '') is not null then 0 else 1 end,
        case when nullif(trim(e.address), '') is not null then 0 else 1 end,
        e.created_at desc
    ) as rn
  from public.events e
  where e.series_group_id is not null
    and e.status not in ('archived', 'cancelled')
),
canonical as (
  select *
  from ranked
  where rn = 1
)
update public.events e
set
  venue = coalesce(nullif(trim(e.venue), ''), c.venue),
  address = coalesce(nullif(trim(e.address), ''), c.address),
  city = coalesce(nullif(trim(e.city), ''), c.city),
  postcode = coalesce(nullif(trim(e.postcode), ''), c.postcode),
  location_label = coalesce(nullif(trim(e.location_label), ''), c.location_label),
  latitude = coalesce(e.latitude, c.latitude),
  longitude = coalesce(e.longitude, c.longitude),
  outcode = coalesce(nullif(trim(e.outcode), ''), c.outcode)
from canonical c
where e.series_group_id = c.series_group_id
  and e.status not in ('archived', 'cancelled')
  and (
    e.latitude is null
    or e.longitude is null
    or nullif(trim(e.postcode), '') is null
    or nullif(trim(e.address), '') is null
  );
