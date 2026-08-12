# Membership

## What we are building

Per **organiser page** (group profile), organisers maintain a **Membership** (name, email, optional membership expiry). Members sign in with that email to unlock **Members only** ticket tiers at checkout. The hub enforces access server-side, flags expiring memberships for the organiser, and surfaces five practical reports (membership health, booked vs not booked for an event, new vs returning at an event, members who missed recent meetings, memberships expiring soon). Confirmed bookings flow straight into the attendee register and **name badge PDF** export.

Organisers can still renew people off-platform and update expiry dates manually. They can also **offer pay monthly or annually through the Hub** (Stripe Connect): members pay the published membership price (plus organiser VAT if set to “added”), plus a **booking fee (4.5% + 20p)** — same as tickets; organisers receive **100%** of the membership price they set (and membership VAT if added). Successful payments create/update the roster row and set `expires_at` from the Stripe billing period.

## In scope

- `organiser_member_roster` table (per `organiser_id`) — internal name; UI says **Membership**
- Membership CRUD + CSV import (organiser dashboard at `/organiser/#memberships`)
- Ticket visibility: `public` or `members_only` (membership unlock; no access codes)
- **Industry on membership list:** organisers can set each member’s industry/category (add, edit, CSV import/export). Used for Category Exclusivity — when a member books without applying, that industry shows on the event attendees list (falls back to Hub profile sector if set).
- **Category Exclusivity member invite:** organisers can email the Membership list from a CE event (**Invite members**). Active members book without applying; guests still apply for a seat.
- **Category Exclusivity + Member price:** optional Members only ticket on a CE event (different price from applications). Members signed in with their membership email see that ticket and book directly; guests still use Apply.
- **Category Exclusivity + Guest visits:** on Application based events, turn on Free trial visits under Set up tickets. Newcomers can book a complimentary visit; full places still go through Apply → approve (ticket optional if you use membership instead).
- Signed-in membership check at event page + checkout
- Auto-link membership row when member registers / signs in
- Invite email on add: **new accounts** get a sign-up invite; **existing Hub members** get a welcome email with the group’s next meeting (no duplicate sign-up prompt)
- Five organiser reports on the membership page
- Label PDF: only **confirmed** attendees (approved, paid or free)
- Booking reminder emails for members who have not booked a selected event
- Hub-billed memberships (monthly / annual) via Stripe Connect destination charges
  - `organiser_membership_plans` — monthly and/or annual price per organiser page
  - `POST /api/auth/membership-checkout` — member Checkout (`mode: subscription`)
  - `POST /api/auth/membership-portal` — Stripe Customer Portal (update card / cancel)
  - Webhooks sync roster `expires_at` / `subscription_status` from Stripe (`past_due` emails member + organiser)
  - Renewal/receipt email on successful `invoice.paid`
  - Public join CTA on organiser profile; renew/manage from My Hub → Memberships
  - **Invite to pay** from the member register (Actions) or when adding a member — emails the Join / renew link
  - Bulk **Invite unpaid / expiring to pay** (+ report buttons on Expiring / Lapsed)
  - Overview report shows estimated Hub MRR from active paid subscriptions

## Member emails — when they go out

| Trigger | When | Template |
|---------|------|----------|
| **Added to membership** | Immediately when organiser adds with “Email invite” ticked, or resend invite. CSV import queues invites (first batch sends straight away). | `member_roster_invite` / `member_roster_existing` |
| **Invite to pay** | Organiser invites one member or bulk-queues renewals | `member_roster_pay_invite` |
| **Payment failed** | Stripe renewal card fails (`past_due`) | `member_roster_payment_failed` (+ organiser copy) |
| **Renewal receipt** | Successful first payment or subscription renewal | `member_roster_renewal_receipt` |
| **New event published** | Sent when you publish an Approved event (all members processed on publish; daily cron catches anything missed) | `member_roster_new_event` |
| **Missed publish email** | Daily cron safety net for events published in the last 14 days | `member_roster_new_event` |
| **Rejoin / reinstated** | When a member is added back to an active membership | Upcoming live events (`member_roster_new_event`) |
| **Not booked reminder** | When organiser clicks **Email not booked** on the membership page | `member_roster_booking_reminder` |

Members see the group under **My Hub → My groups** once added. They book member tickets when signed in with their membership email.

## Hub-billed memberships — money flow

1. Organiser sets monthly and/or annual price on Memberships (requires Stripe Connect bank details).
2. Member joins from the organiser public page or renews from My Hub.
3. Checkout charges **membership (+ organiser VAT if added) + booking fee (4.5% + 20p)** each billing period.
4. Destination charge: organiser connected account receives the membership price; Hub keeps the fee (Stripe processing absorbed from the fee).
5. Webhooks update the roster expiry to the subscription period end.

## Security and lifecycle guarantees

- Membership is many-to-many: each `(organiser_id, normalized email)` row has its own `expires_at`.
- Member tiers are removed from public event payloads and direct public ticket reads.
- Checkout requires an authenticated session whose email matches an active, unexpired membership row for the event's organiser.
- Registration and login claim every active, unexpired membership row matching the account email.
- Once booked, member tickets use the same confirmation, reminder, event update, cancellation, refund, online-link and post-event review lifecycle as standard confirmed tickets.
- Hub-billed rows store `stripe_subscription_id` / `billing_interval`; cancelled subscriptions expire at period end.
- **CSV import** (authenticated organiser only): plain-text JSON body — not stored as a file. Limits: **5,000 rows / 512 KB** per import; **12 imports / 15 minutes** per organiser+IP; rejects binary-looking payloads; sanitises names; validates emails; dedupes duplicate emails in the same file. Membership CSV exports prefix formula-like cells (`=`, `+`, `-`, `@`) to reduce Excel/Sheets injection risk.

## Smoke test

```bash
npm run check:member-roster:local
# or: node scripts/smoke-test-member-roster.js http://localhost:3000
```

Uses `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD` (or `SMOKE_ORGANISER_*`) from `local.env`. Optional: `SMOKE_ATTENDEE_EMAIL` + `SMOKE_ATTENDEE_PASSWORD` for eligibility / My groups checks.

## Out of scope

- Paid membership seat limits (discuss later)
- Top / worst attendee league tables
- Proration / mid-cycle plan switches — follow-up
- Chapter industry exclusivity — follow-up
