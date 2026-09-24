# Connected booking — provider integrations

Organisers pay **one Connected subscription**. Checkout stays on **their own website**, **Eventbrite, Ticket Tailor, Luma, TryBooking**, or other systems. The Networker UK receives **order webhooks** and creates **registrations** on the TNH event.

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

**Your own website:** enable **Your own website**, copy the token webhook URL, and POST after each sale (see below).

**Custom / developer (advanced):** `POST /api/integrations/booking` with HMAC (`X-Networker-Signature`).

## Database

Run migration **`299_connected_booking_provider_links.sql`** (after 292, 297, 298):

- `connected_booking_provider_connections` — per account + provider; **`webhook_token`** secures inbound URL.
- `connected_booking_event_links` — maps **TNH `event_id`** ↔ **provider event id**.

## Organiser workflow

1. Connected plan active; organiser page(s) assigned (297).
2. **Connected booking** → **Booking providers** → **Enable** Eventbrite (or other).
3. **Eventbrite webhook (Payload URL):** Profile menu → **Account settings** → **Webhooks** → Add webhook (or edit existing). Paste the **short** TNH URL from Connected setup (`https://www.thenetworkeruk.com/w/eb/…`, under **70 characters** — must include **www** so Eventbrite is not 308-redirected). Set **Action** to **`order.placed`**. “Events: All” is fine. Other providers: paste the TNH webhook URL from **Enable** into their webhook / integrations screen.
4. **Link event:** TNH event UUID + provider event id (e.g. Eventbrite numeric id from the event URL).
5. Publish Connected event on TNH with **booking URL** pointing at provider checkout (for Eventbrite, use ticket checkout — not only the public event listing; TNH rewrites common `/e/…` links to `checkout-external?eid=` on save).
6. Test order → **Recent sync attempts** shows `eventbrite:accepted` (or provider id). If you only see `eventbrite:webhook_ping` after a real purchase, the webhook reached TNH but was not treated as an order — update TNH (fixed in production) or check Eventbrite **Recent requests** for 400/404/401.

**Worked once then stopped?** Eventbrite keeps the Payload URL you pasted; TNH only changes it when you click **Fix webhook URL**. If you see `invalid_webhook_token` in Recent sync attempts, copy the URL from Connected setup again into Eventbrite → Webhooks (must include **www**). Opening Connected setup no longer rotates the URL automatically.

## API (organiser session)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/organiser/connected-booking-providers` | Catalog + connections + webhook URLs |
| PATCH | `{ action: 'enable_provider', provider }` | Create connection + token |
| PATCH | `{ action: 'link_event', eventId, provider, externalEventId }` | Map TNH event |
| PATCH | `{ action: 'unlink_event', eventId }` | Remove link |

## Your own booking link / website

1. Connected event setup → **Booking URL** = your checkout page (any HTTPS link you control).
2. **Booking providers** → **Enable** → **Your own website**.
3. After each completed booking, your site (or form plugin, small script, CRM) POSTs to your webhook URL:

```json
{
  "eventId": "YOUR_TNH_EVENT_UUID",
  "orderId": "unique-booking-ref",
  "email": "buyer@example.com",
  "name": "Buyer Name",
  "quantity": 1,
  "amountPaid": 15,
  "status": "confirmed"
}
```

No Eventbrite id and no Zapier. `eventId` must be the TNH event UUID from Connected event setup. `orderId` must be unique per booking (retries with the same id are treated as duplicates).

Optional: **Link event** with provider **Your own website** and the same TNH uuid in both fields — for your records only; the webhook still keys off `eventId` in the JSON.

## Inbound webhooks

| Provider | URL |
|----------|-----|
| Your own website | `/api/integrations/providers/own_site/webhook?token=…` |
| Eventbrite | `https://www.thenetworkeruk.com/w/eb/{token}` (≤70 chars; use **www** — bare `thenetworkeruk.com` returns 308 and breaks POST webhooks) |
| Ticket Tailor | `/api/integrations/providers/ticket_tailor/webhook?token=…` |
| Luma | `/api/integrations/providers/luma/webhook?token=…` |
| TryBooking | `/api/integrations/providers/trybooking/webhook?token=…` |

Token is issued when the organiser clicks **Enable** (or via PATCH). Without a valid token → `401 invalid_webhook_token`.

For third-party providers, without a linked TNH event for the provider’s event id → `404 event_not_linked`. **Your own website** uses `eventId` in the JSON instead (no external id required).

## Provider-specific notes

| Provider | External event id | Webhook setup |
|----------|-------------------|---------------|
| **Your own website** | TNH event UUID in webhook JSON (`eventId`) | Your checkout POSTs to token URL after each sale — no provider admin. |
| **Eventbrite** | Numeric id from `…/e/…` or API (`123456789`) | Webhook URL + **private token** (Developer links) on Connected setup — Eventbrite only sends an order link; TNH loads buyer email via Eventbrite API. Action `order.placed`. |
| **Ticket Tailor** | **`ev_…` id** from Box office (must match `event_summary.event_id` in webhooks — not always the same as the public `/events/slug` URL) | Ticket Tailor → **Settings → Webhooks** → subscribe to **Order created** → paste TNH URL (`/w/tt/…` or long form). No API token on TNH. |
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
- [TICKET-TAILOR-CONNECTED.md](./TICKET-TAILOR-CONNECTED.md) — Ticket Tailor setup and QA checklist
