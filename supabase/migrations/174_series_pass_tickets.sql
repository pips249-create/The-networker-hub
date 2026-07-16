-- Full series pass: one ticket price covers every date in a multi-date listing.

alter table public.tickets
  add column if not exists series_scope text not null default 'date';

alter table public.tickets
  drop constraint if exists tickets_series_scope_check;

alter table public.tickets
  add constraint tickets_series_scope_check
  check (series_scope in ('date', 'series_pass'));

comment on column public.tickets.series_scope is
  'date = per-session ticket; series_pass = one price for all dates in the series.';

alter table public.registrations
  drop constraint if exists registrations_registration_kind_check;

alter table public.registrations
  add constraint registrations_registration_kind_check
  check (registration_kind in ('standard', 'guest_visit', 'application', 'alumni', 'series_bundle', 'series_pass'));
