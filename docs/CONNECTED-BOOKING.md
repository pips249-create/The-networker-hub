# Connected external booking

Organisers on a **Connected** monthly plan list events on The Networker UK and take payment on their own website. Registrations arrive via a **real-time webhook** so attendee lists, round-ups, and **verified post-event reviews** work like Hub checkout.

## Enable in production

1. Run migration `290_external_connected_booking.sql`.
2. Set `CONNECTED_BOOKING_ENABLED=true` on Vercel.
3. Activate an organiser account (admin PATCH `/api/organiser/connected-booking`: `connectedBookingStatus: active`, `connectedBookingPlan: starter|growth|scale|enterprise`).
4. Organiser rotates webhook secret on `/organiser/connected-booking`.
5. Event: **Set up tickets** → Connected booking card, or PATCH event with `checkoutMode: external_connected`.

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

`npm run test-external-booking-webhook`
