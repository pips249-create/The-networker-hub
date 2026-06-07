# Pip's to-do list

**Launch target: 1 September 2026** (soft launch late August if checkout is done by end of June)

**Find this file:** search the repo for `PIPS-TODO` or open [`PIPS-TODO.md`](./PIPS-TODO.md) at the project root.

*Last updated: 7 June 2026*

---

## Launch context

| Asset | Notes |
|-------|--------|
| **the-networker.co.uk** | Live 1+ year — trusted brand; launch = redirect + upgrade, not cold start |
| **Email database** | ~3,500 contacts — beta in July, wider rollout August, full list at launch |
| **Organiser CSV** | ~1,300 rows in `data/networking-groups-organisers.csv` — bulk import target **1,000+ profiles** |
| **Existing behaviour** | Organisers already add their own events on the old site — new hub must match that |

**September success (realistic):** 1,000+ organiser profiles live · 200–400 claimed & active · 500+ events · paid bookings + confirmation emails working · the-networker.co.uk redirecting to the hub.

**Post-launch (not September blockers):** Academy, seat-approval workflow, PDF tickets, calendar export, organiser review replies, saved-event email reminders.

---

## Tab 0 — Launch timeline (June → September 2026)

Work top-to-bottom within each month. Don't start August emails until July beta is stable.

### June — Money path (must finish this month)

| Done | Week | Task |
|:----:|------|------|
| [ ] | 1–2 | Stripe checkout → `registrations` (webhook live + `POST /api/auth/complete-booking` tested on prod) |
| [ ] | 1–2 | Set `STRIPE_WEBHOOK_SECRET` in Vercel; payment links include metadata `event_id` (+ optional `ticket_id`) |
| [ ] | 2 | Resend wired (Tab 2) + booking confirmation email on successful checkout |
| [ ] | 2–3 | Run migrations **025**, **026**, **027** in Supabase if not already (Tab 1) |
| [x] | 3 | Migration **028** — reviews unique index + organiser rating trigger |
| [x] | 3 | Attendee dashboard wired to Supabase registrations (no demo when Supabase configured) |
| [x] | 3 | Attendee reviews — submit form + API + organiser profile display |
| [ ] | 3–4 | **Gate:** one real paid (or free) ticket end-to-end on production |
| [ ] | 4 | Organiser can publish an event on Supabase path without Airtable fallback |

### July — Organiser readiness + beta

| Done | Week | Task |
|:----:|------|------|
| [ ] | 5 | Bulk import organisers: `node scripts/import-organisers-csv.js data/networking-groups-organisers.csv` |
| [ ] | 5 | Organiser **claim flow** — sign in with CSV email → link to organiser profile |
| [ ] | 5–6 | Finish Supabase cutover for organiser dashboard routes still on Airtable |
| [ ] | 6 | “New registration” email to organiser when someone books |
| [ ] | 6 | Admin moderation queue usable for events + reviews |
| [ ] | 7 | **Beta email** to 50–100 organisers from the 3,500 list — “Claim your profile, republish one event” |
| [ ] | 7–8 | Fix beta feedback; target **20 organisers** with at least 1 published event |
| [ ] | 8 | Load test: browse + organiser pages with 1,000+ profiles |

### August — Scale, redirect, comms

| Done | Week | Task |
|:----:|------|------|
| [ ] | 9 | Redirect plan: the-networker.co.uk → hub (home, browse, organiser slugs, event URLs) |
| [ ] | 9 | “We've upgraded” banner on old site for 2–4 weeks before hard redirect |
| [ ] | 10 | **Wider email** (500–1,000) — claim profile + help link; track claim rate |
| [ ] | 10–11 | FAQ / support inbox ready (login, publish event, bookings, payouts) |
| [ ] | 11 | Performance pass — pagination, images, API caching under load |
| [ ] | 11 | **Soft launch** — redirect + limited traffic |
| [ ] | 12 | **Full launch email** to remainder of 3,500 list |

### 1 September — Launch day checklist

| Done | Task |
|:----:|------|
| [ ] | the-networker.co.uk redirect live |
| [ ] | Checkout + confirmation email verified on prod |
| [ ] | 1,000+ organiser profiles browsable |
| [ ] | Support email monitored |
| [ ] | Command Centre admin login tested |

---

## Tab 1 — Supabase (run once in SQL Editor)

Run each migration **once** in [Supabase → SQL Editor](https://supabase.com/dashboard). Skip any you've already run.

| Done | Migration | What it does |
|:----:|-----------|--------------|
| [ ] | `supabase/migrations/025_organiser_creation_schema.sql` | Organiser/event/ticket columns, cancelled status |
| [ ] | `supabase/migrations/026_attendee_profile_fields.sql` | `business_sector`, `market_preferences` on attendees |
| [ ] | `supabase/migrations/027_email_templates.sql` | Email template table + 3 starter templates |
| [x] | `supabase/migrations/028_reviews_constraints.sql` | One review per attendee/event; organiser rating trigger |

**How:** open the file → copy all → paste in SQL Editor → Run.

**Verify reviews setup:** `npm run test-review-e2e`

---

## Tab 2 — Email (Resend — required before September launch)

The **Email Template Manager** works without Resend (edit & save in Command Centre). You **need** Resend for booking confirmations and launch emails.

| Done | Step |
|:----:|------|
| [ ] | Sign up at [resend.com](https://resend.com) |
| [ ] | Create an API key |
| [ ] | Add **`RESEND_API_KEY`** in Vercel → Project → Settings → Environment Variables |
| [ ] | Verify sending domain (the-networker.co.uk or hub domain) |
| [ ] | Add **`RESEND_FROM`**, e.g. `The Networker <hello@the-networker.co.uk>` |
| [ ] | Redeploy so env vars apply |
| [ ] | Command Centre → **Email templates** → Send test to yourself |

**Optional (password reset emails):** set `AUTH_SEND_EMAILS=true` — see `.env.example` and `AUTH-SETUP.md`.

---

## Tab 3 — Email templates (after Tab 1 migration 027)

| Done | Step |
|:----:|------|
| [ ] | Open [`/admin/emails`](https://the-networker-hub.vercel.app/admin/emails) (admin login required) |
| [ ] | Review/edit **Booking confirmation**, **Event reminder**, **New registration (organiser)** |
| [ ] | Wire `sendTemplatedEmail()` after checkout — helper in `api/_lib/send-template-email.js` |
| [ ] | Launch invite template (organiser “claim your profile”) — add in admin or one-off campaign |

---

## Tab 4 — Attendee dashboard & bookings

| Done | Step |
|:----:|------|
| [x] | Wire Supabase registrations into `/api/auth/attendee-dashboard` |
| [x] | Turn off demo data when Supabase is configured; empty state with browse link |
| [x] | Link event rows to event pages; show date, ticket, payment status, “View event” |
| [x] | Reviews — pending/done lists, leave-review modal, `POST /api/auth/reviews` |
| [ ] | Checkout → insert into `registrations` on prod (webhook + payment link metadata) |
| [ ] | Booking confirmation email to attendee after checkout |
| [ ] | Polish (post-launch OK): calendar export, saved-event reminders, mobile table layout |

**API routes already built:** `/api/stripe-webhook`, `/api/auth/complete-booking`, `/api/auth/reviews`

---

## Tab 5 — Organiser migration (1,000+ profiles)

| Done | Step |
|:----:|------|
| [ ] | Dry-run import locally against staging / small batch |
| [ ] | Import full CSV: `node scripts/import-organisers-csv.js data/networking-groups-organisers.csv` |
| [ ] | Slugs + public pages: `/organisers/:slug` for imported rows |
| [ ] | Claim flow: organiser signs in with email on file → linked to profile |
| [ ] | Republish path: organiser copies or recreates events from old site |
| [ ] | Stripe Connect check — organisers who take payment need payout onboarding |

---

## Tab 6 — Redirect & launch comms

| Done | Step |
|:----:|------|
| [ ] | Map old the-networker.co.uk URLs → new hub URLs |
| [ ] | DNS / hosting redirect for apex + www |
| [ ] | Segment 3,500 list: organisers vs attendees vs both |
| [ ] | July beta email (50–100 organisers) |
| [ ] | August wave email (500–1,000) |
| [ ] | 1 September full list + redirect live |

---

## Tab 7 — Quick links

| What | Where |
|------|--------|
| Command Centre | `/admin/index.html` |
| Email templates | `/admin/emails` |
| Attendee dashboard | `/account/index.html` |
| Review E2E test | `npm run test-review-e2e` |
| Organiser CSV import | `scripts/import-organisers-csv.js` |
| Env var reference | `.env.example` |
| Supabase setup | `SUPABASE-SETUP.md` |
| Auth & email notes | `AUTH-SETUP.md`, `SUPABASE-NO-EMAIL.md` |
| Big-picture roadmap | `NETWORKER-HUB-ROADMAP.md` |

---

## Notes

- Migrations are **one-time per database** — don't re-run after they've succeeded.
- **June gate** is checkout + confirmation email — everything else depends on it.
- Importing 1,300 organiser rows is fast; **getting 200+ to claim profiles** needs the July/August email waves.
- Add new items here so launch tasks stay in one place.
