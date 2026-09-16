# Connected external booking

Organisers on a **Connected** monthly plan list events on The Networker UK and take payment on their own website. Registrations arrive via a **real-time webhook** so attendee lists, round-ups, and **verified post-event reviews** work like Hub checkout.

## Enable in production

1. Run migrations `292_external_connected_booking.sql` and `293_connected_booking_stripe_customer.sql`.
2. Set `CONNECTED_BOOKING_ENABLED=true` on Vercel.
3. Ensure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set (same webhook endpoint as Hub checkout).
4. Optional: `npm run sync-stripe` to create Connected booking prices and set `STRIPE_CONNECTED_BOOKING_*_PRICE_ID` env vars (checkout works without them using dynamic prices).
5. Organiser signs in → `/organiser/connected-booking` → **Subscribe** (Starter / Growth / Scale). VAT is added at checkout.
6. After payment, Stripe webhook activates the account (`connected_booking_status=active`, plan set). A webhook secret is created automatically on first activation if missing.
7. Organiser rotates webhook secret if needed on the same page; **Manage billing** opens Stripe Customer Portal.
8. Event: **Set up tickets** → the Connected booking card appears **only when** the organiser account plan is **active** (or the event was already on Connected). Otherwise the ticket page is unchanged.

**Enterprise (20+ groups)** remains POA — email Rosie & Catherine from the pricing table.

**Manual pilot (no Stripe):** admin PATCH `/api/organiser/connected-booking` with `connectedBookingStatus: active` and `connectedBookingPlan`.

## Webhook

`POST /api/integrations/booking` — see `/organiser/connected-booking.html`.

## Pricing (commercial)

| Plan | Groups | Monthly (ex VAT) |
|------|--------|------------------|
| Starter | 1 | £39 |
| Growth | 5 | £99 |
| Scale | 20 | £199 |
| 20+ | POA | Contact Rosie & Catherine |

Hub checkout remains free to list; booking fee 4.5% + 20p per ticket.

## Tests

- `npm run test-external-booking-webhook`
- `npm run test-connected-booking-subscriptions`
