# Connected external booking

Organisers on a **Connected** monthly subscription list events on The Networker UK and take payment on their own website. Registrations arrive via a **real-time webhook** so attendee lists, round-ups, and **verified post-event reviews** work.

**Link Out** (£9.99 per event) lists the event and redirects buyers to the organiser’s booking URL. There is **no integration** — no webhook, no verified reviews, round-ups, or other Connected benefits.

## Enable in production

### If **Save assignment** fails or mentions migrations (but subscribe works)

You likely have **292** and **298** already, but are missing **297** (`connected_booking_slot_assigned_at` on `organisers`). Run **`297_connected_booking_organiser_slots.sql`**, then **reload the Supabase API schema cache** (Dashboard → Project Settings → API, or wait a few minutes).

### If Sentry shows `connected_booking_stripe_customer_id does not exist`

Production Supabase is missing migration **298**. In the Supabase SQL editor (production project), run:

```sql
alter table public.organiser_accounts
  add column if not exists connected_booking_stripe_customer_id text;
```

Also run **`292_external_connected_booking.sql`** if Connected booking columns/tables were never applied. Until 298 is applied, **Manage billing** may not work after subscribe; the page and checkout should still load once app deploys **#66+**.

### Private preview (only you)

Set on Vercel:

```text
CONNECTED_BOOKING_PREVIEW_EMAILS=pips249@gmail.com
```

While this is set, **only that signed-in email** sees `/organiser/connected-booking`, the tickets-page Connected card (when plan active), and can use the APIs/webhooks for their organiser account. Everyone else gets no UI and **403 preview_restricted** / hidden behaviour. You do **not** need `CONNECTED_BOOKING_ENABLED=true` for preview users when the preview list is set.

When ready to launch for all organisers: **remove** `CONNECTED_BOOKING_PREVIEW_EMAILS` and set `CONNECTED_BOOKING_ENABLED=true`.

1. Run migrations `292_external_connected_booking.sql`, `298_connected_booking_stripe_customer.sql`, `297_connected_booking_organiser_slots.sql`, `299_connected_booking_provider_links.sql`, and `300_connected_booking_own_site_provider.sql` (provider webhooks + own booking links).
2. Set `CONNECTED_BOOKING_ENABLED=true` on Vercel (or use preview emails above until launch).
3. Ensure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set (same webhook endpoint as Hub checkout).
4. After changing intro prices in `api/_lib/connected-booking-pricing.js`, run `npm run sync-stripe` and update Vercel **`STRIPE_CONNECTED_BOOKING_*_PRICE_ID`** env vars (checkout also works with dynamic line items if price IDs are missing).
5. Organiser signs in → `/organiser/#connected-booking` (or `/organiser/connected-booking`). **Connected is free by default** — the first GET activates the account (`connected_booking_status=active`, plan `enterprise` unless `CONNECTED_BOOKING_FREE_PLAN` is set) and creates a webhook secret if missing.
6. To restore paid Stripe plans, set `CONNECTED_BOOKING_REQUIRE_SUBSCRIPTION=true` on Vercel (then organisers Subscribe Starter / Growth / Scale again).
7. Organiser enables a booking provider and links events on Connected setup.
8. Event: **Set up tickets** → the Connected booking card appears **only when** the organiser account plan is **active** (or the event was already on Connected). Otherwise the ticket page is unchanged.

**Manual / Command Centre:** admin grants still work; admin PATCH `/api/organiser/connected-booking` with `connectedBookingStatus: active` and `connectedBookingPlan`.

## Webhook

`POST /api/integrations/booking` — see `/organiser/connected-booking.html`.

## Pricing

**Connected booking is free** (default). Opening Connected booking activates the account with unlimited organiser-page slots (`enterprise` plan).

Paid tiers remain in code for rollback via `CONNECTED_BOOKING_REQUIRE_SUBSCRIPTION=true`:

| Plan | Organiser pages | Monthly (ex VAT, legacy) |
|------|-----------------|----------------------------|
| Starter | 1 | £19 |
| Growth | 5 | £39 |
| Scale | 20 | £99 |

**Link Out** is separate: £9.99 + VAT per event, redirect only — see `/organiser/booking-options#link-out` and [EXTERNAL-CHECKOUT-FLOWS.md](./EXTERNAL-CHECKOUT-FLOWS.md).

**UX:** after activation, enable a provider and link events on Connected setup. Connected events use a **slim setup** (display price + booking link + API docs), not hub ticket tiers.

## Group profiles vs Connected plan

Free Connected uses the **enterprise** plan (no organiser-page slot cap). Unlimited events per account.

## Tests

From the repo root (one command per line):

```bash
cd ~/The-networker-hub
npm run test-connected-booking-subscriptions
npm run test-external-booking-webhook
```

**Provider webhooks (your own booking link, Eventbrite, Ticket Tailor, Luma, TryBooking):** see [CONNECTED-BOOKING-PROVIDERS.md](./CONNECTED-BOOKING-PROVIDERS.md) — migrations **299** + **300**, no Zapier required.

**Organiser walkthroughs:** [/guides/connect-eventbrite](../guides/connect-eventbrite.html) · [/guides/connect-own-website](../guides/connect-own-website.html) · internal notes [EVENTBRITE-CONNECTED.md](./EVENTBRITE-CONNECTED.md) · [OWN-WEBSITE-CONNECTED.md](./OWN-WEBSITE-CONNECTED.md).

**Pilot / manual webhook test:** see [CONNECTED-BOOKING-PILOT-TEST.md](./CONNECTED-BOOKING-PILOT-TEST.md) (`CONNECTED_BOOKING_PILOT_GRANT_EMAILS`, webhook script).

## Pilot grant (complimentary Starter)

```text
CONNECTED_BOOKING_PILOT_GRANT_EMAILS=pips249@gmail.com
CONNECTED_BOOKING_PILOT_GRANT_PLAN=starter
```

First visit to `/organiser/connected-booking` activates the plan without Stripe. Still use preview emails so only pilot accounts see the feature.

## Command Centre allocation (preferred for partnerships)

**Financials → External booking** (`#financials/external-booking`):

1. Enter the organiser login email (e.g. `tnguyen@themartechsummit.com`).
2. Choose **Link Out** (redirect only) or **Connected** (optional webhook sync).
3. Optionally add a note → **Allocate grant**.

Requires migration `320_admin_external_booking_grants.sql`. No Vercel redeploy for day-to-day comps. Env pilot grants remain for bootstrap testers.
