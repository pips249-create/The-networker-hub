-- Membership plan VAT treatment (organiser dues) — included vs added at checkout.
-- Hub fee VAT is always added in application code (platform is VAT-registered).

alter table public.organiser_membership_plans
  add column if not exists vat_treatment text not null default 'included';

alter table public.organiser_membership_plans
  drop constraint if exists organiser_membership_plans_vat_treatment_check;

alter table public.organiser_membership_plans
  add constraint organiser_membership_plans_vat_treatment_check
  check (vat_treatment in ('included', 'added'));

comment on column public.organiser_membership_plans.vat_treatment is
  'included = membership price is final for the organiser supply; added = 20% VAT added on membership at checkout (organiser receives net + VAT).';
