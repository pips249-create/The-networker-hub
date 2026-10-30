# Eventbrite — Connected booking on The Networker UK

Checkout stays on **Eventbrite**. TNH receives **`order.placed`** webhooks, loads order/attendee details with the organiser’s **private token**, and creates **registrations** (attendee list, post-event reviews, round-ups when enabled).

**Organiser-facing walkthrough:** [/guides/connect-eventbrite](https://www.thenetworkeruk.com/guides/connect-eventbrite)

## Prerequisites

- **Connected** plan active on the organiser account (see [CONNECTED-BOOKING-PILOT-TEST.md](./CONNECTED-BOOKING-PILOT-TEST.md) for pilot grant emails).
- Organiser page(s) assigned to Connected (slots).
- A TNH event on **Connected booking** with an Eventbrite checkout / `/e/…` URL.

## One-time (account)

1. **Organiser → Booking system → Eventbrite** → **Enable Eventbrite** (if needed). The account webhook URL is shown on that same panel.
2. Copy the short webhook URL:
   - `https://www.thenetworkeruk.com/w/eb/{token}`
   - Must use **www** — apex host 308-redirects and breaks Eventbrite POSTs.
3. Saving the Eventbrite **private token** usually registers the webhook via API. To check or paste by hand in **Eventbrite → Account settings → Webhooks**:
   - Paste the TNH URL as Payload URL.
   - Action: **`order.placed`** (“Events: All” is fine).
4. Save the Eventbrite **private token** on Booking system → Eventbrite (or Connected setup). Without it, webhooks arrive but buyer email cannot be resolved.
   - Creating a new API key: **Application URL** = `https://www.thenetworkeruk.com` (homepage — not the `/w/eb/…` webhook). Leave **OAuth Redirect URI** blank. Name/description can say The Networker UK. Then copy **Private token** only.
   - The organiser-specific webhook URL is shown on Booking system → Eventbrite; paste into Eventbrite → **Webhooks** only if it is missing there.

## Per TNH event

### Organiser page import (preferred)

On **Organiser → Edit page → Where do people book? → Eventbrite**, save the private token, refresh the event list, then **Import & publish**. Complete listings (date + price + booking URL from Eventbrite) go live and auto-approve with Connected checkout + attendee link. Incomplete ones save as drafts. Kill switch: `EVENTBRITE_IMPORT_AUTO_PUBLISH=false`.

### Manual per-event setup

1. Open **Connected setup** (Set up tickets → Eventbrite → Continue).
2. **Price shown on listing** + **Booking URL** (Eventbrite `/e/…` or checkout link — TNH rewrites common listing URLs to checkout on save).
3. **Link registrations** — numeric Eventbrite event id (from the URL, or **Use id from booking URL**).
4. Optional: import title / date / venue from Eventbrite when saving the link.
5. **Publish** the TNH listing.

## Verify sync

| Step | Expected |
|------|----------|
| Test or real order on Eventbrite | Webhook fires to TNH |
| **Connected booking → Recent sync attempts** | `eventbrite:accepted` |
| Organiser **Attendees** | Buyer (and other ticket holders when token + attendee sync are live) |
| Only `eventbrite:webhook_ping` | Payload reached TNH but was not treated as an order — check token + linking |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `invalid_webhook_token` | Re-copy URL from TNH (include **www**) into Eventbrite Webhooks; use **Fix webhook URL** if shown |
| `event_not_linked` | Save the numeric Eventbrite id that matches the sold event |
| Buyer missing | Private token missing/expired; confirm action is `order.placed` |
| Worked once then stopped | Eventbrite still has an old Payload URL — paste the current TNH URL again |

## Related

- Public guide: [/guides/connect-eventbrite](../guides/connect-eventbrite.html)
- [ORGANISER-CONNECTED-LINK-EB-OR-TT.md](./ORGANISER-CONNECTED-LINK-EB-OR-TT.md) — Eventbrite or Ticket Tailor per event
- [TICKET-TAILOR-CONNECTED.md](./TICKET-TAILOR-CONNECTED.md) — Ticket Tailor equivalent
- [CONNECTED-BOOKING-PROVIDERS.md](./CONNECTED-BOOKING-PROVIDERS.md) — all providers
- [CONNECTED-BOOKING.md](./CONNECTED-BOOKING.md) — plans and slots
