# Pip's to-do list

**Launch target: 1 September 2026** (soft launch late August if checkout is done by end of June)

**Find this file:** search the repo for `PIPS-TODO` or open [`PIPS-TODO.md`](./PIPS-TODO.md) at the project root.

*Last updated: 11 June 2026*

---

## Launch context

| Asset | Notes |
|-------|--------|
| **the-networker.co.uk** | Live 1+ year — trusted brand; launch = redirect + upgrade, not cold start |
| **Email database** | ~3,500 contacts — beta in July, wider rollout August, full list at launch |
| **Organiser CSV** | ~1,300 rows in `data/networking-groups-organisers.csv` — bulk import target **1,000+ profiles** |
| **Existing behaviour** | Organisers already add their own events on the old site — new hub must match that |

**September success (realistic):** 1,000+ organiser profiles live · 200–400 claimed & active · 500+ events · paid bookings + confirmation emails working · the-networker.co.uk redirecting to the hub.

**Post-launch (not September blockers):** Academy, seat-approval workflow, PDF tickets, calendar export, organiser review replies.

---

## Tab 0 — Launch timeline (June → September 2026)

Work top-to-bottom within each month. Don't start August emails until July beta is stable.

### June — Money path (must finish this month)

| Done | Week | Task |
|:----:|------|------|
| [x] | 1–2 | Code: Stripe checkout → `registrations` (`POST /api/stripe-webhook` + `POST /api/auth/complete-booking`) |
| [ ] | 1–2 | **Prod gate:** set `STRIPE_WEBHOOK_SECRET` in Vercel; verify webhook on live Stripe endpoint |
| [x] | 2 | Code: `sendRegistrationEmails()` fires `booking_confirmation` + `organiser_new_registration` after checkout |
| [ ] | 2 | **Prod gate:** Resend wired (Tab 2) + one real confirmation email received after test checkout |
| [x] | 2–3 | Migrations **001–070** run in Supabase (all current schema + email templates) |
| [x] | 3 | Attendee dashboard wired to Supabase registrations (no demo when Supabase configured) |
| [x] | 3 | Attendee reviews — submit form + API + organiser profile display |
| [ ] | 3–4 | **Gate:** one real paid (or free) ticket end-to-end on production |
| [ ] | 4 | Organiser can publish an event on Supabase path without Airtable fallback |
| [x] | 4 | Event detail save/favourite wired to `hub-favourites.js` + `/api/auth/favourites` |

### July — Organiser readiness + beta

| Done | Week | Task |
|:----:|------|------|
| [ ] | 5 | Bulk import organisers: `node scripts/import-organisers-csv.js data/networking-groups-organisers.csv` |
| [x] | 5 | Organiser **claim flow** — sign in with CSV email → link to organiser profile |
| [x] | 5 | First-login onboarding: tour → claim → profile review → first event prompt |
| [ ] | 5–6 | Finish Supabase cutover for organiser dashboard routes still on Airtable |
| [x] | 6 | “New registration” email to organiser when someone books (code live; needs Resend on prod) |
| [ ] | 6 | Admin moderation queue usable for events + reviews |
| [x] | 6 | Stripe Connect code live — organisers onboard bank details via Express (needs `STRIPE_CONNECT_ENABLED=true`) |
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

## Tab 1 — Supabase migrations

**Status: all migrations 001–070 have been run** in Supabase (confirmed 11 June 2026).

Do not re-run. For new environments only, run each file in `supabase/migrations/` in order through `070_event_ticket_sales_nudge.sql`.

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
| [ ] | Command Centre → **Email templates** → Send test to yourself (must be on safe test list) |
| [ ] | **Test checkout:** buy a ticket → confirmation email received |

**Safe test recipients** are in `email_test_recipients` (migration 051 + 052). Add your address in Command Centre if test sends are blocked.

**Optional (password reset emails):** set `AUTH_SEND_EMAILS=true` — see `.env.example` and `AUTH-SETUP.md`.

**Config check:** `GET /api/auth/config-check` — confirms `emailSendingConfigured`.

---

## Tab 3 — Email templates

| Done | Step |
|:----:|------|
| [x] | `booking_confirmation`, `booking_reminder`, `organiser_new_registration` templates in DB (migrations 027+) |
| [x] | `sendTemplatedEmail()` wired after checkout via `api/_lib/registration-emails.js` |
| [ ] | Review/edit templates at [`/admin/emails`](https://the-networker-hub.vercel.app/admin/emails) |
| [ ] | Launch invite template (organiser “claim your profile”) — add in admin or one-off campaign |

---

## Tab 4 — Attendee dashboard & bookings

| Done | Step |
|:----:|------|
| [x] | Wire Supabase registrations into `/api/auth/attendee-dashboard` |
| [x] | Turn off demo data when Supabase is configured; empty state with browse link |
| [x] | Link event rows to event pages; show date, ticket, payment status, “View event” |
| [x] | Reviews — pending/done lists, leave-review modal, `POST /api/auth/reviews` |
| [x] | Booking cancellation + refund policy emails |
| [x] | Saved events — browse, account, and event detail pages use `/api/auth/favourites` |
| [x] | Saved-event ticket-sales nudge cron (migration 070) |
| [ ] | Checkout → insert into `registrations` on **prod** (webhook + payment link metadata) |
| [ ] | Booking confirmation email on **prod** after checkout (needs Resend) |
| [ ] | Polish (post-launch OK): calendar export, mobile table layout |

**API routes:** `/api/stripe-webhook`, `/api/auth/create-checkout`, `/api/auth/complete-booking`, `/api/auth/reviews`, `/api/auth/favourites`

---

## Tab 5 — Organiser migration (1,000+ profiles)

| Done | Step |
|:----:|------|
| [ ] | Dry-run import locally against staging / small batch |
| [ ] | Import full CSV: `node scripts/import-organisers-csv.js data/networking-groups-organisers.csv` |
| [x] | Slugs + public pages: `/organisers/:slug` for imported rows |
| [x] | Claim flow: organiser signs in with email on file → linked to profile |
| [ ] | Republish path: organiser copies or recreates events from old site |
| [x] | Stripe Connect — Express onboarding for bank details (flag: `STRIPE_CONNECT_ENABLED=true`) |
| [ ] | Enable Connect on staging/prod and test one paid ticket with destination charge |

**How organisers add bank details (Stripe Connect):**

1. Set `STRIPE_CONNECT_ENABLED=true` in Vercel (and `STRIPE_SECRET_KEY`).
2. Organiser opens **Revenue & payout** on the dashboard — banner: **Connect Stripe**.
3. Click → hub creates a Stripe Express account → redirects to Stripe’s hosted onboarding.
4. Organiser enters bank account, identity, and business details on Stripe’s form.
5. Returns to `/organiser/index.html#events-revenue` — status synced automatically.
6. Paid ticket revenue routes to their connected account (Hub keeps the booking fee only).

Without Connect enabled, paid revenue stays on the Hub Stripe account and organisers use the legacy **Request payout** flow after the event is archived + 7-day settlement.

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
| Checkout + email | `CHECKOUT-SETUP.md` |
| Stripe Connect + refunds | `docs/REFUNDS-AND-STRIPE-CONNECT.md` |
| Auth & email notes | `AUTH-SETUP.md`, `SUPABASE-NO-EMAIL.md` |
| Big-picture roadmap | `NETWORKER-HUB-ROADMAP.md` |

---

## Notes

- Migrations are **one-time per database** — don't re-run after they've succeeded.
- **June gate** is prod checkout + confirmation email — everything else depends on it.
- Importing 1,300 organiser rows is fast; **getting 200+ to claim profiles** needs the July/August email waves.
- Code for emails, Connect, claims, and cancellations is built — remaining work is mostly **env vars, prod verification, import, and comms**.
- Add new items here so launch tasks stay in one place.
