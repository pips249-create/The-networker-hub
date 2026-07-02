-- Dietary and accessibility answers collected at open-ticket checkout
alter table public.registrations
  add column if not exists dietary_requirements text,
  add column if not exists accessibility_requirements text;

comment on column public.registrations.dietary_requirements is
  'Primary booker dietary requirements when the event collects them at checkout';

comment on column public.registrations.accessibility_requirements is
  'Primary booker accessibility requirements when the event collects them at checkout';
