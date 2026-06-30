-- Business opportunity listing fees (£20/month + VAT, prepaid term)

alter table public.business_opportunities
  add column if not exists listing_months integer,
  add column if not exists listing_paid_at timestamptz,
  add column if not exists listing_expires_at timestamptz,
  add column if not exists listing_stripe_session_id text;

create index if not exists business_opportunities_listing_expires_idx
  on public.business_opportunities (listing_expires_at)
  where status = 'published';
