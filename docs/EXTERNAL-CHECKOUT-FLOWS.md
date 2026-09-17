# External checkout flows — Connected vs Link-out (product design)

**Status:** agreed direction; implementation in phases after pilot grant / Stripe are stable.

Hub checkout (`checkout_mode: hub`) stays unchanged — tickets, membership, guest visits on The Networker UK.

---

## 1. Two separate products (do not merge in UI)

| | **Connected booking** (subscription) | **Link-out listing** (per event) |
|--|--------------------------------------|----------------------------------|
| **Billing** | Monthly plan (Starter / Growth / Scale) | **£9.99 + VAT once per event** |
| **Payment** | On organiser’s site | On organiser’s site |
| **Hub shows** | Price label + link to book | Price label + **redirect URL** only |
| **Webhook / API** | **Yes** — developer docs, HMAC POST | **No** |
| **Attendee list on hub** | Yes (when webhook syncs) | **No** |
| **Verified post-event reviews** | Yes (when webhook syncs) | **No** |
| **Membership / guest visits on hub** | **No** (not applicable) | **No** |

Link-out is **not** a downgrade of Connected; it is a different path from event creation.

---

## 2. Subscription → choose which organiser page(s)

**Current (pilot):** plan limits **count of published group profiles** on the account.

**Target UX:**

1. Organiser subscribes (or pilot grant) on **Connected booking**.
2. **“Apply your plan”** step: choose which **organiser page(s)** use Connected, up to plan limit (Starter = **1**, Growth = **5**, etc.).
3. Only events under **assigned** organiser pages may use Connected checkout + webhook.
4. Other organiser pages on the same login can still use **Hub checkout** or **Link-out** on individual events.

**Data model (proposed):**

- `organiser_accounts.connected_booking_slot_organiser_ids` (uuid[], max length = plan limit), **or**
- `organisers.connected_booking_slot_assigned_at` (timestamptz, null = not on Connected slot)

Enforcement: PATCH event to `external_connected` only if event’s `organiser_id` is in assigned slots and plan is active.

---

## 3. Event setup — three entry paths

When opening ticket/checkout setup for an event, organiser picks **one** model (already true per event; UI should make it obvious up front):

```
[ Hub — sell on The Networker UK ]   [ Connected — subscription + webhook ]
[ Link-out — £9.99/event, link only ]
```

If the event’s group is **not** on a Connected slot, hide Connected path (or show upgrade / assign slot).

---

## 4. Simplified “Set up tickets” for Connected

**Remove / hide for Connected events:**

- Step 1 “How should people get in?” (general vs application)
- Hub ticket tiers, Stripe Connect ticket prices, booking fee copy
- Complimentary visits, membership panels, refund terms for hub basket

**Keep / show:**

| Field | Purpose |
|-------|---------|
| **Price shown on listing** | Display only on hub (e.g. `Free`, `£15`, `From £10`) |
| **Legal hint** | See §5 |
| **Booking page URL** (optional on listing) | Public “Book” button; actual payment on organiser site |
| **Developer block** | Link to `/organiser/connected-booking#webhook` — endpoint, headers, sample JSON, account id, rotate secret |
| **Publish** | Same listing statuses as today |

**Copy change:** page title e.g. **“Connected event — price & booking link”** instead of “Set up tickets”.

Webhook URL for registrations is **account-level** (not per event), but payload includes **event UUID**.

---

## 5. Simplified flow for Link-out

**Remove:** everything in Connected developer section + webhook.

**Show:**

| Field | Purpose |
|-------|---------|
| **Price shown on listing** | Same as Connected + **§5 legal hint** |
| **Redirect URL** | Required — Eventbrite, own site, etc. |
| **Pay £9.99 + VAT** | Stripe one-time before publish (or mark paid in admin during pilot) |
| **Publish** | Event live with hub CTA → redirect only |

**checkout_mode:** `external_link` (new value; separate from `external_connected`).

---

## 6. UK pricing accuracy (both external flows)

Show near the price field:

> **Display price:** What visitors see on The Networker UK before they leave for your site.  
> **You are responsible** for ensuring this matches what you charge on your checkout (including VAT where applicable) and complies with UK consumer law. We do not process ticket payment on these flows.

Optional checkbox on first save: “I confirm this display price is accurate for this event.”

---

## 7. Implementation phases

| Phase | Deliverable |
|-------|-------------|
| **A (done / in PR)** | Pilot grant, Stripe subscribe, webhook ingest, basic Connected card on current tickets page |
| **B** | Assign Connected slots to organiser pages; enforce on publish |
| **C** | Dedicated **Connected event setup** page (or mode) — hub ticket wizard hidden |
| **D** | **Link-out** checkout_mode + £9.99 Stripe + dedicated setup page |
| **E** | Eventbrite/Zapier template docs (optional automation) |

---

## 8. Event creation order (recommended pilot)

1. Create / claim **organiser page**.
2. Connected booking → subscribe or pilot grant → **assign page to Starter slot**.
3. **List event** under that page.
4. Open **Connected event setup** (not full hub tickets) → price label + Eventbrite URL + read webhook docs.
5. Publish → test registration via webhook script (then Eventbrite automation later).

Link-out: skip steps 2–4 Connected; from event setup choose Link-out → pay → redirect URL only.
