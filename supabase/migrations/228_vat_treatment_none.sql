-- Allow organisers who are not VAT-registered to declare no VAT on tickets / memberships.
-- 'none' = not VAT registered; price shown is what the buyer pays; no VAT added.

alter table public.events
  drop constraint if exists events_vat_treatment_check;

alter table public.events
  add constraint events_vat_treatment_check
  check (vat_treatment is null or vat_treatment in ('included', 'added', 'none'));

comment on column public.events.vat_treatment is
  'included = listed price includes VAT; added = VAT added at checkout; none = not VAT registered / no VAT charged. Displayed on public listing.';

alter table public.organiser_membership_plans
  drop constraint if exists organiser_membership_plans_vat_treatment_check;

alter table public.organiser_membership_plans
  add constraint organiser_membership_plans_vat_treatment_check
  check (vat_treatment in ('included', 'added', 'none'));

comment on column public.organiser_membership_plans.vat_treatment is
  'included = membership price is final for the organiser supply; added = 20% VAT added on membership at checkout (organiser receives net + VAT); none = not VAT registered / no VAT charged.';
