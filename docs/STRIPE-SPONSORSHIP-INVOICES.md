# Stripe invoices — sponsorship & advertising revenue

Sponsorship and advertising deals invoiced through Stripe are logged automatically in **Command Centre → Revenue targets** when the invoice is paid.

## Setup (one time)

1. Run migration `107_hub_revenue_stripe.sql` in Supabase (after `105_hub_revenue_deals.sql`).
2. In [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks), add **`invoice.paid`** to your existing endpoint:
   - `https://www.thenetworkeruk.com/api/stripe-webhook`
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

### City Partner (self-serve)

City Partner checkout supports two billing modes:

| Mode | Stripe Checkout | Behaviour |
|------|-----------------|-----------|
| **Monthly** (default) | `mode: subscription` | Rolling monthly until cancelled |
| **Prepaid 1 / 3 / 6 / 12 months** | `mode: payment` | One-time charge; slot held until term end |

Enable these webhook events on the same endpoint:

| Event | Purpose |
|-------|---------|
| `checkout.session.completed` | Reserve city slots after payment; send sponsor welcome email |
| `customer.subscription.updated` | When `cancel_at_period_end` is set, store the slot open date and email waitlist “opening soon” |
| `customer.subscription.deleted` | Release slots and email waitlist “slot open” |

Prepaid holds use `sponsor_subscription_id` prefixed with `prepaid:` and `sponsor_available_from` set to the term end. The featured-listing cron also clears expired prepaid city slots.

Prepaid discounts: **5% off 3 months**, **10% off 6 months**, **15% off yearly (12 months)** (monthly and 1-month prepaid stay full rate).

Run Supabase migrations `189_city_partner_waitlist.sql` and `190_city_partner_emails.sql` before go-live.

Checkout metadata uses `placement=city_partner`, `networking_cities` (comma-separated slugs), `billing_mode` (`monthly` \| `prepaid`), and `term_months` (`monthly` or `1`/`3`/`6`/`12`). Slot state is stored on `cms_blocks` (`sponsor_subscription_id`, `sponsor_email`, `sponsor_available_from`).

### Manual placements (Headline / Page Partner)

In Command Centre → **Ads & sponsors**:

| Placement | Field | Behaviour |
|-----------|-------|-----------|
| Headline heroes | **Placement ends (UTC)** | Stored as `cms_blocks.sponsor_available_from`. After this date the ad stops showing and is deactivated by cron. |
| Page Partner mini slots | **Placement ends (UTC)** per ad | Stored as `ends_at` on each carousel ad in the slot JSON. Expired ads are hidden and deactivated by cron. |

Use the +1 / +3 / +6 / +12 month presets when logging an offline deal. Leave blank for no automatic end.

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

If `source_label` is omitted, The Networker UK uses the customer name and line description.

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
| Premium Spotlight | Events (organiser self-serve) | £55 one-time (until event / up to 30 days) |
| Main directory sponsor | Organisers browse | £1,000 / month |
| Mini sponsor (max 3 slots) | Organisers browse | £300 / slot / month |
| Premium Spotlight | Organisers (contact sales) | £27.50 one-time (up to 30 days) |
| Main directory sponsor | Business opportunities | £2,000 / month |
| Mini sponsor (max 3 slots) | Opportunities | £600 / slot / month |
| Directory listing | Opportunities (self-serve) | £25 / month + VAT |
| Premium Spotlight | Opportunities (self-serve) | £55 one-time (up to 30 days) |

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
| `STRIPE_EVENT_FEATURED_1MONTH_PRICE_ID` | Featured event £55 one-time (organiser checkout) |
| `STRIPE_OPPORTUNITY_PREMIUM_PRICE_ID` | Premium opportunity £55 one-time |
| `STRIPE_ORGANISER_FEATURED_PRICE_ID` / `_PAYMENT_LINK` | Featured organiser profile £27.50 one-time |

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
| Opportunity premium spotlight | Premium listing state (one-time, up to 30 days) |
| Event featured spotlight | `events.featured_paid_at` |

Organiser featured boost is booked via enquiry / one-time payment link (not a recurring subscription).

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
