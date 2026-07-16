# Membership (pre-launch)

## What we are building

Per **organiser page** (group profile), organisers maintain a **Membership** (name, email, optional membership expiry). Members sign in with that email to unlock **Members only** ticket tiers at checkout. The hub enforces access server-side, flags expiring memberships for the organiser, and surfaces five practical reports (membership health, booked vs not booked for an event, new vs returning at an event, members who missed recent meetings, memberships expiring soon). Confirmed bookings flow straight into the attendee register and **Avery label PDF** export. Organisers renew members off-platform and update expiry dates on the membership.

## In scope

- `organiser_member_roster` table (per `organiser_id`) — internal name; UI says **Membership**
- Membership CRUD + CSV import (organiser dashboard)
- Ticket visibility: `public` or `members_only` (membership unlock; no access codes)
- Signed-in membership check at event page + checkout
- Auto-link membership row when member registers / signs in
- Invite email on add: **new accounts** get a sign-up invite; **existing Hub members** get a welcome email with the group’s next meeting (no duplicate sign-up prompt)
- Five organiser reports on the membership page
- Label PDF: only **confirmed** attendees (approved, paid or free)
- Booking reminder emails for members who have not booked a selected event

## Member emails — when they go out

There is **no fixed launch date** (e.g. 1 September) when all members are emailed in one batch.

| Trigger | When | Template |
|---------|------|----------|
| **Added to membership** | Immediately when organiser adds/imports with “send invite” ticked (or resend invite) | `member_roster_invite` / `member_roster_existing` |
| **New event published** | When organiser publishes an Approved event | `member_roster_new_event` |
| **Missed publish email** | Daily cron safety net for events published in the last 14 days | `member_roster_new_event` |
| **Rejoin / reinstated** | When a member is added back to an active membership | Upcoming live events (`member_roster_new_event`) |
| **Not booked reminder** | When organiser clicks **Email not booked** on the membership page | `member_roster_booking_reminder` |

Members see the group under **My Hub → My groups** once added. They book member tickets when signed in with their membership email.

## Security and lifecycle guarantees

- Membership is many-to-many: each `(organiser_id, normalized email)` row has its own `expires_at`.
- Member tiers are removed from public event payloads and direct public ticket reads.
- Checkout requires an authenticated session whose email matches an active, unexpired membership row for the event's organiser.
- Registration and login claim every active, unexpired membership row matching the account email.
- Once booked, member tickets use the same confirmation, reminder, event update, cancellation, refund, online-link and post-event review lifecycle as standard confirmed tickets.

## Smoke test

```bash
npm run check:member-roster:local
# or: node scripts/smoke-test-member-roster.js http://localhost:3000
```

Uses `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD` (or `SMOKE_ORGANISER_*`) from `local.env`. Optional: `SMOKE_ATTENDEE_EMAIL` + `SMOKE_ATTENDEE_PASSWORD` for eligibility / My groups checks.

## Out of scope

- Stripe membership renewals / chapter SaaS billing (Phase 3 abandoned)
- Paid membership seat limits (discuss later)
- Top / worst attendee league tables
