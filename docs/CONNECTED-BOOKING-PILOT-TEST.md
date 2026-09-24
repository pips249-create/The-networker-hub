# Connected booking — pilot test (Eventbrite, Ticket Tailor, webhooks)

## Run automated smoke tests

Run **one command per line** (do not paste the `#` comment on the same line as `cd` — zsh treats it as extra arguments).

```bash
cd ~/The-networker-hub
npm run test-connected-booking-subscriptions
npm run test-external-booking-webhook
npm run test-connected-booking-providers
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

## Create a group profile and Connected billing (before Eventbrite)

Connected billing is tied to your **organiser account**, not a single button per group:

| Plan | Published **group profiles** (organiser pages) | Events |
|------|-----------------------------------------------|--------|
| Starter (pilot grant) | **1** | Unlimited on your account |
| Growth | 5 | Unlimited |
| Scale | 20 | Unlimited |

**Steps**

1. **My Events** → **+ Add organiser page** (`/organiser/group-edit`) — create or claim your networking group.
2. Sign in with a **pilot grant** email → open **Connected booking** once → Starter activates free (see env vars below).
3. **List an event** under that group → **Set up tickets** → turn on **Connected booking** and paste your **Eventbrite URL** (when ready).
4. If you add **more than one organiser page**, My Events shows a banner: upgrade for more group slots, or use **Link-out £9.99/event** (no attendee sync) for a single event.

You do **not** “assign” Connected to one group in settings — you keep **one published group profile** on Starter, or upgrade if you need more pages live on the hub.

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

**Preferred (no Zapier):**

- **Your own booking link:** Connected event setup → paste your checkout URL → **Enable your own website webhook** (or **Connected booking → Booking providers → Your own website**). POST `{ eventId, orderId, email, … }` to the token URL after each sale.
- **Eventbrite / Ticket Tailor / Luma / TryBooking:** enable the provider under **Booking providers**, link TNH event id ↔ provider event id, paste the webhook URL into the provider admin. See [CONNECTED-BOOKING-PROVIDERS.md](./CONNECTED-BOOKING-PROVIDERS.md).

**Legacy / fallback automation (Zapier / Make):**

| Who pays for Zapier? | Typical approach |
|----------------------|------------------|
| **Each organiser** | They connect **their** Eventbrite to **their** Zapier (or Make) account and duplicate a template you share. This is the model today — The Networker UK does not receive Eventbrite order webhooks on their behalf without that bridge. |
| **You (platform) during pilot** | You can run Zaps only for **pilot organisers** you support manually (one Zap per Eventbrite account you have access to). Does not scale to all users. |
| **Future (not built yet)** | A native Eventbrite integration or a **single platform-owned** relay would avoid every organiser needing Zapier — Phase E in product docs. |

Zap flow: Trigger **Eventbrite → New order** → **Code** step (build JSON + HMAC-SHA256 with the organiser’s webhook secret) → **Webhooks POST** to `/api/integrations/booking`. We can publish a copy-paste Zap template in a later phase.

### D. Verify on the hub

- Open the public event page → **Book** goes to Eventbrite.
- After webhook **accepted**, check organiser **attendee list** / registrations for that event date.

## Ticket Tailor end-to-end

Full step-by-step: **[TICKET-TAILOR-CONNECTED.md](./TICKET-TAILOR-CONNECTED.md)**.

**Short checklist**

1. **Connected booking → Booking providers → Enable Ticket Tailor** → copy `https://www.thenetworkeruk.com/w/tt/…`
2. **Ticket Tailor → Settings → Webhooks** → paste URL → **Order created** (`ORDER.CREATED`)
3. TNH event → **Connected setup** → booking URL + link **`ev_…`** id (Box office, not URL slug) → **Publish**
4. Place a test order (or run `npm run send-ticket-tailor-webhook -- …`) → **Recent sync attempts** → `ticket_tailor:accepted` → **Attendees**

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| `preview_restricted` | Add email to `CONNECTED_BOOKING_PREVIEW_EMAILS` |
| `connected_booking_inactive` | Open Connected booking page once (pilot grant) or subscribe |
| `invalid_signature` | Regenerate secret; sign **raw JSON body** exactly |
| `event_not_on_account` | `eventId` must be a TNH event on your organiser account |
| Eventbrite purchase but no registration | Expected until Zapier or script sends the webhook |
| Ticket Tailor order but no registration | Check `ev_…` link matches webhook; order not pending; sync log line |
| `ticket_tailor:pending_ignored` | Normal for unpaid/pending TT orders — completes when order is paid |
