-- Business opportunity listing fee — monthly Stripe subscription id

alter table public.business_opportunities
  add column if not exists listing_stripe_subscription_id text;

comment on column public.business_opportunities.listing_stripe_subscription_id is
  'Active Stripe subscription for the £25/month + VAT directory listing fee.';

create unique index if not exists business_opportunities_listing_stripe_subscription_uidx
  on public.business_opportunities (listing_stripe_subscription_id)
  where listing_stripe_subscription_id is not null;
