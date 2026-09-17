# Connected booking — pilot test (Eventbrite + webhook)

## Run automated smoke tests

Run **one command per line** (do not paste the `#` comment on the same line as `cd` — zsh treats it as extra arguments).

```bash
cd ~/The-networker-hub
npm run test-connected-booking-subscriptions
npm run test-external-booking-webhook
```

## Free Starter plan for pilot organisers (no Stripe)

On **Vercel → Environment variables** (Production), set:

```text
CONNECTED_BOOKING_PREVIEW_EMAILS=pips249@gmail.com,catherine@yourdomain.com
CONNECTED_BOOKING_PILOT_GRANT_EMAILS=pips249@gmail.com,catherine@yourdomain.com
CONNECTED_BOOKING_PILOT_GRANT_PLAN=starter
```

Redeploy. Then sign in as that email and open `/organiser/connected-booking`. The first load **activates Starter (1 group) at no charge** and creates a webhook secret if missing. You do **not** need to click Subscribe for pilot grant.

Optional: if you still want to test Stripe checkout, create a **100% off** promotion code in Stripe Dashboard and set `CONNECTED_BOOKING_STRIPE_PROMOTION_CODES=true` on Vercel, then use **Subscribe** and enter the code at checkout.

## End-to-end test checklist

### A. Hub side

1. Sign in with a **pilot grant** email → **Connected booking** → confirm plan **Active**, copy **Account id**.
2. Click **Generate new webhook secret** → copy the secret (shown once).
3. **My Events** → create or edit an event → **Set up tickets** → enable **Connected booking** (external checkout).
4. Set **Booking URL** to your **Eventbrite event URL** (https).
5. Publish the event on The Networker UK. Note the **event UUID** from the organiser URL or API.

### B. Eventbrite side

Create a test event on Eventbrite (can be free or paid). You will send buyers to that URL from the hub listing.

### C. Registration sync (important)

Eventbrite **does not** call The Networker UK automatically. Something must POST to:

`https://www.thenetworkeruk.com/api/integrations/booking`

with signed JSON when an order is placed (your developer, **Zapier/Make**, or a manual test script).

**Pilot manual test (after a real Eventbrite order):** use the Eventbrite order id as `orderId` and the buyer email from Eventbrite:

```bash
cd ~/The-networker-hub
node scripts/send-external-booking-webhook.js \
  --url https://www.thenetworkeruk.com/api/integrations/booking \
  --account-id PASTE_ACCOUNT_UUID \
  --event-id PASTE_TNH_EVENT_UUID \
  --secret PASTE_WEBHOOK_SECRET \
  --order-id eventbrite-ORDER_ID_FROM_EVENTBRITE \
  --email buyer@example.com \
  --name "Buyer Name"
```

Success: HTTP **200** and `{ "ok": true, ... }`. On Connected booking page, **Recent sync attempts** shows **accepted**. The registration appears in organiser attendee tools for that event.

**Production automation:** Zapier (or similar): Trigger **Eventbrite → New order** → Action **Webhooks POST** with a **Code** step to HMAC-sign the body (same format as above). We can provide a Zap template in a later phase.

### D. Verify on the hub

- Open the public event page → **Book** goes to Eventbrite.
- After webhook **accepted**, check organiser **attendee list** / registrations for that event date.

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| `preview_restricted` | Add email to `CONNECTED_BOOKING_PREVIEW_EMAILS` |
| `connected_booking_inactive` | Open Connected booking page once (pilot grant) or subscribe |
| `invalid_signature` | Regenerate secret; sign **raw JSON body** exactly |
| `event_not_on_account` | `eventId` must be a TNH event on your organiser account |
| Eventbrite purchase but no registration | Expected until Zapier or script sends the webhook |
