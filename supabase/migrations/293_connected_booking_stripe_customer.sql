-- Stripe Billing Portal customer id for Connected booking subscriptions.

alter table public.organiser_accounts
  add column if not exists connected_booking_stripe_customer_id text;

comment on column public.organiser_accounts.connected_booking_stripe_customer_id is
  'Platform Stripe customer for Connected booking subscription (Billing Portal).';
