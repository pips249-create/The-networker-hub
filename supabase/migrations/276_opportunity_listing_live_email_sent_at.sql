-- Send-once guard for "Your opportunity is live" emails.
-- Prevents duplicates when payment activation and admin Approve both fire.

alter table public.business_opportunities
  add column if not exists listing_live_email_sent_at timestamptz;

comment on column public.business_opportunities.listing_live_email_sent_at is
  'When the opportunity_listing_live email was sent. Cleared when payment lapses so a later re-activation can notify once.';
