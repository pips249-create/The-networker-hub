-- Allow "free to join" membership plans: group requires membership but charges nothing.
-- free_join = true means the plan is offered but no platform billing takes place.

alter table public.organiser_membership_plans
  add column if not exists free_join boolean not null default false;

-- Relax the has_price constraint to allow null amounts when free_join is true.
alter table public.organiser_membership_plans
  drop constraint if exists organiser_membership_plans_has_price;

alter table public.organiser_membership_plans
  add constraint organiser_membership_plans_has_price check (
    free_join = true
    or monthly_amount_pence is not null
    or annual_amount_pence is not null
  );

comment on column public.organiser_membership_plans.free_join is
  'True when group membership is required but free — no platform billing. Members still join via the member list.';
