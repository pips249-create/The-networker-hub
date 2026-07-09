-- Unify fragmented same-title listings into one series_group_id and align recurrence metadata.

with active_titles as (
  select organiser_id, lower(trim(title)) as title_key
  from public.events
  where status not in ('archived', 'cancelled')
  group by organiser_id, lower(trim(title))
  having count(*) > 1
),
canonical as (
  select
    e.organiser_id,
    lower(trim(e.title)) as title_key,
    coalesce(
      (array_agg(e.series_group_id) filter (where e.series_group_id is not null))[1],
      gen_random_uuid()
    ) as series_id,
    (array_agg(e.recurrence_pattern) filter (where e.recurrence_pattern is not null))[1] as pattern,
    max(e.recurrence_end_date) filter (where e.recurrence_end_date is not null) as end_date
  from public.events e
  inner join active_titles a
    on e.organiser_id = a.organiser_id
   and lower(trim(e.title)) = a.title_key
  where e.status not in ('archived', 'cancelled')
  group by e.organiser_id, lower(trim(e.title))
)
update public.events e
set
  series_group_id = c.series_id,
  recurrence_pattern = coalesce(e.recurrence_pattern, c.pattern),
  recurrence_end_date = coalesce(e.recurrence_end_date, c.end_date)
from canonical c
where e.organiser_id = c.organiser_id
  and lower(trim(e.title)) = c.title_key
  and e.status not in ('archived', 'cancelled')
  and (
    e.series_group_id is distinct from c.series_id
    or e.recurrence_pattern is null
    or e.recurrence_end_date is null
  );
