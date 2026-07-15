# Member Roster (pre-launch)

## What we are building

Per **organiser page** (group profile), organisers maintain a **Member Roster** (name, email, optional membership expiry). Members sign in with that email to unlock **Members only** ticket tiers at checkout — no leaked access codes. The hub enforces access server-side, flags expiring memberships for the organiser, and surfaces five practical reports (roster health, booked vs not booked for an event, new vs returning at an event, members who missed recent meetings, memberships expiring soon). Confirmed bookings flow straight into the attendee register and **Avery label PDF** export. Full subscription billing (Phase 3) is **out of scope**; organisers renew members off-platform and update expiry dates on the roster.

## In scope

- `organiser_member_roster` table (per `organiser_id`)
- Roster CRUD + CSV import (organiser dashboard)
- Ticket visibility: `members_only` (+ existing `public` / `hidden`)
- Signed-in roster check at event page + checkout
- Auto-link roster row when member registers / signs in
- Five organiser reports on roster page
- Label PDF: only **confirmed** attendees (approved, paid or free)

## Out of scope

- Stripe membership renewals / chapter SaaS billing
- Paid roster seat limits (discuss later)
- Top / worst attendee league tables
