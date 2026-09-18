# Connected booking — provider integrations

Organisers pay **one Connected subscription**. Checkout stays on **Eventbrite, Ticket Tailor, Luma, TryBooking**, or a custom site. The Networker UK receives **order webhooks** and creates **registrations** on the linked TNH event.

## Architecture

```text
Provider (Eventbrite, etc.)
        │ order webhook
        ▼
POST /api/integrations/providers/{provider}/webhook?token=…
        │ normalize payload → external event id
        ▼
connected_booking_event_links (provider + external id → TNH event_id)
        ▼
Same registration ingest as POST /api/integrations/booking
```

**Custom / developer:** continue using `POST /api/integrations/booking` with HMAC (`X-Networker-Signature`).

## Database

Run migration **`299_connected_booking_provider_links.sql`** (after 292, 297, 298):

- `connected_booking_provider_connections` — per account + provider; **`webhook_token`** secures inbound URL.
- `connected_booking_event_links` — maps **TNH `event_id`** ↔ **provider event id**.

## Organiser workflow

1. Connected plan active; organiser page(s) assigned (297).
2. **Connected booking** → **Booking providers** → **Enable** Eventbrite (or other).
3. Copy **Webhook URL** into the provider’s webhook settings (Eventbrite admin, Ticket Tailor, etc.).
4. **Link event:** TNH event UUID + provider event id (e.g. Eventbrite numeric id from the event URL).
5. Publish Connected event on TNH with booking URL pointing at provider.
6. Test order → **Recent sync attempts** shows `eventbrite:accepted` (or provider id).

## API (organiser session)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/organiser/connected-booking-providers` | Catalog + connections + webhook URLs |
| PATCH | `{ action: 'enable_provider', provider }` | Create connection + token |
| PATCH | `{ action: 'link_event', eventId, provider, externalEventId }` | Map TNH event |
| PATCH | `{ action: 'unlink_event', eventId }` | Remove link |

## Inbound webhooks

| Provider | URL |
|----------|-----|
| Eventbrite | `/api/integrations/providers/eventbrite/webhook?token=…` |
| Ticket Tailor | `/api/integrations/providers/ticket_tailor/webhook?token=…` |
| Luma | `/api/integrations/providers/luma/webhook?token=…` |
| TryBooking | `/api/integrations/providers/trybooking/webhook?token=…` |

Token is issued when the organiser clicks **Enable** (or via PATCH). Without a valid token → `401 invalid_webhook_token`.

Without a linked TNH event for the provider’s event id → `404 event_not_linked`.

## Provider-specific notes

| Provider | External event id | Webhook setup |
|----------|-------------------|---------------|
| **Eventbrite** | Numeric id from `…/e/…` or API (`123456789`) | Eventbrite webhook pointing at TNH URL; map `order.placed` (payload shapes vary — adapter handles common v3 fields). |
| **Ticket Tailor** | Box office event id | Ticket Tailor outbound webhook → TNH URL. |
| **Luma** | Event api id | Luma webhook → TNH URL. |
| **TryBooking** | Event id from TryBooking admin | Configure webhook to TNH URL. |

Adapters live in `api/_lib/connected-booking-providers/adapters/`. Extend normalizers as real payloads are confirmed with pilot organisers.

## OAuth (later)

`connected_booking_provider_connections.config` will hold OAuth tokens and refresh logic. Phase 1 uses **webhook token + manual event id linking** so organisers do **not** need Zapier.

## Tests

```bash
npm run test-connected-booking-providers
```

## Related

- [CONNECTED-BOOKING.md](./CONNECTED-BOOKING.md) — plan, slots, legacy HMAC webhook
- [CONNECTED-BOOKING-PILOT-TEST.md](./CONNECTED-BOOKING-PILOT-TEST.md) — manual script testing
