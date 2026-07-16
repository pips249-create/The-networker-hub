-- Multi-date series bundle checkout: one payment, registrations on each date.

alter table public.registrations
  add column if not exists booking_group_id uuid;

create index if not exists idx_registrations_booking_group_id
  on public.registrations (booking_group_id)
  where booking_group_id is not null;

comment on column public.registrations.booking_group_id is
  'Links registrations created together by a series bundle checkout (one payment, all dates).';

alter table public.registrations
  drop constraint if exists registrations_registration_kind_check;

alter table public.registrations
  add constraint registrations_registration_kind_check
  check (registration_kind in ('standard', 'guest_visit', 'application', 'alumni', 'series_bundle'));
