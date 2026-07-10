# Pip's to-do list

**Launch target: 1 September 2026** (soft launch late August if checkout is done by end of June)

**Find this file:** search the repo for `PIPS-TODO` or open [`PIPS-TODO.md`](./PIPS-TODO.md) at the project root.

*Last updated: 9 July 2026*

---

## Project status (snapshot)

**Overall launch readiness: ~80%** — money path, claim onboarding, and conference type done; SEO domain setup, comms send, and business ops remain.

| Area | Progress | Status |
|------|----------|--------|
| Core platform (browse, auth, accounts) | ~90% | Live on preview |
| Organiser groups & dashboard | ~90% | **~1,000+ groups in Supabase**; profiles tidied; auto-approve; Supabase-only |
| Checkout & payments | ~90% | Prod checkout tested; Connect enabled — **destination charge test + refund spot-check** remain |
| Email system | ~85% | Resend on prod; confirmation sends — **SPF/DKIM, cron reminders, allowlist off at launch** remain |
| SEO | ~70% | Foundations built — **domain, GSC, sitemap verify, redirect** remain |
| AEO (AI / answer engines) | ~70% | `llms.txt`, FAQs, JSON-LD — **gate-off discovery + canonical alignment** remain |
| Business ops | ~75% | Product + runbooks — **`npm run check:business-ops`** — ICO verify, DNS, DPAs, solicitor remain |
| Redirect & launch comms | ~5% | the-networker.co.uk redirect + email waves not started |

### Critical path (do these next)

1. **Connect destination charge test** — one paid ticket; verify money split in Stripe (see Tab 9)
2. **100% gates** — finish remaining items in Tabs 4–6, 9–10 below
3. **July beta email** — 50–100 groups: “Claim your profile, republish one event”
4. **SEO pre-launch** — `SITE_URL`, GSC, sitemap verify (`docs/SEO-AEO-LAUNCH-PLAN.md`)
5. **August redirect** — the-networker.co.uk → hub

### Recently completed (July 2026)

- **Conference** event type + browse filter (`135_event_type_conference.sql`)
- **Conference/exhibition organiser guide** (`guides/list-a-conference-or-exhibition.html`)
- **Onboarding polish** — 2-step dashboard tour, Hubert on Overview, resume banner, `?onboard=claim` deep-link
- **Beta email playbook** — `docs/BETA-EMAIL-JULY.md`; claim invite template + default claim URL updated
- Prod Stripe checkout tested end-to-end
- Resend on prod — confirmation emails send correctly
- `STRIPE_CONNECT_ENABLED=true` on production
- All organiser profiles tidied (Command Centre cleanup)
- Supabase-only — no Airtable in production paths
- Events and organiser groups on **auto-approve** (opportunities still pre-publish moderated)

### Recently completed (June 2026)

- Booking confirmation email flow fixed (`complete-booking` + pending checkout data)
- Merged fee model: one booking fee (4.5% + 20p); organisers get full ticket price
- Stripe Connect destination charges aligned to booking-fee-only `application_fee`
- Event save/favourite wired to `/api/auth/favourites` on event detail
- First-login onboarding: tour → claim → profile review → first event
- Group profile claim flow; cancellation/refund emails; ticket-sales nudge cron
- SEO/AEO: `robots.txt`, `agents.txt`, `/sitemap.xml`, `/api/seo-meta`, FAQ sync (23 entries), `noindex` on private pages

### Post-launch (not September blockers)

Training and workshops, seat-approval workflow, organiser messaging, review replies, PDF tickets, calendar export polish.

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
| [x] | 1–2 | **Prod gate:** set `STRIPE_WEBHOOK_SECRET` in Vercel; verify webhook on live Stripe endpoint |
| [x] | 2 | Code: `sendRegistrationEmails()` fires `booking_confirmation` + `organiser_new_registration` after checkout |
| [x] | 2 | **Prod gate:** Resend wired (Tab 2) + one real confirmation email received after test checkout |
| [x] | 2–3 | Migrations **001–070** run in Supabase |
| [x] | 2–3 | Merged booking-fee model (organisers receive full ticket price; Hub keeps booking fee) |
| [x] | 2–3 | Stripe Connect code + destination charges (flag: `STRIPE_CONNECT_ENABLED=true`) |
| [x] | 3 | Attendee dashboard wired to Supabase registrations |
| [x] | 3 | Attendee reviews — submit form + API + organiser profile display |
| [x] | 3 | Booking success page passes attendee details for email retry |
| [x] | 3–4 | **Gate:** one real paid (or free) ticket end-to-end on production |
| [x] | 4 | Organiser can publish an event on Supabase path without Airtable fallback |
| [x] | 4 | Event detail save/favourite wired to `hub-favourites.js` + `/api/auth/favourites` |
| [x] | 4 | SEO foundations: `robots.txt`, `sitemap.xml`, dynamic meta for events/organisers |

### July — Claims, cleanup, beta + SEO scale

| Done | Week | Task |
|:----:|------|------|
| [x] | 5 | Organiser groups live in Supabase (~1,000+ profiles) |
| [x] | 5 | Organiser **claim flow** — sign in with email on file → link to group profile |
| [x] | 5 | First-login onboarding: tour → claim → profile review → first event prompt |
| [x] | 5–6 | Command Centre cleanup: incomplete profiles, logos, descriptions, VAT |
| [x] | 5–6 | Finish Supabase cutover for any organiser dashboard routes still on Airtable |
| [x] | 6 | “New registration” email to organiser when someone books (Resend on prod) |
| [x] | 6 | Events + groups auto-approve; reviews/opportunities still moderated |
| [x] | 6 | Stripe Connect enabled on prod (`STRIPE_CONNECT_ENABLED=true`) |
| [ ] | 6–7 | Deploy SEO assets; confirm sitemap indexes all groups + published events |
| [ ] | 7 | **Beta email** to 50–100 organisers — see `docs/BETA-EMAIL-JULY.md` |
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
| [x] | Checkout + confirmation email verified on prod |
| [ ] | Stripe Connect destination charge test passed (Tab 9) |
| [x] | 1,000+ organiser group profiles browsable |
| [ ] | 200+ claimed groups (stretch goal) |
| [ ] | Support email monitored (hello@thenetworkerhub.com) |
| [ ] | Command Centre admin login tested |
| [ ] | **Business ops** — Tab 10 gates complete (or consciously deferred with owner) |
| [ ] | SEO/AEO — Tab 6 + `docs/SEO-AEO-LAUNCH-PLAN.md` launch-week steps |
| [ ] | `EMAIL_ALLOWLIST_DISABLED=true` on launch (if allowlist was on) |
| [ ] | `SITE_ACCESS_PASSWORD` removed — public gate off (~28 August) |

---

## Tab 1 — Supabase migrations

**Status: migrations 001–124** — run any new files in `supabase/migrations/` in order on production.

| Migration | Status | Notes |
|-----------|--------|-------|
| 001–124 | Run through prod | Full schema through opportunity moderation, platform admin emails |
| 071–072 | Optional | Admin MFA added then removed — **do not run unless you want MFA back** |

**Verify reviews setup:** `npm run test-review-e2e`

---

## Tab 2 — Email (Resend — required before September launch)

The **Email Template Manager** works without Resend (edit & save in Command Centre). Resend is live on prod.

### 100% email system gate

| Done | Step |
|:----:|------|
| [x] | Sign up at [resend.com](https://resend.com) |
| [x] | Create an API key |
| [x] | Add **`RESEND_API_KEY`** in Vercel → Project → Settings → Environment Variables |
| [x] | Verify sending domain (the-networker.co.uk or hub domain) |
| [x] | Add **`RESEND_FROM`**, e.g. `The Networker <hello@thenetworkerhub.com>` |
| [x] | Redeploy so env vars apply |
| [x] | Command Centre → **Email templates** → Send test to yourself |
| [x] | **Test checkout:** buy a ticket → confirmation email received |
| [ ] | **SPF + DKIM + DMARC** on sending domain (not `onboarding@resend.dev`) |
| [ ] | **`CRON_SECRET`** set in Vercel Production — booking reminders + saved-event nudges |
| [ ] | Spot-check: `booking_cancelled`, `event_cancelled`, `refund_processed`, welcome email |
| [ ] | Review/edit templates at [`/admin/emails`](https://the-networker-hub.vercel.app/admin/emails) |
| [ ] | Launch invite template (organiser “claim your profile”) — add in admin or campaign tool |
| [ ] | At launch: **`EMAIL_ALLOWLIST_DISABLED=true`** if pre-launch allowlist was on |
| [ ] | Optional: `AUTH_SEND_EMAILS=true` for password-reset emails |

**Safe test recipients** are in `email_test_recipients` (migration 051 + 052). Add your address in Command Centre if test sends are blocked.

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

## Tab 4 — Checkout & payments (100% gate)

| Done | Step |
|:----:|------|
| [x] | `STRIPE_SECRET_KEY` in Vercel (test or live — decide before public launch) |
| [x] | `STRIPE_WEBHOOK_SECRET` + webhook endpoint `checkout.session.completed` |
| [x] | `STRIPE_CONNECT_ENABLED=true` |
| [x] | Paid checkout → `registrations` row in Supabase |
| [x] | Ticket appears on `/account/index.html` |
| [x] | `booking_confirmation` + `organiser_new_registration` emails |
| [ ] | **Connect destination charge test** (Tab 9) — verify money split in Stripe |
| [ ] | Free ticket path: `POST /api/auth/complete-booking` without Stripe |
| [ ] | `charge.refunded` webhook → `refund_processed` email (spot-check) |
| [ ] | `GET /api/auth/config-check` → `checkoutReady: true`, `stripeConnectEnabled: true` |
| [ ] | Switch to **`sk_live_…`** before taking real public money (if still on test) |
| [ ] | Organiser Revenue tab shows sales after Connect checkout |

**API routes:** `/api/stripe-webhook`, `/api/auth/create-checkout`, `/api/auth/complete-booking`

---

## Tab 4b — Attendee dashboard & bookings

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
| [x] | Checkout → insert into `registrations` on **prod** |
| [x] | Booking confirmation email on **prod** after checkout |
| [ ] | Polish (post-launch OK): calendar export, mobile table layout |

**API routes:** `/api/stripe-webhook`, `/api/auth/create-checkout`, `/api/auth/complete-booking`, `/api/auth/reviews`, `/api/auth/favourites`

---

## Tab 5 — Organiser groups & dashboard (100% gate)

| Done | Step |
|:----:|------|
| [x] | ~1,000+ networking group profiles in Supabase (`organisers` table) |
| [x] | Slugs + public pages: `/organisers/:slug` |
| [x] | Claim flow: organiser signs in with email on file → linked to profile |
| [x] | First-login onboarding pipeline (tour, claim, profile review, first event) |
| [x] | Command Centre cleanup: profiles, logos, descriptions, VAT |
| [x] | Supabase-only — no Airtable in production |
| [x] | Events + groups **auto-approve** when publish criteria met |
| [x] | Stripe Connect Express onboarding + `STRIPE_CONNECT_ENABLED=true` on prod |
| [ ] | **Connect destination charge test** (Tab 9) |
| [ ] | July beta: **200+ groups claimed** and **20+ with a published event** |
| [ ] | Load test: browse + organiser pages with 1,000+ profiles (week 8) |
| [ ] | Republish path documented for organisers copying events from old site |

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

## Tab 6 — SEO & AEO (100% gate)

| Done | Step |
|:----:|------|
| [x] | `llms.txt` + `agents.txt` for AI crawlers |
| [x] | 23 FAQs synced: `hubert-faq.js` → `faq.html`, JSON-LD, `llms.txt` |
| [x] | `robots.txt` — allow public; block admin, account, organiser dashboard |
| [x] | `/sitemap.xml` — static pages + all groups + published events |
| [x] | `/api/seo-meta` — title, description, canonical, OG, JSON-LD for events/organisers |
| [x] | `noindex` on login, register, account, organiser dashboard, admin |
| [x] | `npm run build-seo` — rebuild FAQ, schema, llms after copy changes |
| [x] | Server-side meta injection (`middleware.js`) for `/events/:slug` and `/organisers/:slug` |
| [x] | Canonical + Open Graph on home, events browse, about, contact, FAQ, opportunities, training, legal |
| [x] | JSON-LD in `<head>` on static pages; BreadcrumbList on event/organiser pages |
| [ ] | **`SITE_URL`** in Vercel Production = `https://www.thenetworkerhub.com` (exact canonical) |
| [ ] | Verify `/sitemap.xml` after deploy — counts match published events + organisers |
| [ ] | Align hard-coded `the-networker.co.uk` canonical leftovers; run `npm run build-seo` |
| [ ] | **Google Search Console** — verify `www.thenetworkerhub.com`; submit sitemap |
| [ ] | **Google Business Profile** — Software company; Magpas HQ; hub URL |
| [ ] | Launch week: remove `SITE_ACCESS_PASSWORD` → confirm `/robots.txt` Allow, `/llms.txt` 200 |
| [ ] | `the-networker.co.uk` 301 redirect map ready (Tab 7) |
| [ ] | City/region landing pages (post-launch — not a 100% blocker) |

**Full plan:** `docs/SEO-AEO-LAUNCH-PLAN.md`

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

## Tab 9 — Connect destination charge test (one-time prod proof)

**What it is:** A single paid ticket purchase that proves Stripe Connect is routing money correctly — not just that checkout “works.”

With `STRIPE_CONNECT_ENABLED=true`, checkout uses **destination charges** on the platform account. The attendee pays ticket price + booking fee; the organiser receives the **full ticket price** via transfer; the Hub keeps only the **booking fee** as `application_fee_amount` (Stripe processing comes out of that fee).

```
Attendee pays £10 ticket + £0.65 booking fee = £10.65 total
  → £10.00 lands in organiser’s Stripe Express balance
  → £0.65 lands in Hub platform balance (application fee)
  → Webhook creates registration in Supabase
```

This is different from the legacy flow where all money sat in the Hub Stripe account until manual payout.

### How to run the test (~15 minutes)

| Step | Action |
|------|--------|
| 1 | Pick (or create) a **test organiser group** you control |
| 2 | Organiser dashboard → **Revenue** → **Connect Stripe** → complete Express onboarding |
| 3 | Publish a **paid event** (e.g. £5–£10 ticket) for that group |
| 4 | Sign in as a **different attendee account** → **Buy ticket** → complete payment |
| 5 | Confirm Hub: registration row in Supabase, ticket on `/account/`, both emails sent |
| 6 | Confirm **Stripe Dashboard → Connect → connected account** → Payment shows **full ticket amount** |
| 7 | Confirm **Stripe Dashboard → platform account** → Payment shows **application fee only** (booking fee), not the full ticket |
| 8 | Optional but recommended: issue a **partial refund** in Stripe → confirm `refund_processed` email |

### Pass criteria

- [ ] Payment appears on the **organiser’s** connected account (not only on platform)
- [ ] Platform balance increased by **booking fee only**
- [ ] `registrations` row has correct `amount_paid` / payment status
- [ ] `hub_checkout` metadata = `connect_destination` on the PaymentIntent (Stripe Dashboard)

**Guide:** `docs/STRIPE-CONNECT-ORGANISER-GUIDE.md` · **Refunds:** `docs/REFUNDS-AND-STRIPE-CONNECT.md`

---

## Tab 10 — Business ops (September launch)

Non-code gates from `docs/COMPLIANCE-RUNBOOK.md`. Product compliance is largely built in; these are **your** actions.

### Must-have before public launch

| Done | Item | Owner |
|:----:|------|-------|
| [x] | **Support inbox** runbook — `docs/SUPPORT-INBOX-RUNBOOK.md` | Catherine |
| [ ] | **SPF + DKIM + DMARC** — follow `docs/EMAIL-DNS-SETUP.md` | Tech |
| [ ] | **ICO registration** — verify on register (`docs/ICO-REGISTRATION.md`) | Catherine |
| [ ] | Command Centre admin login tested on prod | Ops |
| [x] | Refund policy enforcement — server guards + `npm run test:refund-policy` | Product |
| [x] | Opportunity moderation owner assigned (`docs/OPPORTUNITY-MODERATION.md`) | Catherine |

### Should-have before scaling paid ticketing

| Done | Item | Owner |
|:----:|------|-------|
| [x] | **DPAs filed** — `docs/DPA-SUBPROCESSORS.md` + `docs/DPA-REGISTER.md` + `npm run check:dpas` | Catherine |
| [ ] | Solicitor review of `legal-policies.html` | Catherine |
| [x] | GDPR SAR owner named (`docs/GDPR-SAR-PROCEDURE.md`) | Catherine |
| [x] | Data breach incident lead named (`docs/DATA-BREACH-RESPONSE.md`) | Catherine |
| [ ] | VAT guidance for organisers — Finance sign-off (`docs/VAT-ORGANISER-GUIDANCE.md`) | Finance |
| [ ] | HMRC platform reporting mapped with accountant (`docs/HMRC-PLATFORM-OPERATORS.md`) | Finance |
| [ ] | Platform liability / cyber insurance | Catherine |
| [ ] | Legacy marketing opt-in re-permission — run `scripts/audit-legacy-marketing-opt-in.js` | Marketing |

### Already in the product

Legal policies, cookie consent, terms at registration, pre-checkout acknowledgement, organiser terms, opportunity disclaimers, earnings attestation, paid-checkout refund guard, review reporting, RoPA, SAR procedure, breach runbook, OSA risk doc, compliance readiness script (`npm run check:business-ops`).

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
| Stripe Connect test | `PIPS-TODO.md` Tab 9 |
| Business ops / compliance | `docs/COMPLIANCE-RUNBOOK.md` · Tab 10 |
| Subprocessor DPAs | `docs/DPA-SUBPROCESSORS.md` · `npm run check:dpas` |
| SEO launch week | `docs/SEO-AEO-LAUNCH-PLAN.md` |
| Stripe Connect + refunds | `docs/REFUNDS-AND-STRIPE-CONNECT.md` |
| Auth & email notes | `AUTH-SETUP.md`, `SUPABASE-NO-EMAIL.md` |

---

## Notes

- Migrations **001–124** — run any new files in `supabase/migrations/` in order on production.
- **June/July money + data gates** are done — focus is Connect proof test, SEO domain, beta email, business ops.
- Organiser **groups are in Supabase** — July/August focus is **claims, republishing events**, and email waves.
- After editing FAQs run `npm run build-seo` before deploy.
- Add new items here so launch tasks stay in one place.
