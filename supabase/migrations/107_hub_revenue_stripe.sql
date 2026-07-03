-- Link hub_revenue_deals to Stripe invoices / checkout for automatic sponsorship tracking.

alter table public.hub_revenue_deals
  add column if not exists source_type text not null default 'manual'
    check (source_type in ('manual', 'stripe_invoice', 'stripe_checkout')),
  add column if not exists stripe_invoice_id text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_customer_id text;

create unique index if not exists hub_revenue_deals_stripe_invoice_uidx
  on public.hub_revenue_deals (stripe_invoice_id)
  where stripe_invoice_id is not null;

create unique index if not exists hub_revenue_deals_stripe_checkout_uidx
  on public.hub_revenue_deals (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

comment on column public.hub_revenue_deals.source_type is
  'manual = Command Centre entry; stripe_invoice / stripe_checkout = auto from Stripe webhook.';
comment on column public.hub_revenue_deals.stripe_invoice_id is
  'Stripe invoice id (in_…) — idempotent key for invoice.paid webhook.';
