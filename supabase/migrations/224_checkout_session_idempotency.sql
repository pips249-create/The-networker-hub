-- Idempotency keys for paid entitlement activation (Stripe webhook retries).

alter table public.business_opportunities
  add column if not exists premium_stripe_session_id text;

comment on column public.business_opportunities.premium_stripe_session_id is
  'Stripe Checkout session id that last activated opportunity premium; blocks replay extensions.';

create unique index if not exists business_opportunities_premium_stripe_session_uidx
  on public.business_opportunities (premium_stripe_session_id)
  where premium_stripe_session_id is not null;

create unique index if not exists business_opportunities_listing_stripe_session_uidx
  on public.business_opportunities (listing_stripe_session_id)
  where listing_stripe_session_id is not null;

alter table public.events
  add column if not exists featured_stripe_session_id text;

comment on column public.events.featured_stripe_session_id is
  'Stripe Checkout session id that last activated featured listing; blocks replay extensions.';

create unique index if not exists events_featured_stripe_session_uidx
  on public.events (featured_stripe_session_id)
  where featured_stripe_session_id is not null;
