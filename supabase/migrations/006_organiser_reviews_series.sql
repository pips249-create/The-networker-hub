-- Reviews belong on organiser profiles; link recurring event series

alter table public.organisers
  add column if not exists average_rating numeric(3, 2) default 0,
  add column if not exists review_count integer default 0;

alter table public.events
  add column if not exists recurrence_pattern text,
  add column if not exists recurrence_end_date date,
  add column if not exists series_group_id uuid;

alter table public.events drop constraint if exists events_recurrence_pattern_check;

alter table public.events add constraint events_recurrence_pattern_check check (
  recurrence_pattern is null
  or recurrence_pattern in (
    'Weekly', 'Bi-weekly', 'Monthly', 'Series',
    'weekly', 'bi-weekly', 'monthly', 'one-time'
  )
);

comment on column public.organisers.average_rating is 'Organiser profile rating (not per-event)';
comment on column public.events.series_group_id is 'Shared id for all dates in one recurring listing';
