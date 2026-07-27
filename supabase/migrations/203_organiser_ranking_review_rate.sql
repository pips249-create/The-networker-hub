-- Fairness tie-break: persist review rate (reviews / eligible attendees) on ranking entries

alter table public.organiser_ranking_entries
  add column if not exists eligible_attendees integer not null default 0;

alter table public.organiser_ranking_entries
  add column if not exists review_rate numeric(6, 4) not null default 0;

comment on column public.organiser_ranking_entries.eligible_attendees is
  'Paid/free approved ticket quantity for past events used as the review-rate denominator.';

comment on column public.organiser_ranking_entries.review_rate is
  'reviews / eligible_attendees (capped at 1). Used as the ranking tie-break after average rating.';
