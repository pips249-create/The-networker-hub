# Refunds, payouts & Stripe Connect — strategy notes

**Saved:** 10 June 2026  
**Context:** Discussion on how money flows, who handles refunds, and how to stop organisers cancelling events without refunding attendees.

---

## Intended commercial model

We do **not** want to hold organiser money (legal/trustee obligations). The target flow:

```
Attendee pays: ticket price + booking fee (4.5% + 20p per ticket)
Organiser gets: full ticket price
Hub keeps:      booking fee (covers ~3% platform + ~1.5% Stripe + 20p per ticket)
```

- Ticket revenue should go to the **organiser's Stripe account**, not sit in the platform business account.
- The **booking fee** is the only Hub charge — it merges platform and payment processing into one attendee-facing fee. Organisers are **not** charged a separate 3% or Stripe deduction.
- Refunds should debit the **organiser's** Stripe balance, not the platform's.

**Stripe product for this:** [Stripe Connect](https://stripe.com/connect) with **destination charges**:

- Organiser receives the full ticket subtotal via `transfer_data.destination`
- Hub keeps the booking fee via `application_fee_amount`
- Stripe processing is covered from the booking fee
- Refunds come from the connected account

---

## What exists in the codebase today

### Payments (checkout)

- All checkout uses **one platform Stripe account** (`STRIPE_SECRET_KEY`) — see `STRIPE-AND-TICKETS.md`.
- Stripe Connect is **built** behind `STRIPE_CONNECT_ENABLED` — enable on Vercel for production.
- Checkout creates line items: ticket(s) + booking fee (`api/_lib/stripe-checkout.js`, `api/_lib/booking-fees.js`).

### Payouts (organiser dashboard)

- Organiser requests payout **after** event is archived + 7-day settlement period (`api/_lib/supabase-organiser-payouts.js`).
- Legacy payout breakdown shows **gross ticket sales = net payout** (organiser receives full ticket price; booking fee paid by attendees).
- Payout status: `pending_review` → `approved` → `paid` (manual platform admin review).
- Money effectively sits in the **platform Stripe balance** until approved payout — this does **not** match the intended Connect model.

### Event cancellation (organiser)

- Only **locked events** (events with ticket sales) can be cancelled via the cancellation flow.
- On cancel: `payout_held = true`, attendees get **event cancelled** email.
- Organiser must click **"Confirm refunds issued"** — this is **self-reported** (honour system).
- Clicking confirm currently sends **refund processed** emails to attendees **without verifying** refunds actually happened in Stripe.
- UI warns: failure to refund within 14 days may result in account suspension.

### Attendee cancellation (recently built)

- Attendee can cancel from My account (`/account/`) — upcoming events + payments tables.
- Modal shows organiser's refund policy and states refunds are handled by the organiser, not the platform.
- API: `POST /api/auth/cancel-booking`
- Attendee gets **booking cancelled** email.
- **Organiser does not get an email** when a single attendee cancels.
- No automatic Stripe refund is triggered.

### Refund webhook

- `charge.refunded` webhook handler exists (`api/_lib/stripe-refund-webhook.js`).
- When Stripe confirms a refund, attendee gets **refund processed** email.
- Only works if someone actually issues the refund in Stripe.

### Email templates (migration 066)

| Slug | Trigger |
|------|---------|
| `booking_cancelled` | Attendee cancels own booking |
| `event_cancelled` | Organiser cancels locked event |
| `refund_processed` | Stripe refund confirmed (webhook) or organiser clicks "confirm refunds" |

---

## Gaps & risks

| Gap | Risk |
|-----|------|
| No Stripe Connect at checkout | Money goes to Account, not organiser — legal/model mismatch |
| "Confirm refunds issued" is self-reported | Organiser can click without refunding; attendees get misleading emails |
| No automatic refunds on event cancel | Organiser must manually refund in Stripe |
| No organiser email on attendee cancel | Organiser may not know to refund |
| No refund button in dashboard | Refunds are manual in Stripe dashboard |
| Payout hold only blocks payout request | If payout already approved/paid, hold is too late |

---

## How to stop organisers cancelling without refunding

### Technical (primary — must build)

**1. Stripe Connect (required for correct money flow)**

- Organisers must complete Connect onboarding before publishing **paid** events.
- Checkout uses destination charges: full ticket price → organiser account; booking fee → Hub application fee.
- Booking fee line item → Hub only.

**2. Automatic refunds on event cancellation**

```
Organiser cancels event
  → Hub API calls Stripe refunds for every paid registration
  → Wait for charge.refunded webhook
  → Then send refund_processed email to each attendee
  → Organiser dashboard: "Refunds issued automatically"
  → Remove or repurpose "Confirm refunds issued" button
```

**3. Automatic or triggered refunds on attendee cancellation**

- If refund-eligible per organiser policy → Hub issues Stripe refund immediately (preferred).
- Or: organiser email + dashboard "Issue refund" button that calls Stripe API.

**4. Stripe-verified refund confirmation only**

- Never send "refund processed" or clear payout holds until Stripe webhook confirms each charge.
- Admin dashboard: flag registrations where `cancelled_at` is set but Stripe shows no refund.

### Policy & ops (backup)

- Suspend organiser account if refunds not complete within 14 days.
- Block publishing new paid events until refunds reconciled.
- Chargebacks: if attendees dispute via bank, Stripe claws back from whoever received funds.
- Locked events: events with sales cannot be silently unpublished.

### Payout gating (interim, before Connect)

- Never approve admin payout if event has cancellations or unpaid refund obligations.
- Compare Supabase `registrations` against Stripe PaymentIntent/refund status before approving.

---

## Recommended build order

### Phase 1 — Quick wins (no Connect required)

1. **Fix "confirm refunds"** — only send refund emails / clear holds when Stripe webhook confirms refunds (remove blind email blast on button click).
2. **Organiser email on attendee cancel** — `organiser_booking_cancelled` with attendee name, email, amount, refund eligibility, link to dashboard.
3. **Admin refund reconciliation view** — cancelled registrations not refunded in Stripe.

### Phase 2 — Stripe Connect

1. Connect onboarding flow for organisers.
2. Block paid event publish without connected account.
3. Destination charges at checkout with booking-fee-only application fee.
4. Booking fee retained by Hub.

### Phase 3 — Automatic refunds

1. Event cancellation → auto-refund all paid registrations via Stripe API.
2. Attendee cancellation (if eligible) → auto-refund or organiser-triggered refund from dashboard.
3. Payout blocked until all refunds reconciled with Stripe.

---

## Flow diagram (target state)

```
Attendee pays
  → Stripe Connect: full ticket price to organiser; booking fee to Hub
  → Booking fee to Hub

Event cancelled OR eligible attendee cancel
  → Hub calls Stripe Refunds API
  → Organiser connected balance debited
  → charge.refunded webhook fires
  → Attendee email sent
  → Registration marked Refunded
```

---

## Key files (for implementation)

| Area | Files |
|------|-------|
| Checkout | `api/_lib/stripe-checkout.js`, `api/_lib/booking-fees.js` |
| Webhook | `api/stripe-webhook.js`, `api/_lib/stripe-refund-webhook.js` |
| Payouts | `api/_lib/supabase-organiser-payouts.js` |
| Event cancel | `api/_lib/supabase-organiser-cancellations.js`, `js/organiser-dashboard.js` |
| Attendee cancel | `api/_lib/supabase-cancel-registration.js`, `js/attendee-dashboard.js` |
| Cancellation emails | `api/_lib/cancellation-emails.js`, `email-templates/` |
| Schema | `supabase/migrations/008_event_cancellations_payouts.sql`, `066_cancellation_refund_emails.sql` |
| Docs | `STRIPE-AND-TICKETS.md`, `legal-policies.html` (organiser refund obligations) |

---

## Decisions still to make

- [ ] **Attendee cancel:** Hub auto-refunds immediately, or organiser must action?
- [ ] **Booking fee on refund:** Is the booking fee refunded to attendee on organiser cancel? (Legal copy says full refund including mandatory booking fees on organiser cancel.)
- [ ] **Connect model:** Destination charges vs separate charges and transfers?
- [ ] **Interim:** Keep manual payout review until Connect is live, or pause paid events until Connect ships?

---

## Related legal copy

- Attendees: organiser cancel → full refund including booking fees, within 14 days (`legal-policies.html#refunds`).
- Organisers: must refund where required by law; via Hub/Stripe flow where possible (`legal-policies.html` organiser terms §3).

---

*Pick up tomorrow at Phase 1 unless Stripe Connect is prioritised first.*
