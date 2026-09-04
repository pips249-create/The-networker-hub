# How Stripe, tickets, and events work on The Networker UK

A plain-language guide for organisers and admins.

## The big picture

| Piece | What it does |
|-------|----------------|
| **Supabase** | Stores events, ticket types, prices, and who bought what |
| **Your Stripe account** | Takes card payments (one account for the whole hub today) |
| **The hub website** | Shows events, calculates booking fee, opens Stripe Checkout |
| **Stripe webhook** | Tells The Networker UK when payment succeeded → creates a registration |

You do **not** need a separate Stripe Payment Link per event anymore if `STRIPE_SECRET_KEY` is set on Vercel. The hub builds checkout automatically from ticket prices in Supabase.

**New events and ticket types:** When an organiser adds a paid ticket in the dashboard, nothing is created in Stripe manually. Publish the event with a price and optional **places available** (capacity) — checkout works on the next purchase as long as `STRIPE_SECRET_KEY` is configured on Vercel.

**Ticket capacity:** The “places available” field on each ticket type limits how many can be sold. The event page shows “X tickets remaining” when stock is low and caps the quantity selector to what is left.

---

## One Stripe account, many events

- All events share **your** Stripe account (test or live).
- Each checkout is a **Checkout Session** with line items built from the database:
  - Ticket × quantity (price from `tickets.price`)
  - Booking fee (4.5% + 20p per ticket)
- Money lands in the same Stripe balance; registrations in Supabase record which event and organiser each payment belongs to.

**Test vs live:** Use test API keys + test webhook in sandbox for fake cards. Use live keys for real money. Never mix test cards with live mode.

---

## Ticket types per event

When an organiser publishes an event they can add **multiple ticket tiers** in Supabase `tickets`, e.g.:

| Ticket | Price | Quantity cap |
|--------|-------|----------------|
| Early bird | £10 | 50 |
| Standard | £15 | 100 |
| VIP | £30 | 20 |

- Each row in `tickets` has its own `name`, `price`, and optional `quantity` (capacity).
- Attendees pick a tier on the event page and choose **how many** (up to what's left, max 99 per order).
- One checkout = **one registration row** with a `quantity` column (e.g. 3 × Standard).

**Sold out:** When registrations for a tier reach its `quantity`, that tier shows as sold out.

---

## Duplicating events and tickets

When an organiser **duplicates** an event (or copies ticket setup):

- A **new** `events` row is created (new UUID).
- **New** `tickets` rows are created linked to that event.
- Old `stripe_payment_link` values on the copy are **not** reused for checkout API mode — prices come from Supabase automatically.

If you still use Payment Link fallback (no `STRIPE_SECRET_KEY`), each paid event needs its own link in `events.stripe_payment_link` or `tickets.stripe_payment_link`. That mode does **not** add the booking fee automatically.

---

## What attendees see after paying

1. Branded **booking confirmed** page on The Networker UK
2. **Add to calendar** (Google, Outlook, .ics)
3. **Share** on LinkedIn, Facebook, X, WhatsApp
4. Ticket(s) on **My account** (`/account/`)
5. Confirmation email (when Resend is configured)

---

## Webhook (required)

Endpoint: `https://www.thenetworkeruk.com/api/stripe-webhook` (production domain — do not use `the-networker-hub.vercel.app`; it redirects and Stripe will not deliver)

Event: `checkout.session.completed`

Create this in **test** sandbox for testing and separately in **live** for production. Copy each signing secret to Vercel as `STRIPE_WEBHOOK_SECRET` (use the one that matches your `STRIPE_SECRET_KEY` mode).

---

## Migrations to run

| Migration | Purpose |
|-----------|---------|
| `034_registrations_checkout_session.sql` | Idempotent checkout sessions |
| `038_registrations_quantity.sql` | Multi-ticket quantity per registration |

---

## Organiser payouts (later)

Organiser revenue in reports uses the **ticket price only** (booking fee stripped from `amount_paid`). The **booking fee** (4.5% + 20p per ticket) is Hub revenue and covers platform + payment processing. With Connect enabled, organisers receive the full ticket price via destination charges.
