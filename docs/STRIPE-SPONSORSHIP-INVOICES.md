# Stripe invoices — sponsorship & advertising revenue

Sponsorship and advertising deals invoiced through Stripe are logged automatically in **Command Centre → Revenue targets** when the invoice is paid.

## Setup (one time)

1. Run migration `107_hub_revenue_stripe.sql` in Supabase (after `105_hub_revenue_deals.sql`).
2. In [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks), add **`invoice.paid`** to your existing endpoint:
   - `https://the-networker-hub.vercel.app/api/stripe-webhook`
3. Redeploy so the updated webhook handler is live.
4. **Sync Stripe products & prices** (automated — run once per Stripe mode):

```bash
# Test mode (sk_test_… in local.env)
npm run sync-stripe -- --write-local
npm run sync-env

# Production — use sk_live_… in local.env, then repeat and copy env vars to Vercel
npm run sync-stripe -- --write-local
```

This creates Products, Prices, and Payment Links for all sponsorship tiers and writes IDs into `local.env`. Copy the printed variables to Vercel. Re-run after any rate card change (old payment links are deactivated when prices change).

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

Self-serve Stripe checkouts use catalog Price IDs when env vars are set (run `npm run sync-stripe`). Opportunity listing fees stay dynamic (`price_data`) because the term length varies.

### Env vars created by `npm run sync-stripe`

| Env var | Purpose |
|---------|---------|
| `STRIPE_EVENTS_MAIN_SPONSOR_PRICE_ID` / `_PAYMENT_LINK` | Events main sponsor £2,000/mo |
| `STRIPE_EVENTS_MINI_SPONSOR_PRICE_ID` / `_PAYMENT_LINK` | Events mini sponsor £600/mo |
| `STRIPE_ORGANISERS_MAIN_SPONSOR_PRICE_ID` / `_PAYMENT_LINK` | Organisers main sponsor £1,000/mo |
| `STRIPE_ORGANISERS_MINI_SPONSOR_PRICE_ID` / `_PAYMENT_LINK` | Organisers mini sponsor £300/mo |
| `STRIPE_OPPORTUNITIES_MAIN_SPONSOR_PRICE_ID` / `_PAYMENT_LINK` | Opportunities main sponsor £2,000/mo |
| `STRIPE_OPPORTUNITIES_MINI_SPONSOR_PRICE_ID` / `_PAYMENT_LINK` | Opportunities mini sponsor £600/mo |
| `STRIPE_EVENT_FEATURED_1MONTH_PRICE_ID` | Featured event £55 (organiser checkout) |
| `STRIPE_OPPORTUNITY_PREMIUM_PRICE_ID` | Premium opportunity £55/mo |
| `STRIPE_ORGANISER_FEATURED_PRICE_ID` / `_PAYMENT_LINK` | Featured organiser profile £27.50/mo |

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
