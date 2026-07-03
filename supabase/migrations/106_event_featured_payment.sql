-- Track paid featured event listing amounts for revenue target reporting.

alter table public.events
  add column if not exists featured_plan text,
  add column if not exists featured_paid_at timestamptz,
  add column if not exists featured_amount_gbp numeric(10, 2);

comment on column public.events.featured_plan is
  'Stripe featured plan id (1week, 1month, 2months) from the most recent paid purchase.';
comment on column public.events.featured_paid_at is
  'When the most recent featured listing payment was received.';
comment on column public.events.featured_amount_gbp is
  'GBP amount of the most recent featured listing payment.';
