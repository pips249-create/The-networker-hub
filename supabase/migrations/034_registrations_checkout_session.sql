-- Idempotent Stripe checkout.session.completed handling

alter table public.registrations
  add column if not exists stripe_checkout_session_id text;

create unique index if not exists idx_registrations_stripe_checkout_session
  on public.registrations (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
