# Connected booking pilot — Catherine (`catherine@thenetworkeruk.com`)

Internal runbook: enable Connected + test Eventbrite or Ticket Tailor on Catherine’s organiser account.

## 1. Platform admin (Vercel Production)

Add or update (comma-separated, lowercase emails):

```text
CONNECTED_BOOKING_PREVIEW_EMAILS=catherine@thenetworkeruk.com
CONNECTED_BOOKING_PILOT_GRANT_EMAILS=catherine@thenetworkeruk.com
CONNECTED_BOOKING_PILOT_GRANT_PLAN=starter
```

Optional while rolling out: keep other pilot emails in the same lists.

If Connected is already open to all organisers, `CONNECTED_BOOKING_ENABLED=true` and preview list can be empty — pilot grant still auto-activates Starter on first visit for emails in `CONNECTED_BOOKING_PILOT_GRANT_EMAILS`.

**Redeploy** after env changes.

Merge/deploy **#127** (batch branch) if you need Ticket Tailor **listing import** and the three-provider UI trim; webhooks + guide are on `main` from #125.

---

## 2. Catherine signs in

1. Sign in at [thenetworkeruk.com](https://www.thenetworkeruk.com) as **catherine@thenetworkeruk.com**.
2. Open **Connected booking** (`/organiser/connected-booking`).
3. Confirm message that **Starter** activated (pilot grant) — no Stripe subscribe required.
4. **Organiser pages** (workspace) → tick the group profile(s) to use Connected → **Save assignment** (Starter = **1** page).

---

## 3. Pick one path per test event

Use [ORGANISER-CONNECTED-LINK-EB-OR-TT.md](./ORGANISER-CONNECTED-LINK-EB-OR-TT.md).

### Ticket Tailor test (recommended if TT is the focus)

1. **Connected booking → Booking providers → Enable Ticket Tailor** → copy `/w/tt/…` webhook.
2. Ticket Tailor admin → webhooks → **Order created**.
3. Create or open a TNH Connected event → **Set up tickets** → **Ticket Tailor** → **Connected setup**.
4. Booking URL + **`ev_…`** → **Save link** → publish.
5. Test order or `npm run send-ticket-tailor-webhook` (see [TICKET-TAILOR-CONNECTED.md](./TICKET-TAILOR-CONNECTED.md)).

### Eventbrite test

1. Enable Eventbrite + webhook `order.placed` + save **private token**.
2. Connected event → **Eventbrite** → booking URL + numeric event id → save link → publish.
3. Place test order on Eventbrite → check **Recent sync attempts** and **Attendees**.

---

## 4. If something blocks access

| Symptom | Fix |
|---------|-----|
| `preview_restricted` | Add Catherine’s email to `CONNECTED_BOOKING_PREVIEW_EMAILS` and redeploy |
| No pilot / still asked to Subscribe | Add to `CONNECTED_BOOKING_PILOT_GRANT_EMAILS`, reload Connected booking page |
| `connected_booking_slot_not_assigned` | Assign organiser page on **Organiser pages** |
| `event_not_linked` | Save correct Eventbrite id or Ticket Tailor **`ev_…`** on Connected setup |
| `invalid_webhook_token` | Re-enable provider on TNH, re-paste webhook URL in EB/TT |

---

## 5. Support contact

Pilot issues: note TNH event id, provider, sync log line from **Recent sync attempts**, and whether the test was Eventbrite or Ticket Tailor.
