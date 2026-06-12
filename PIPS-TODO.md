# Pip's to-do list

**Launch target: 1 September 2026** (soft launch late August if checkout is done by end of June)

**Find this file:** search the repo for `PIPS-TODO` or open [`PIPS-TODO.md`](./PIPS-TODO.md) at the project root.

*Last updated: 12 June 2026*

---

## Project status (snapshot)

**Overall launch readiness: ~60%** — product code is ahead of production verification and comms.

| Area | Progress | Status |
|------|----------|--------|
| Core platform (browse, auth, accounts) | ~85% | Live on preview |
| Organiser groups & dashboard | ~75% | **~1,000+ groups already in Supabase**; claim + onboarding built |
| Checkout & payments | ~65% | Code done; **prod webhook, Resend, Connect flag** not verified |
| Email system | ~40% | 10+ templates in DB; **Resend on prod** not wired |
| SEO | ~65% | Sitemap, middleware meta, canonical/OG on static pages, breadcrumbs |
| AEO (AI / answer engines) | ~65% | `llms.txt`, 23 FAQs synced, head JSON-LD, machine discovery |
| Redirect & launch comms | ~5% | the-networker.co.uk redirect + email waves not started |

### Critical path (do these next)

1. **Prod checkout gate** — `STRIPE_WEBHOOK_SECRET` + one real ticket on production
2. **Resend on prod** — confirmation email after checkout
3. **`STRIPE_CONNECT_ENABLED=true`** — organisers receive full ticket price; Hub keeps booking fee only
4. **July beta email** — 50–100 groups: “Claim your profile, republish one event”
5. **August redirect** — the-networker.co.uk → hub

### Recently completed (June 2026)

- Booking confirmation email flow fixed (`complete-booking` + pending checkout data)
- Merged fee model: one booking fee (4.5% + 20p); organisers get full ticket price
- Stripe Connect destination charges aligned to booking-fee-only `application_fee`
- Event save/favourite wired to `/api/auth/favourites` on event detail
- First-login onboarding: tour → claim → profile review → first event
- Group profile claim flow; cancellation/refund emails; ticket-sales nudge cron
- SEO/AEO: `robots.txt`, `agents.txt`, `/sitemap.xml`, `/api/seo-meta`, FAQ sync (23 entries), `noindex` on private pages

### Post-launch (not September blockers)

Academy, seat-approval workflow, organiser messaging, review replies, PDF tickets, calendar export polish.

---

## Launch context

| Asset | Notes |
|-------|--------|
| **the-networker.co.uk** | Live 1+ year — trusted brand; launch = redirect + upgrade, not cold start |
| **Email database** | ~3,500 contacts — beta in July, wider rollout August, full list at launch |
| **Organiser groups** | **Already in Supabase** (~1,000+ networking group profiles) — ongoing Command Centre cleanup & quality |
| **Existing behaviour** | Organisers already add their own events on the old site — new hub must match that |

**September success (realistic):** 1,000+ group profiles browsable · 200–400 claimed & active · 500+ events · paid bookings + confirmation emails working · the-networker.co.uk redirecting to the hub.

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
| [x] | 2–3 | Migrations **001–070** run in Supabase |
| [x] | 2–3 | Merged booking-fee model (organisers receive full ticket price; Hub keeps booking fee) |
| [x] | 2–3 | Stripe Connect code + destination charges (flag: `STRIPE_CONNECT_ENABLED=true`) |
| [x] | 3 | Attendee dashboard wired to Supabase registrations |
| [x] | 3 | Attendee reviews — submit form + API + organiser profile display |
| [x] | 3 | Booking success page passes attendee details for email retry |
| [ ] | 3–4 | **Gate:** one real paid (or free) ticket end-to-end on production |
| [ ] | 4 | Organiser can publish an event on Supabase path without Airtable fallback |
| [x] | 4 | Event detail save/favourite wired to `hub-favourites.js` + `/api/auth/favourites` |
| [x] | 4 | SEO foundations: `robots.txt`, `sitemap.xml`, dynamic meta for events/organisers |

### July — Claims, cleanup, beta + SEO scale

| Done | Week | Task |
|:----:|------|------|
| [x] | 5 | Organiser groups live in Supabase (~1,000+ profiles) |
| [x] | 5 | Organiser **claim flow** — sign in with email on file → link to group profile |
| [x] | 5 | First-login onboarding: tour → claim → profile review → first event prompt |
| [ ] | 5–6 | Command Centre cleanup: incomplete profiles, logos, descriptions, VAT |
| [ ] | 5–6 | Finish Supabase cutover for any organiser dashboard routes still on Airtable |
| [x] | 6 | “New registration” email to organiser when someone books (code live; needs Resend on prod) |
| [ ] | 6 | Admin moderation queue usable for events + reviews |
| [x] | 6 | Stripe Connect Express onboarding built (enable on prod when checkout gate passes) |
| [ ] | 6–7 | Deploy SEO assets; confirm sitemap indexes all groups + published events |
| [ ] | 7 | **Beta email** to 50–100 organisers from the 3,500 list — “Claim your profile, republish one event” |
| [ ] | 7–8 | Fix beta feedback; target **20 groups** with at least 1 published event |
| [ ] | 8 | Load test: browse + organiser pages with 1,000+ group profiles |
| [ ] | 8 | Optional: city landing pages or server-side meta for top SEO win |

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
| [ ] | Stripe Connect enabled; one paid ticket tested with destination charge |
| [ ] | 1,000+ organiser group profiles browsable |
| [ ] | 200+ claimed groups (stretch goal) |
| [ ] | Support email monitored |
| [ ] | Command Centre admin login tested |

---

## Tab 1 — Supabase migrations

**Status: migrations 001–070 confirmed run** in production Supabase (11 June 2026).

| Migration | Status | Notes |
|-----------|--------|-------|
| 001–070 | [x] Run | Full schema, emails, claims, Connect, cancellations, nudge cron |
| 071–072 | Optional | Admin MFA added then removed — **do not run unless you want MFA back** |

Do not re-run 001–070. For new environments, run each file in `supabase/migrations/` in order through `073_publish_enables_ticket_sales.sql`.

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
| [x] | Cancellation, refund, welcome, saved-event nudge templates (migrations 064–066, 070) |
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
| [x] | Booking success page stores attendee email/name for confirmation flow |
| [ ] | Checkout → insert into `registrations` on **prod** (webhook + payment link metadata) |
| [ ] | Booking confirmation email on **prod** after checkout (needs Resend) |
| [ ] | Polish (post-launch OK): calendar export, mobile table layout |

**API routes:** `/api/stripe-webhook`, `/api/auth/create-checkout`, `/api/auth/complete-booking`, `/api/auth/reviews`, `/api/auth/favourites`

---

## Tab 5 — Organiser groups (already in Supabase)

| Done | Step |
|:----:|------|
| [x] | ~1,000+ networking group profiles in Supabase (`organisers` table) |
| [x] | Slugs + public pages: `/organisers/:slug` |
| [x] | Claim flow: organiser signs in with email on file → linked to profile |
| [x] | First-login onboarding pipeline (tour, claim, profile review, first event) |
| [ ] | Command Centre cleanup: incomplete profiles, logos, descriptions, VAT |
| [ ] | Republish path: organisers copy or recreate events from old site |
| [x] | Stripe Connect — Express onboarding for bank details (flag: `STRIPE_CONNECT_ENABLED=true`) |
| [ ] | Enable Connect on prod and test one paid ticket with destination charge |
| [ ] | July beta: **200+ groups claimed** and **20+ with a published event** |

**Fee model (current):**

- Attendee pays: ticket price + booking fee (4.5% + 20p per ticket)
- Organiser receives: **full ticket price**
- Hub keeps: booking fee (covers platform + payment processing)
- With Connect: money routes at checkout; Hub does not hold organiser balances

**How organisers add bank details (Stripe Connect):**

1. Set `STRIPE_CONNECT_ENABLED=true` in Vercel (and `STRIPE_SECRET_KEY`).
2. Organiser opens **Revenue & payout** → **Connect Stripe**.
3. Stripe Express onboarding (bank details on Stripe’s form).
4. Returns to dashboard — status syncs automatically.
5. Paid ticket revenue goes to their connected account.

Without Connect, paid revenue stays on the Hub Stripe account (legacy **Request payout** flow — avoid for production).

---

## Tab 6 — SEO & AEO

| Done | Step |
|:----:|------|
| [x] | `llms.txt` + `agents.txt` for AI crawlers |
| [x] | 23 FAQs synced: `hubert-faq.js` → `faq.html`, JSON-LD, `llms.txt` |
| [x] | `robots.txt` — allow public; block admin, account, organiser dashboard |
| [x] | `/sitemap.xml` — static pages + all groups + published events |
| [x] | `/api/seo-meta` — title, description, canonical, OG, JSON-LD for events/organisers |
| [x] | `noindex` on login, register, account, organiser dashboard, admin |
| [x] | `npm run build-seo` — rebuild FAQ, schema, llms after copy changes |
| [ ] | Verify sitemap after deploy: `/sitemap.xml` |
| [x] | Server-side meta injection (`middleware.js`) for `/events/:slug` and `/organisers/:slug` |
| [x] | Canonical + Open Graph on home, events browse, about, contact, FAQ, opportunities, training, legal |
| [x] | JSON-LD in `<head>` on static pages; BreadcrumbList on event/organiser pages |
| [x] | `/api/seo-meta?type=page&page=home` for static page meta |
| [ ] | City/region landing pages (post-beta) |

**Rebuild after FAQ edits:** `npm run build-seo`

---

## Tab 7 — Redirect & launch comms

| Done | Step |
|:----:|------|
| [ ] | Map old the-networker.co.uk URLs → new hub URLs |
| [ ] | DNS / hosting redirect for apex + www |
| [ ] | Segment 3,500 list: organisers vs attendees vs both |
| [ ] | July beta email (50–100 organisers) |
| [ ] | August wave email (500–1,000) |
| [ ] | 1 September full list + redirect live |

---

## Tab 8 — Quick links

| What | Where |
|------|--------|
| Command Centre | `/admin/index.html` |
| Email templates | `/admin/emails` |
| Attendee dashboard | `/account/index.html` |
| Review E2E test | `npm run test-review-e2e` |
| Env var reference | `.env.example` |
| Config check | `GET /api/auth/config-check` |
| Supabase setup | `SUPABASE-SETUP.md` |
| Checkout + email | `CHECKOUT-SETUP.md` |
| SEO / AEO | `robots.txt`, `agents.txt`, `llms.txt`, `/sitemap.xml`, `/api/seo-meta` |
| Rebuild FAQ + schema | `npm run build-seo` |
| Stripe Connect + refunds | `docs/REFUNDS-AND-STRIPE-CONNECT.md` |
| Auth & email notes | `AUTH-SETUP.md`, `SUPABASE-NO-EMAIL.md` |
| Compliance ops | `docs/COMPLIANCE-RUNBOOK.md` |

---

## Notes

- Migrations **001–070** are one-time per database — don't re-run after they've succeeded.
- **June gate** is prod checkout + confirmation email + Connect enabled — everything else scales from there.
- Organiser **groups are already in Supabase** — July/August focus is **claims, cleanup, republishing events**, and email waves (not a bulk import).
- Code for emails, Connect, claims, cancellations, favourites, and SEO is built — remaining work is **env vars, prod verification, group quality, and comms**.
- After editing FAQs run `npm run build-seo` before deploy.
- Add new items here so launch tasks stay in one place.
