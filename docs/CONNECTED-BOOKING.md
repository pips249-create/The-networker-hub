# Connected external booking

Organisers on a **Connected** monthly plan list events on The Networker UK and take payment on their own website. Registrations arrive via a **real-time webhook** so attendee lists, round-ups, and **verified post-event reviews** work like Hub checkout.

## Enable in production

### If Sentry shows `connected_booking_stripe_customer_id does not exist`

Production Supabase is missing migration **293**. In the Supabase SQL editor (production project), run:

```sql
alter table public.organiser_accounts
  add column if not exists connected_booking_stripe_customer_id text;
```

Also run **`292_external_connected_booking.sql`** if Connected booking columns/tables were never applied. Until 293 is applied, **Manage billing** may not work after subscribe; the page and checkout should still load once app deploys **#66+**.

### Private preview (only you)

Set on Vercel:

```text
CONNECTED_BOOKING_PREVIEW_EMAILS=pips249@gmail.com
```

While this is set, **only that signed-in email** sees `/organiser/connected-booking`, the tickets-page Connected card (when plan active), and can use the APIs/webhooks for their organiser account. Everyone else gets no UI and **403 preview_restricted** / hidden behaviour. You do **not** need `CONNECTED_BOOKING_ENABLED=true` for preview users when the preview list is set.

When ready to launch for all organisers: **remove** `CONNECTED_BOOKING_PREVIEW_EMAILS` and set `CONNECTED_BOOKING_ENABLED=true`.

1. Run migrations `292_external_connected_booking.sql` and `293_connected_booking_stripe_customer.sql`.
2. Set `CONNECTED_BOOKING_ENABLED=true` on Vercel (or use preview emails above until launch).
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

From the repo root (one command per line):

```bash
cd ~/The-networker-hub
npm run test-connected-booking-subscriptions
npm run test-external-booking-webhook
```

**Pilot / Eventbrite end-to-end:** see [CONNECTED-BOOKING-PILOT-TEST.md](./CONNECTED-BOOKING-PILOT-TEST.md) (`CONNECTED_BOOKING_PILOT_GRANT_EMAILS`, webhook script).

## Pilot grant (complimentary Starter)

```text
CONNECTED_BOOKING_PILOT_GRANT_EMAILS=pips249@gmail.com
CONNECTED_BOOKING_PILOT_GRANT_PLAN=starter
```

First visit to `/organiser/connected-booking` activates the plan without Stripe. Still use preview emails so only pilot accounts see the feature.
