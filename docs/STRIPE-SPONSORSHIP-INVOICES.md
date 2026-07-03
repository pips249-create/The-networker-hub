# Stripe invoices — sponsorship & advertising revenue

Sponsorship and advertising deals invoiced through Stripe are logged automatically in **Command Centre → Revenue targets** when the invoice is paid.

## Setup (one time)

1. Run migration `107_hub_revenue_stripe.sql` in Supabase (after `105_hub_revenue_deals.sql`).
2. In [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks), add **`invoice.paid`** to your existing endpoint:
   - `https://the-networker-hub.vercel.app/api/stripe-webhook`
3. Redeploy so the updated webhook handler is live.

`checkout.session.completed` is already enabled — it also records sponsorship if you use Stripe Checkout / Payment Links with the metadata below.

## Creating an invoice in Stripe

When you create an invoice for a sponsor, add **metadata** on the invoice (Stripe Dashboard → Invoice → Additional options → Metadata, or via API).

### Required — pick one way to set the category

| Metadata key | Example value | Maps to target |
|--------------|---------------|----------------|
| `revenue_category` | `events` | Events advertising (£42,500) |
| `revenue_category` | `opportunities` | Business opportunities |
| `revenue_category` | `browse_organisers` | Browse organisers page |
| `revenue_category` | `awards` | Awards |

**Or** use `placement` instead of `revenue_category`:

| `placement` value | Category |
|-------------------|----------|
| `events_main_sponsor` | events |
| `events_mini_sponsor` | events |
| `opportunities_main_sponsor` | opportunities |
| `opportunities_mini_sponsor` | opportunities |
| `organisers_main_sponsor` | browse_organisers |
| `awards_sponsor` | awards |

**Or** use `cms_slot` (matches Command Centre sponsorship slots):

| `cms_slot` | Category |
|------------|----------|
| `events_sponsor_hub` | events |
| `event_page_carousel_ads` | events |
| `opportunities_sponsor_hub` | opportunities |
| `organisers_sponsor_hub` | browse_organisers |

### Optional metadata

| Key | Purpose |
|-----|---------|
| `source_label` | Display name in Revenue targets (e.g. `Acme Ltd — Jul 2026 main sponsor`) |
| `cms_slot` | Link to sponsorship placement in Command Centre |

If `source_label` is omitted, the hub uses the customer name and line description.

## Example (Stripe Dashboard)

**Main Events Directory Sponsor — £2,000**

```
revenue_category = events
placement = events_main_sponsor
source_label = Acme Ltd — August 2026 directory sponsor
cms_slot = events_sponsor_hub
```

### Guide rates (Jul 2026)

| Placement | Section | Guide price |
|-----------|---------|-------------|
| Main directory sponsor | Events | £2,000 / month |
| Mini sponsor (max 3 slots) | Events | £600 / slot / month |
| Premium Spotlight | Events (organiser self-serve) | £55 / month |
| Main directory sponsor | Organisers browse | £1,000 / month |
| Mini sponsor (max 3 slots) | Organisers browse | £300 / slot / month |
| Premium Spotlight | Organisers (contact sales) | £27.50 / month |
| Main directory sponsor | Business opportunities | £2,000 / month |
| Mini sponsor (max 3 slots) | Opportunities | £600 / slot / month |
| Directory listing | Opportunities (self-serve) | £25 / month + VAT |
| Premium Spotlight | Opportunities (self-serve) | £55 / month |

Self-serve Stripe checkouts (featured events, opportunity listing, opportunity premium) use dynamic `price_data` in code — update `STRIPE_OPPORTUNITY_PREMIUM_PRICE_ID` in Vercel if you use a fixed Stripe Price object (set to £55/month).

## What happens when the invoice is paid

1. Stripe sends `invoice.paid` to `/api/stripe-webhook`.
2. The hub checks metadata and inserts a row into `hub_revenue_deals`.
3. Revenue targets and charts update on the next page load.
4. Duplicate webhook deliveries are ignored (idempotent on `stripe_invoice_id`).

## What is **not** logged via this flow

These are already tracked from other Stripe checkouts — **do not** add sponsorship metadata to them:

| Flow | Tracked via |
|------|-------------|
| Ticket booking fees | `registrations` + booking fee calculation |
| Opportunity listing fee | `business_opportunities.listing_paid_at` |
| Opportunity premium subscription | Premium listing state |
| Event featured spotlight | `events.featured_paid_at` |

Subscription renewal invoices for organiser premium listings are **skipped** unless you add `revenue_category` (they are not sponsorship).

## Checkout / Payment Links (alternative to invoices)

For one-off sponsor payments via Payment Link or Checkout, set session metadata:

```
checkout_type = hub_sponsorship
revenue_category = events
source_label = Acme Ltd — Q3 sponsor
```

## Refunds and voids

Stripe-synced rows cannot be deleted in Command Centre. Void or credit the invoice in Stripe; adjust targets manually if needed until refund webhooks are wired for revenue deals.

## Local testing

```bash
stripe listen --forward-to localhost:3000/api/stripe-webhook
stripe trigger invoice.paid
```

For a realistic test, create a test invoice in Stripe with metadata and mark it paid.
