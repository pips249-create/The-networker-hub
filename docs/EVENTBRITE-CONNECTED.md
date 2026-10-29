# Eventbrite — Connected booking on The Networker UK

Checkout stays on **Eventbrite**. TNH receives **`order.placed`** webhooks, loads order/attendee details with the organiser’s **OAuth or private token**, and creates **registrations** (attendee list, post-event reviews, round-ups when enabled).

**Organiser-facing walkthrough:** [/guides/connect-eventbrite](https://www.thenetworkeruk.com/guides/connect-eventbrite)

## Prerequisites

- **Connected** plan active on the organiser account (see [CONNECTED-BOOKING-PILOT-TEST.md](./CONNECTED-BOOKING-PILOT-TEST.md) for pilot grant emails).
- Organiser page(s) assigned to Connected (slots).
- A TNH Eventbrite app configured for OAuth (below), **or** the organiser’s private API token as a fallback.

## Env / secrets (platform)

Set these on Vercel (Production + Preview) and in local `.env`:

| Variable | Purpose |
|----------|---------|
| `EVENTBRITE_CLIENT_ID` | Eventbrite app API key / client id |
| `EVENTBRITE_CLIENT_SECRET` | Eventbrite app client secret |
| `EVENTBRITE_OAUTH_REDIRECT_URI` | Optional override. Default: `{SITE_URL}/api/integrations/eventbrite/oauth/callback` |
| `SESSION_SECRET` | Signs the OAuth `state` parameter (already required for auth) |
| `EVENTBRITE_IMPORT_AUTO_PUBLISH` | Optional kill switch — set `false` to force drafts on import |

In the [Eventbrite API Key Management](https://www.eventbrite.com/account-settings/apps) page for the TNH app, add the **Application URL / OAuth Redirect URI**:

```text
https://www.thenetworkeruk.com/api/integrations/eventbrite/oauth/callback
```

For local/preview, add the matching `SITE_URL` callback as well.

## One-time (account)

### Preferred — OAuth

1. **Organiser → Edit page → Where do people book? → Eventbrite** → **Connect with Eventbrite**.
2. Approve The Networker UK in Eventbrite.
3. On return, TNH stores the access token, ensures webhooks (`order.placed`, `attendee.updated`, `event.published`), and **auto-imports** live/started organisation events onto that organiser page.

### Fallback — private token

1. Enable Eventbrite under booking providers if needed.
2. Paste the Eventbrite **private token** (Account settings → Developer links) into the advanced panel on the organiser page (or Connected setup).
3. Same webhook + auto-import path as OAuth.

### Webhook URL (manual paste still works)

If Eventbrite did not accept API-created webhooks, paste the short URL yourself:

- `https://www.thenetworkeruk.com/w/eb/{token}`
- Must use **www** — apex host 308-redirects and breaks Eventbrite POSTs.
- Action: **`order.placed`** (“Events: All” is fine). Prefer also **`attendee.updated`**.

## Auto-import behaviour

| Trigger | What happens |
|---------|----------------|
| After OAuth connect | Syncs Eventbrite org events with status **`live` / `started`** onto the page used to connect (`defaultImportGroupId`). |
| After private-token save | Same sync. |
| Cron `/api/cron/eventbrite-event-sync` | Hourly poll of connected accounts (token present). |
| Webhook `event.published` | Imports that single Eventbrite event when linked to the connection. |
| Manual **Import new events** / per-event **Import & publish** | Same `create_from_eventbrite` path. |

**Publish rules (unchanged):** complete listings (date + booking URL + price label) **auto-publish** when `EVENTBRITE_IMPORT_AUTO_PUBLISH` is not `false`; incomplete ones stay **drafts**. Soft-fails (e.g. Connected slot missing) also land as drafts.

Already-linked Eventbrite ids are skipped. Eventbrite **draft** events are not auto-imported (organiser can still import manually via the list when included).

## Per TNH event (manual)

1. Open **Connected setup** (Set up tickets → Eventbrite → Continue) when linking an existing TNH listing.
2. **Price shown on listing** + **Booking URL** (Eventbrite `/e/…` or checkout link — TNH rewrites common listing URLs to checkout on save).
3. **Link registrations** — numeric Eventbrite event id (from the URL, or **Use id from booking URL**).
4. Optional: import title / date / venue from Eventbrite when saving the link.
5. **Publish** the TNH listing.

## Verify sync

| Step | Expected |
|------|----------|
| Connect OAuth / save token | Return query `eb_oauth=connected` (organiser page) and imported count |
| New live Eventbrite event | Appears after cron, `event.published` webhook, or **Import new events** |
| Test or real order on Eventbrite | Webhook fires to TNH |
| **Booking system → Recent sync attempts** | `eventbrite:accepted` or `eventbrite:event_imported` |
| Organiser **Attendees** | Buyer (and other ticket holders when token + attendee sync are live) |
| Only `eventbrite:webhook_ping` | Payload reached TNH but was not treated as an order — check token + linking |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| OAuth button fails with `eventbrite_oauth_not_configured` | Set `EVENTBRITE_CLIENT_ID` + `EVENTBRITE_CLIENT_SECRET`; register redirect URI; or use private token |
| `invalid_webhook_token` | Re-copy URL from TNH (include **www**) into Eventbrite Webhooks; use **Fix webhook URL** if shown |
| `event_not_linked` | Save the numeric Eventbrite id that matches the sold event (or wait for auto-import) |
| Buyer missing | Token missing/expired/revoked; confirm action is `order.placed` |
| Worked once then stopped | Eventbrite still has an old Payload URL — paste the current TNH URL again |

## Related

- Public guide: [/guides/connect-eventbrite](../guides/connect-eventbrite.html)
- [ORGANISER-CONNECTED-LINK-EB-OR-TT.md](./ORGANISER-CONNECTED-LINK-EB-OR-TT.md) — Eventbrite or Ticket Tailor per event
- [TICKET-TAILOR-CONNECTED.md](./TICKET-TAILOR-CONNECTED.md) — Ticket Tailor equivalent
- [CONNECTED-BOOKING-PROVIDERS.md](./CONNECTED-BOOKING-PROVIDERS.md) — all providers
- [CONNECTED-BOOKING.md](./CONNECTED-BOOKING.md) — plans and slots
