-- Flag events set up by admin while impersonating — organiser must review and accept terms.
alter table public.events
  add column if not exists needs_organiser_setup_review boolean not null default false;

comment on column public.events.needs_organiser_setup_review is
  'True when ticket setup was saved by an admin impersonating the organiser; cleared when the organiser accepts terms.';

create index if not exists events_needs_organiser_setup_review_idx
  on public.events (needs_organiser_setup_review)
  where needs_organiser_setup_review = true;
