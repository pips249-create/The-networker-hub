# Your own website — Connected booking on The Networker UK

Checkout stays on the **organiser’s website** (or any booking system they control). After each sale, their site (or Zapier / Make) POSTs JSON to a **token webhook**. TNH creates a **registration** so attendees, verified reviews, and round-ups work.

**Organiser-facing walkthrough:** [/guides/connect-own-website](https://www.thenetworkeruk.com/guides/connect-own-website)

## Prerequisites

- **Connected** plan active (not Link Out-only).
- Organiser page(s) assigned to Connected.
- TNH event published with Connected booking + external booking URL.

## One-time (account)

1. **Connected booking → Booking providers → Enable Your own website**.
2. Copy the webhook URL:
   - `/api/integrations/providers/own_site/webhook?token=…`
3. Store the URL in their checkout automation (server, Zapier, Make, CRM).

## Per event

1. Connected setup → platform **Your own website**.
2. Display price + booking/checkout URL → publish.
3. Note the **TNH event UUID** — required in every webhook body as `eventId`.

Optional: link event with provider `own_site` and the same UUID in both fields (records only; ingest still uses JSON `eventId`).

## Webhook payload

```json
{
  "eventId": "TNH_EVENT_UUID",
  "orderId": "unique-booking-ref",
  "email": "buyer@example.com",
  "name": "Buyer Name",
  "company": "Acme Ltd",
  "jobTitle": "Founder",
  "quantity": 1,
  "amountPaid": 15,
  "status": "confirmed"
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `eventId` | Yes | TNH event UUID |
| `orderId` | Yes | Unique per booking; retries with same id are duplicates |
| `email` | Yes | Buyer email |
| `name` | No | Display name |
| `company` / `jobTitle` | No | Shown on attendee list when provided |
| `quantity` / `amountPaid` | No | Defaults 1 / 0 |
| `status` | No | `confirmed` (default) or cancel/refund wording → cancelled |

## Verify

| Step | Expected |
|------|----------|
| **Send test booking** (Connected setup or Booking providers) | Creates a test attendee without a terminal |
| POST after a sale (or the button above) | HTTP 200 / `own_site:accepted` |
| Recent sync attempts | `own_site:accepted` |
| Attendees | Buyer row |
| After event end | Verified review flow (~24h cron) |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `invalid_webhook_token` | Re-enable provider; paste new URL |
| `invalid_event_id` / `missing_fields` | Valid UUID `eventId` + `orderId` + `email` |
| No attendees | Confirm Connected (not Link Out); check sync log |

## Related

- Public guide: [/guides/connect-own-website](../guides/connect-own-website.html)
- [CONNECTED-BOOKING-PROVIDERS.md](./CONNECTED-BOOKING-PROVIDERS.md)
- [EVENTBRITE-CONNECTED.md](./EVENTBRITE-CONNECTED.md)
- [CONNECTED-BOOKING.md](./CONNECTED-BOOKING.md)
