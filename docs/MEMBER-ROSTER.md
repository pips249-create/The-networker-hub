# Member Roster (pre-launch)

## What we are building

Per **organiser page** (group profile), organisers maintain a **Member Roster** (name, email, optional membership expiry). Members sign in with that email to unlock **Members only** ticket tiers at checkout. The hub enforces access server-side, flags expiring memberships for the organiser, and surfaces five practical reports (roster health, booked vs not booked for an event, new vs returning at an event, members who missed recent meetings, memberships expiring soon). Confirmed bookings flow straight into the attendee register and **Avery label PDF** export. Full subscription billing (Phase 3) is **out of scope**; organisers renew members off-platform and update expiry dates on the roster.

## In scope

- `organiser_member_roster` table (per `organiser_id`)
- Roster CRUD + CSV import (organiser dashboard)
- Ticket visibility: `public` or `members_only` (roster unlock; no access codes)
- Signed-in roster check at event page + checkout
- Auto-link roster row when member registers / signs in
- Invite email on roster add: **new accounts** get a sign-up invite; **existing Hub members** get a welcome email with the group’s next meeting (no duplicate sign-up prompt)
- Five organiser reports on roster page
- Label PDF: only **confirmed** attendees (approved, paid or free)

## Security and lifecycle guarantees

- Membership is many-to-many: each `(organiser_id, normalized email)` row has its own `expires_at`.
- Member tiers are removed from public event payloads and direct public ticket reads.
- Checkout requires an authenticated session whose email matches an active, unexpired roster row for the event's organiser.
- Registration and login claim every active, unexpired roster row matching the account email.
- Once booked, member tickets use the same confirmation, reminder, event update, cancellation, refund, online-link and post-event review lifecycle as standard confirmed tickets.

## Out of scope

- Stripe membership renewals / chapter SaaS billing
- Paid roster seat limits (discuss later)
- Top / worst attendee league tables
