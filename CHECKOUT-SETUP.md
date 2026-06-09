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

## 2. Vercel environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `SUPABASE_URL` | Yes | |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Webhook inserts registrations |
| `SUPABASE_ANON_KEY` | Yes | Sign-in before checkout |
| `SESSION_SECRET` | Yes | Auth cookies |
| `SITE_URL` | Yes | Email links, e.g. `https://the-networker-hub.vercel.app` |
| `STRIPE_WEBHOOK_SECRET` | **Yes (prod)** | From Stripe webhook endpoint |
| `RESEND_API_KEY` | For emails | Booking confirmation |
| `RESEND_FROM` | For emails | Verified domain |

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

## 4. Payment Links

Create a [Payment Link](https://dashboard.stripe.com/payment-links) per paid ticket (or one per event).

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

## 5. Free tickets

If a tier is **£0** and has no Payment Link, the hub calls `POST /api/auth/complete-booking` directly (attendee must be signed in).

## 6. Production test checklist

1. Sign in as an attendee on production
2. Open an event with `stripe_payment_link` set (or `?stripe=` on URL for testing)
3. Click **Buy ticket** → complete Stripe test/live payment
4. Land on `/events/booking-success`
5. Verify:
   - Row in Supabase `registrations`
   - Ticket on `/account/index.html`
   - `booking_confirmation` email received (if Resend configured)
   - Organiser receives `organiser_new_registration` (if organiser email set)

## 7. API reference

| Endpoint | Purpose |
|----------|---------|
| `POST /api/stripe-webhook` | Stripe → create registration |
| `POST /api/auth/complete-booking` | Success page / free ticket fallback (auth required) |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Webhook 400 `invalid_signature` | Check `STRIPE_WEBHOOK_SECRET`; redeploy |
| Webhook `missing_event_id_metadata` | Add `event_id` metadata on Payment Link, or use hub Buy button |
| Buy button shows hint | Set `stripe_payment_link` on event/ticket, meta tag, or `?stripe=` |
| No confirmation email | Set `RESEND_API_KEY` + `RESEND_FROM`; run migration `027` |
| Registration exists but no email | Re-open success URL or check Resend logs; `ticket_email_sent` on row |
