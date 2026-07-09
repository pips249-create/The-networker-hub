-- Link recurring event dates with a shared series_group_id so organiser dashboard
-- and the public event page group the same occurrences.

with series_keys as (
  select
    organiser_id,
    lower(trim(title)) as title_key,
    lower(trim(recurrence_pattern)) as pattern_key,
    recurrence_end_date,
    gen_random_uuid() as new_series_id
  from public.events
  where recurrence_pattern is not null
    and recurrence_end_date is not null
    and series_group_id is null
  group by organiser_id, lower(trim(title)), lower(trim(recurrence_pattern)), recurrence_end_date
  having count(*) > 1
)
update public.events e
set series_group_id = s.new_series_id
from series_keys s
where e.organiser_id = s.organiser_id
  and lower(trim(e.title)) = s.title_key
  and lower(trim(e.recurrence_pattern)) = s.pattern_key
  and e.recurrence_end_date = s.recurrence_end_date
  and e.series_group_id is null;

-- Same-title published listings without recurrence metadata (legacy imports).
with title_series as (
  select
    organiser_id,
    lower(trim(title)) as title_key,
    gen_random_uuid() as new_series_id
  from public.events
  where recurrence_pattern is null
    and recurrence_end_date is null
    and series_group_id is null
    and status = 'published'
    and approval_status = 'Approved'
  group by organiser_id, lower(trim(title))
  having count(*) > 1
)
update public.events e
set series_group_id = s.new_series_id
from title_series s
where e.organiser_id = s.organiser_id
  and lower(trim(e.title)) = s.title_key
  and e.recurrence_pattern is null
  and e.recurrence_end_date is null
  and e.series_group_id is null
  and e.status = 'published'
  and e.approval_status = 'Approved';
