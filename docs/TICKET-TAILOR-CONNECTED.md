# Ticket Tailor — Connected booking on The Networker UK

Checkout stays on **Ticket Tailor**. TNH receives **ORDER.CREATED** webhooks and creates **registrations** (attendee list, post-event reviews, round-ups when enabled).

Webhooks do **not** need an API key — buyer email is in the payload. An **optional API key** (Box office → Settings → API) only copies listing fields (title, date, venue) onto TNH — see **Listing import** below.

## Prerequisites

- **Connected** plan active on the organiser account (see [CONNECTED-BOOKING-PILOT-TEST.md](./CONNECTED-BOOKING-PILOT-TEST.md) for pilot grant emails).
- A **published** TNH event with **Connected booking** (`external_connected`) and a **Ticket Tailor checkout URL** on the listing.

## One-time (account)

1. **Organiser → Connected booking → Booking providers** → **Enable Ticket Tailor**.
2. Copy the webhook URL (short form recommended):
   - `https://www.thenetworkeruk.com/w/tt/{token}`
   - Use **www** — same as Eventbrite (apex domain can 308-break POST webhooks).
3. In **Ticket Tailor → Settings → Webhooks**:
   - Paste the TNH URL.
   - Subscribe to **Order created** (`ORDER.CREATED`).
4. **Recent sync attempts** (Connected booking page) should show `ticket_tailor:accepted` when TT sends a test ping, or after a real order.

## Per TNH event

1. Open **Connected setup** for the event (or **Set up tickets** → Connected).
2. **Booking URL** — your public Ticket Tailor event/checkout link (`https://…tickettailor.com/…`).
3. **Link registrations** — paste the **`ev_…` event id** from Ticket Tailor **Box office** (event settings / API id).
   - **Not** the word from `/events/my-show` in the URL — webhooks send `ev_…` in `event_summary.event_id`.
   - If you only pasted the URL slug, TNH will warn you to use `ev_…`.
4. **Publish** the TNH listing.

## Listing import (optional)

Once listing import is deployed: save API key on Connected setup → **Update listing from Ticket Tailor** (or tick import when saving the `ev_…` link).

1. Connected setup → Ticket Tailor → **Webhook URL & API key** → paste API key → Save.
2. Booking URL + linked **`ev_…`** (or booking URL only — TNH may match slug to `ev_…` via API).
3. **Update listing from Ticket Tailor** — refreshes title, description, schedule, venue/online link, checkout URL.

Attendee sync is unchanged (webhooks only).

## Verify sync

| Step | Expected |
|------|----------|
| Test or real order on Ticket Tailor | Webhook fires to TNH |
| **Connected booking → Recent sync attempts** | `ticket_tailor:accepted` (not only `unrecognized_payload`) |
| Organiser **Attendees** for that TNH event | Buyer name/email |
| Pending TT orders | `ticket_tailor:pending_ignored` — registration created when order completes |

## QA script (no real purchase)

With provider enabled and TNH event **linked** to the same `ev_…` id:

```bash
npm run send-ticket-tailor-webhook -- \
  --url 'https://www.thenetworkeruk.com/w/tt/YOUR_TOKEN' \
  --event-id ev_YOUR_EVENT_ID \
  --email buyer@example.com \
  --order-id or_test_$(date +%s)
```

Success: HTTP **200**, sync log **accepted**, attendee row on the TNH event.

Automated adapter tests:

```bash
npm run test-connected-booking-providers
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `invalid_webhook_token` | Re-enable Ticket Tailor on TNH and re-paste URL in TT |
| `event_not_linked` | **Link registrations** with the same `ev_…` id as in the webhook |
| `unrecognized_payload` | Confirm webhook type is **ORDER.CREATED**; check TT payload format |
| Slug in link field (`my-show`) | Replace with **`ev_…`** from Box office |
| Buyer missing on TNH | Order may still be **pending** — complete payment on TT |
| No post-event review | Event must **end**; registration must exist; ~24h after end (hourly cron) |

## Related

- [CONNECTED-BOOKING-PROVIDERS.md](./CONNECTED-BOOKING-PROVIDERS.md) — all providers
- [CONNECTED-BOOKING.md](./CONNECTED-BOOKING.md) — plans and slots
