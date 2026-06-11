# Stripe checkout → registrations (Priority 1)

End-to-end flow: attendee buys on event page → Stripe Payment Link → webhook creates `registrations` row → confirmation email → ticket appears on `/account/`.

## 1. Supabase migrations

Run once in [Supabase SQL Editor](https://supabase.com/dashboard):

| Migration | Purpose |
|-----------|---------|
| `025_organiser_creation_schema.sql` | Event/ticket columns |
| `026_attendee_profile_fields.sql` | Attendee profile |
| `027_email_templates.sql` | `booking_confirmation` template |
| `034_registrations_checkout_session.sql` | Idempotent checkout session IDs |
| `038_registrations_quantity.sql` | Multi-ticket quantity per registration |
| `067_organiser_cancel_connect.sql` | Organiser cancel alert email + Stripe Connect columns on `organisers` |

## 2. Vercel environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `SUPABASE_URL` | Yes | |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Webhook inserts registrations |
| `SUPABASE_ANON_KEY` | Yes | Sign-in before checkout |
| `SESSION_SECRET` | Yes | Auth cookies |
| `SITE_URL` | Yes | Email links, e.g. `https://the-networker-hub.vercel.app` |
| `STRIPE_SECRET_KEY` | **Yes (paid checkout)** | `sk_test_…` or `sk_live_…` — creates Checkout with booking fee |
| `STRIPE_CONNECT_ENABLED` | No (off by default) | Set `true` to route ticket revenue to organiser Connect accounts (destination charges) |
| `STRIPE_WEBHOOK_SECRET` | **Yes (prod)** | From Stripe webhook endpoint |
| `RESEND_API_KEY` | **Yes (emails)** | All transactional mail (bookings, welcome, reminders, saved events) |
| `RESEND_FROM` | **Yes (emails)** | Verified sender, e.g. `The Networker Hub <hello@the-networker.co.uk>` |
| `CRON_SECRET` | **Yes (production)** | Long random string — Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` |

**Local test sends:** copy `RESEND_API_KEY` and `RESEND_FROM` from Vercel into `local.env`, run `npm run sync-env`, restart `npm start`.

**Cron jobs** (hourly, see `vercel.json`):

| Path | Purpose |
|------|---------|
| `/api/cron/booking-reminders` | 24-hour event reminders |
| `/api/cron/favourite-sales` | Saved-event “tickets on sale” alerts |

Without `CRON_SECRET` in production, cron endpoints return `503 cron_secret_not_configured`.

Redeploy after changing env vars.

## 3. Stripe webhook

1. [Stripe Dashboard](https://dashboard.stripe.com) → **Developers → Webhooks**
2. **Add endpoint:** `https://the-networker-hub.vercel.app/api/stripe-webhook`
3. Events: **`checkout.session.completed`**
4. Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET` in Vercel

Local testing with Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

## 4. Paid checkout (booking fee)

When `STRIPE_SECRET_KEY` is set, **Buy ticket** calls `POST /api/auth/create-checkout`, which opens Stripe Checkout with:

- Ticket line item (price × quantity from Supabase)
- **Booking fee** line item (4.5% + 20p per ticket)

The attendee must be signed in. No manual fee math in Payment Links is required.

Use the **same mode** as your key: `sk_test_…` with test cards, `sk_live_…` for real payments.

## 5. Payment Links (fallback)

If `STRIPE_SECRET_KEY` is missing, the hub falls back to a static [Payment Link](https://dashboard.stripe.com/payment-links) — **booking fee is not added automatically** in that mode.

### Stripe Connect (optional)

When `STRIPE_CONNECT_ENABLED=true`:

1. Organisers complete Express onboarding from **Revenue → Connect Stripe** (`POST /api/organiser/stripe-connect`).
2. Paid ticket publish is blocked until Connect is ready (`charges_enabled` + details submitted).
3. Checkout uses **destination charges**: `application_fee_amount` = 3% of ticket subtotal + full booking fee (kept by the Hub); the remainder transfers to the organiser's connected account. Stripe processing (1.5% + 20p) is deducted by Stripe from the charge.

Leave `STRIPE_CONNECT_ENABLED` unset (or `false`) to keep the legacy single-account checkout while you roll out Connect.

Create a Payment Link per paid ticket (or one per event) only when needed as fallback.

**Required — choose one:**

- **Metadata (recommended):** In the Payment Link settings, add metadata:
  - `event_id` = Supabase `events.id` (UUID)
  - `ticket_id` = Supabase `tickets.id` (optional UUID)
- **OR hub checkout button:** Uses `client_reference_id` like `id<event-uuid>-ticket-<ticket-uuid>-qty-1-...` (parsed by webhook)

**Success URL:** set to:

```text
https://the-networker-hub.vercel.app/events/booking-success?session_id={CHECKOUT_SESSION_ID}
```

**Store the link in Supabase:**

```sql
update events set stripe_payment_link = 'https://buy.stripe.com/...' where id = '...';
-- or per ticket:
update tickets set stripe_payment_link = 'https://buy.stripe.com/...' where id = '...';
```

The event API exposes these as `stripePaymentLink` on events and tickets.

## 6. Free tickets

If a tier is **£0** and has no Payment Link, the hub calls `POST /api/auth/complete-booking` directly (attendee must be signed in).

## 7. Production test checklist

1. Sign in as an attendee on production
2. Open an event with `stripe_payment_link` set (or `?stripe=` on URL for testing)
3. Click **Buy ticket** → complete Stripe test/live payment
4. Land on `/events/booking-success`
5. Verify:
   - Row in Supabase `registrations`
   - Ticket on `/account/index.html`
   - `booking_confirmation` email received (if Resend configured)
   - Organiser receives `organiser_new_registration` (if organiser email set)

## 8. API reference

| Endpoint | Purpose |
|----------|---------|
| `POST /api/stripe-webhook` | Stripe → create registration |
| `POST /api/auth/create-checkout` | Stripe Checkout with ticket + booking fee (auth required) |
| `POST /api/auth/complete-booking` | Success page / free ticket fallback (auth required) |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Webhook 400 `invalid_signature` | Check `STRIPE_WEBHOOK_SECRET`; redeploy |
| Webhook `missing_event_id_metadata` | Add `event_id` metadata on Payment Link, or use hub Buy button |
| Buy button shows hint | Set `stripe_payment_link` on event/ticket, meta tag, or `?stripe=` |
| No confirmation email | Set `RESEND_API_KEY` + `RESEND_FROM`; run migration `027` |
| Registration exists but no email | Re-open success URL or check Resend logs; `ticket_email_sent` on row |
