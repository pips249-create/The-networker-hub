# Pip's to-do list

**Launch target: 1 September 2026** (soft launch late August if checkout is done by end of June)

**Find this file:** search the repo for `PIPS-TODO` or open [`PIPS-TODO.md`](./PIPS-TODO.md) at the project root.

*Last updated: 6 August 2026 (SEO canonical rebuild; gate robots/llms; launch segments; support drafts; Resend/Supabase Pro deferred ~1 week)*

---

## Tomorrow — 30 July 2026

Ship/verify membership work, then scale readiness before loading more of the alphabet.

### Morning — membership ship & verify
1. Push `5d685ca` (+ scale unbounded-path commit) and deploy
2. Apply migrations `216` (round-up email pref) + `217` (membership lifecycle emails / `pay_invite`)
3. Enable **Stripe Customer Portal** (update card + cancel) in Dashboard
4. Smoke-test: join → portal manage → failed payment emails → renewal receipt (watch for double Stripe receipts)

### Midday — organiser checks
5. Past-due / invite-to-pay tools on Memberships
6. Round-up email preference independent of Hub marketing
7. LinkedIn post builder: one upcoming + one past event

### Afternoon — launch E2E (pick at least one)
8. **Guest visit programme E2E** (priority before beta email)
9. Category exclusivity (seat approval) E2E — if time
10. ~~Connect destination-charge spot-check~~ — done Jul 2026

### Scale readiness (catalogue already ~900 events from A–C alone)
11. Confirm **Supabase Pro** plan / RAM headroom before loading D–Z (nano already noted ~48% with ~1k groups)
12. Spot-check `/api/organisers` and events browse + map pins under current catalogue (unbounded paths fixed 29 Jul — verify latency/payload)
13. Note Resend free-tier ceiling before July beta send; upgrade if daily sends approach 80–90
14. Optional: load-test browse + organiser pages (was week-8 item) once D–F groups are in

### Park (not tomorrow)
- Proration / mid-cycle plan switches · monthly-update extra credits · chapter industry exclusivity · SEO/GSC/redirect · beta email send itself

---

## Project status (snapshot)

**Overall launch readiness: ~80%** — money path, claim onboarding, and conference type done; SEO domain setup, comms send, and business ops remain.

| Area | Progress | Status |
|------|----------|--------|
| Core platform (browse, auth, accounts) | ~90% | Live on preview |
| Organiser groups & dashboard | ~90% | **~1,000+ groups in Supabase**; profiles tidied; auto-approve; Supabase-only |
| Checkout & payments | ~95% | Prod checkout + Connect destination charges verified in live Stripe (Jul 2026); refund spot-check optional |
| Email system | ~85% | Resend on prod; confirmation sends — **SPF/DKIM, cron reminders, allowlist off at launch** remain |
| SEO | ~70% | Foundations built — **domain, GSC, sitemap verify, redirect** remain |
| AEO (AI / answer engines) | ~70% | `llms.txt`, FAQs, JSON-LD — **gate-off discovery + canonical alignment** remain |
| Business ops | ~85% | ICO ZB694959 + solicitor + DPAs done; Finance VAT treatment sign-off + insurance optional |
| Redirect & launch comms | ~35% | Redirect map + banner snippet + Hub list segments; Email 1 sent; Email 2 / hard 301s remain |

### Critical path (do these next)

1. ~~**Guest visit programme end-to-end test**~~ ✅ 4 Aug (`scripts/guest-visit-e2e-test.js`)
2. ~~**Category Exclusivity (seat approval) end-to-end test**~~ ✅ 5 Aug (`npm run test-category-exclusivity-e2e`)
3. ~~**Connect destination charge test**~~ — done Jul 2026 (live PIs with `hub_checkout=connect_destination`; fee = booking fee only)
4. **100% gates** — finish remaining items in Tabs 4–6, 9–10 below
5. **Email 2 claim wave** — Soft path A + Founding Organiser perks (`docs/SEGMENT-A-EMAIL2.md`, `docs/FOUNDING-ORGANISER.md`); **run migration 241 → deploy → Brevo**
6. **SEO pre-launch** — `SITE_URL` + GSC domain property done; GBP verification in progress; **submit sitemap + request indexing at gate-off** (`docs/SEO-AEO-LAUNCH-PLAN.md`)
7. **August redirect** — banner install now; hard 301s deferred ~3 months for SEO (~Nov 2026)
8. **Resend Pro + Supabase Pro** — deferred ~1 week (before wider Resend sends / gate-off)

*Note: events are listed fresh on the hub — we are not migrating or copying events from the old WordPress site.*

### Recently completed (early August 2026)

- Guest visit + Category Exclusivity E2E
- Email 1 organiser soft-trust send (Brevo Segment A ~1,100)
- SEO rebuild: FAQ/guides/help canonicals → `www.thenetworkeruk.com` (were localhost)
- Middleware: gated `robots.txt` Disallow + block `llms.txt` / `agents.txt` until public launch (matcher bug fixed)
- Launch list Hub segments: **1,103 organisers · 207 accounts · 158 both · 46 attendees-only** (`npm run build:launch-segments`)
- Support inbox pre-draft replies (`docs/SUPPORT-INBOX-RUNBOOK.md`)
- co.uk upgrade banner ready; dual-site SEO hold ~3 months (`marketing/CO-UK-UPGRADE-BANNER.md`)
- `CRON_SECRET` confirmed present in Vercel Production
- Refund-policy + Connect math + business-ops + DPA checks green

### Recently completed (July 2026)

- **Member list (pre-launch)** — per organiser page member list, `members_only` tickets, five reports, printable name badges for confirmed bookings only (`docs/MEMBER-ROSTER.md`, migration `159_organiser_member_roster.sql`)
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

Training and workshops, organiser messaging, review replies, PDF tickets, calendar export polish.

**Pre-September (moved up):** seat-approval / Category Exclusivity workflows must work for launch. Guest visit programme E2E passed 4 Aug 2026 — beta email unblocked on that gate.

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
| [x] | 6–7 | Deploy SEO assets; confirm sitemap indexes all groups + published events — code + canonical rebuild 6 Aug; live sitemap still 403 while gated (expected) |
| [~] | 7 | **Organiser Email 1** sent (Brevo Segment A ~1,100) — Email 2 Hub-ready; Brevo send Fri 7 Aug |
| [ ] | 7–8 | Fix beta feedback; target **20 groups** with at least 1 published event |
| [x] | 8 | Bound organiser directory + geo/pins paths (paginated slim queries; `?all=1` removed) — 29 Jul |
| [ ] | 8 | Load test: browse + organiser pages with 1,000+ group profiles (+ ~9k-event catalogue projection) |
| [ ] | 8 | Optional: city landing pages or server-side meta for top SEO win |

### August — Scale, redirect, comms

**Infrastructure upgrades (budget before wider emails / public launch):**

| Service | When | Cost | Why |
|---------|------|------|-----|
| **Resend Pro** | **Before week 10 wider email** (mandatory before 3,500 launch send) — *deferred ~1 week from 6 Aug* | ~$20/mo | Free tier = **100 emails/day** + 3,000/mo — campaigns + crons + bookings exceed that in August/September |
| **Supabase Pro** | **Before soft launch** (remove site gate) — *deferred ~1 week from 6 Aug* | ~$25/mo | No 7-day pause, daily backups, headroom (~1,000 groups already in DB; RAM ~48% on nano) |
| **Vercel Pro** | **Only if needed** (Q4 or after launch) | ~$20/mo | Daily crons are OK on Hobby; upgrade if cron timeouts, need Firewall, or more-than-daily jobs |

Monitor Resend dashboard during July beta — if daily sends approach **80–90**, upgrade early.

| Done | Week | Task |
|:----:|------|------|
| [ ] | 9 | **Resend Pro** + **Supabase Pro** upgraded (see table above) — deferred ~1 week |
| [x] | 9 | Redirect plan: the-networker.co.uk → hub (home, browse, organiser slugs, event URLs) — `docs/LEGACY-REDIRECT-MAP.md` |
| [~] | 9 | Soft Hub banner on co.uk during ~3-month SEO hold — snippet + dev brief ready (`marketing/CO-UK-BANNER-INSTALL-FOR-DEVS.md`); **paste onto co.uk** |
| [~] | 9 | Hub-side list segments built (`docs/LAUNCH-LIST-SEGMENTS.md`) — merge Brevo 3,500 export when available |
| [ ] | 10 | **Wider email** (500–1,000) — claim profile + help link; track claim rate (**requires Resend Pro** if via Resend) |
| [x] | 10–11 | FAQ / support inbox ready (login, publish event, bookings, payouts) — pre-drafts in `docs/SUPPORT-INBOX-RUNBOOK.md` |
| [ ] | 11 | Performance pass — pagination, images, API caching under load |
| [ ] | 11 | **Soft launch** — public browsing 25 August (tickets still closed) |
| [ ] | 12 | **Full launch email** to remainder of 3,500 list (**requires Resend Pro**) |

### 25 August — Browse open · 1 September — Tickets & enquiries

| Done | Task |
|:----:|------|
| [ ] | the-networker.co.uk redirect live |
| [x] | thenetworkerhub.co.uk (+ www) → www.thenetworkeruk.com (Vercel domain + DNS) — domains attached 6 Aug; middleware 308 canonical (apex was skipping vercel.json) |
| [x] | Checkout + confirmation email verified on prod |
| [x] | Stripe Connect destination charge test passed (Tab 9) — live proof Jul 2026 |
| [x] | 1,000+ organiser group profiles browsable |
| [ ] | 200+ claimed groups (stretch goal) |
| [ ] | Support email monitored (hello@thenetworkeruk.com) |
| [x] | Command Centre admin login tested |
| [ ] | **Business ops** — Tab 10 gates complete (or consciously deferred with owner) |
| [ ] | SEO/AEO — Tab 6 + `docs/SEO-AEO-LAUNCH-PLAN.md` launch-week steps |
| [ ] | `EMAIL_ALLOWLIST_DISABLED=true` on launch (if allowlist was on) |
| [ ] | `SITE_ACCESS_PASSWORD` removed — public gate off (25 August browse) |
| [ ] | **Supabase Pro** active before gate-off (backups + no auto-pause on live ticketing) |

---

## Tab 1 — Supabase migrations

**Status: migrations 001–146 on disk** — run any new files in `supabase/migrations/` in order on production (confirm 125–146 applied).

| Migration | Status | Notes |
|-----------|--------|-------|
| 001–124 | Run through prod | Full schema through opportunity moderation, platform admin emails |
| 125–146 | Confirm on prod | Guest visits, alumni pass, opportunity favourites / saved searches, complaints register |
| 071–072 | Historical | Admin MFA was added then dropped — **do not re-run**; 159 restore was never applied |

**Verify reviews setup:** `npm run test-review-e2e`

---

## Tab 2 — Email (Resend — required before September launch)

The **Email Template Manager** works without Resend (edit & save in Command Centre). Resend is live on prod.

**Plan tiers:** July beta (50–100 organisers) is fine on **Resend Free**. Upgrade to **Resend Pro ($20/mo)** before August wider campaigns — free tier caps at **100 emails/day** and **3,000/month**; the September launch list alone is ~3,500. Watch daily usage in the Resend dashboard during beta.

### 100% email system gate

| Done | Step |
|:----:|------|
| [x] | Sign up at [resend.com](https://resend.com) |
| [x] | Create an API key |
| [x] | Add **`RESEND_API_KEY`** in Vercel → Project → Settings → Environment Variables |
| [x] | Verify sending domain (the-networker.co.uk or hub domain) |
| [x] | Add **`RESEND_FROM`**, e.g. `The Networker <hello@thenetworkeruk.com>` |
| [x] | Redeploy so env vars apply |
| [x] | Command Centre → **Email templates** → Send test to yourself |
| [x] | **Test checkout:** buy a ticket → confirmation email received |
| [x] | **SPF + DKIM + DMARC** on sending domain (not `onboarding@resend.dev`) — public dig 6 Aug: DKIM + send.mail SPF/MX + apex DMARC `p=none`; Resend From `hello@mail.thenetworkeruk.com` |
| [x] | **`CRON_SECRET`** set in Vercel Production — booking reminders + saved-event nudges |
| [x] | Spot-check: `booking_cancelled`, `event_cancelled`, `refund_processed`, welcome email — templates present in DB (`account_welcome` + cancel/refund slugs); optional visual review in `/admin/emails` |
| [ ] | Review/edit templates at [`/admin/emails`](https://the-networker-hub.vercel.app/admin/emails) |
| [x] | Launch invite template (organiser “claim your profile”) — `organiser_launch_invite` + `organiser_claim_invite` in DB; Email 2 uses launch invite via Brevo |
| [ ] | At launch: **`EMAIL_ALLOWLIST_DISABLED=true`** if pre-launch allowlist was on |
| [ ] | **Resend Pro** — before August wider email / September 3,500 send (see Tab 0 August infrastructure table) |
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
| [x] | Launch invite template (organiser “claim your profile”) — `organiser_launch_invite` + `organiser_claim_invite` in DB |

---

## Tab 4 — Checkout & payments (100% gate)

| Done | Step |
|:----:|------|
| [x] | `STRIPE_SECRET_KEY` in Vercel (test or live — decide before public launch) |
| [x] | `STRIPE_WEBHOOK_SECRET` + webhook endpoint `checkout.session.completed` |
| [x] | `STRIPE_CONNECT_ENABLED=true` |
| [x] | Paid checkout → `registrations` row in Supabase |
| [x] | Ticket appears on `/account/` |
| [x] | `booking_confirmation` + `organiser_new_registration` emails |
| [x] | **Connect destination charge test** (Tab 9) — verify money split in Stripe — live proof Jul 2026 (`hub_checkout=connect_destination`) |
| [x] | Free ticket path: `POST /api/auth/complete-booking` without Stripe — `npm run check:free-ticket` passed 6 Aug (optional UI: Get free ticket on a £0 event) |
| [~] | `charge.refunded` webhook → `refund_processed` email — code wired (`api/_lib/stripe-refund-webhook.js`); optional Dashboard refund spot-check |
| [ ] | `GET /api/auth/config-check` → `checkoutReady: true`, `stripeConnectEnabled: true` — open as admin in Command Centre (or set `CONFIG_CHECK_SECRET`) |
| [x] | Switch to **`sk_live_…`** before taking real public money — live key in use |
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
| [x] | **Connect destination charge test** (Tab 9) — live proof Jul 2026 |
| [x] | **Guest visit programme — end-to-end test** (complimentary visits → guest pass booking → exhausted → paid member ticket) — `node scripts/guest-visit-e2e-test.js` (4 Aug 2026) |
| [x] | **Category Exclusivity (seat approval) — end-to-end test** (apply → organiser approve/deny → payment link → booking) — server apply-before-pay + `npm run test-category-exclusivity-e2e` passed 5 Aug 2026 |
| [ ] | July beta: **200+ groups claimed** and **20+ with a published event** |
| [ ] | Load test: browse + organiser pages with 1,000+ profiles + multi-k events (week 8) |

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
| [x] | **`SITE_URL`** in Vercel Production = `https://www.thenetworkeruk.com` (exact canonical) — confirmed 6 Aug |
| [ ] | Verify `/sitemap.xml` after deploy — counts match published events + organisers |
| [x] | Align hard-coded `the-networker.co.uk` canonical leftovers; run `npm run build-seo` |
| [x] | Rebuild FAQ/guides/help canonicals to `https://www.thenetworkeruk.com` (6 Aug — were `localhost:3000`) |
| [x] | **Google Search Console** — domain property `thenetworkeruk.com` verified (6 Aug); **submit sitemap at gate-off** when `/sitemap.xml` is public |
| [~] | **Google Business Profile** — Software company, UK service area, hub URL; verification processing (submitted 6 Aug; may take up to 5 days). No Magpas pin. |
| [ ] | Launch week: remove `SITE_ACCESS_PASSWORD` → confirm `/robots.txt` Allow, `/llms.txt` 200 |
| [x] | `the-networker.co.uk` 301 redirect map ready (Tab 7) — draft `docs/LEGACY-REDIRECT-MAP.md` |
| [ ] | City/region landing pages (post-launch — not a 100% blocker) |

**Full plan:** `docs/SEO-AEO-LAUNCH-PLAN.md`

**Rebuild after FAQ edits:** `npm run build-seo`

---

## Tab 7 — Redirect & launch comms

| Done | Step |
|:----:|------|
| [x] | Map old the-networker.co.uk URLs → new hub URLs (`docs/LEGACY-REDIRECT-MAP.md`) |
| [ ] | DNS / hosting redirect for apex + www |
| [~] | Segment 3,500 list: organisers vs attendees vs both — Hub segments built (`docs/LAUNCH-LIST-SEGMENTS.md`); merge Brevo export when ready |
| [~] | July/August organiser Email 1 sent (Brevo); Email 2 claim wave **Fri 7 Aug** (Hub gates green — send in Brevo) |
| [ ] | August wave email (500–1,000) |
| [ ] | 1 September full list + redirect live |
| [~] | co.uk upgrade banner — snippet + install brief ready; old developers paste on WordPress (`marketing/CO-UK-BANNER-INSTALL-FOR-DEVS.md`) |

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

- [x] **Code math** — `npm run check:connect-checkout` (booking fee = Hub `application_fee` only; organiser gets full ticket) — verified 5 Aug 2026
- [x] Payment appears on the **organiser’s** connected account (not only on platform) — live e.g. `pi_3TrHK3PTjjdhziif0PdboqOu` (9 Jul 2026) → `acct_1Tqxf2ASplrvHrVi`
- [x] Platform balance increased by **booking fee only** — application fee £0.25 on £1.25 checkout (ticket £1 + fee £0.25)
- [x] `registrations` row has correct `amount_paid` / payment status — covered by earlier prod checkout gates
- [x] `hub_checkout` metadata = `connect_destination` on the PaymentIntent — confirmed on Jul 8–9 live PIs (also 29 Jul charge with destination + app fee)

**Guide:** `docs/STRIPE-CONNECT-ORGANISER-GUIDE.md` · **Refunds:** `docs/REFUNDS-AND-STRIPE-CONNECT.md`  
**Automated check:** `npm run check:connect-checkout`  
**Note:** Checklist was stale — destination-charge proof already existed in live Stripe from July testing; no need to re-run unless refunds still need a spot-check.

---

## Tab 10 — Business ops (September launch)

Non-code gates from `docs/COMPLIANCE-RUNBOOK.md`. Product compliance is largely built in; these are **your** actions.

### Must-have before public launch

| Done | Item | Owner |
|:----:|------|-------|
| [x] | **Support inbox** runbook — `docs/SUPPORT-INBOX-RUNBOOK.md` | Catherine |
| [x] | **SPF + DKIM + DMARC** — follow `docs/EMAIL-DNS-SETUP.md` — verified dig 6 Aug | Tech |
| [x] | **ICO registration** — **ZB694959** · Tier 1 · registered 30 May 2024 · expires **29 May 2027** · Magpas HQ address match (`docs/ICO-REGISTRATION.md`) | Catherine |
| [x] | Command Centre admin login tested on prod | Ops |
| [x] | Refund policy enforcement — server guards + `npm run test:refund-policy` | Product |
| [x] | Opportunity moderation owner assigned (`docs/OPPORTUNITY-MODERATION.md`) | Catherine |

### Should-have before scaling paid ticketing

| Done | Item | Owner |
|:----:|------|-------|
| [x] | **DPAs filed** — `docs/DPA-SUBPROCESSORS.md` + `docs/DPA-REGISTER.md` + `npm run check:dpas` | Catherine |
| [x] | Solicitor review of `legal-policies.html` — done (Catherine confirmed 6 Aug 2026) | Catherine |
| [x] | GDPR SAR owner named (`docs/GDPR-SAR-PROCEDURE.md`) | Catherine |
| [x] | Data breach incident lead named (`docs/DATA-BREACH-RESPONSE.md`) | Catherine |
| [x] | **Company VAT registered** — The Networker Group Ltd VAT No. **454 4092 94** (on legal + guides) | Finance |
| [ ] | Organiser VAT *treatment* sign-off — booking-fee VAT / ticket VAT options with accountant (`docs/VAT-ORGANISER-GUIDANCE.md` §4) — ask existing accountant; not a new registration | Finance / accountant |
| [ ] | HMRC platform reporting mapped with accountant (`docs/HMRC-PLATFORM-OPERATORS.md`) — same accountant | Finance / accountant |
| [ ] | **Optional:** platform liability + cyber insurance quotes — commercial cover for claims / data breach (not a software setting; broker/insurer). Park if consciously deferred. | Catherine |
| [ ] | Legacy marketing opt-in re-permission — run `scripts/audit-legacy-marketing-opt-in.js` | Marketing |

### Already in the product

Legal policies, cookie consent, terms at registration, pre-checkout acknowledgement, organiser terms, opportunity disclaimers, earnings attestation, paid-checkout refund guard, review reporting, RoPA, SAR procedure, breach runbook, OSA risk doc, compliance readiness script (`npm run check:business-ops`).

---

## Tab 8 — Quick links

| What | Where |
|------|--------|
| Command Centre | `/admin/` |
| Email templates | `/admin/emails` |
| Attendee dashboard | `/account/` |
| Review E2E test | `npm run test-review-e2e` |
| Env var reference | `.env.example` |
| Config check | `GET /api/auth/config-check` |
| Supabase setup | `SUPABASE-SETUP.md` |
| Checkout + email | `CHECKOUT-SETUP.md` |
| SEO / AEO | `robots.txt`, `agents.txt`, `llms.txt`, `/sitemap.xml`, `/api/seo-meta` |
| Legacy redirects | `docs/LEGACY-REDIRECT-MAP.md` |
| Rebuild FAQ + schema | `SITE_URL=https://www.thenetworkeruk.com npm run build-seo` |
| Stripe Connect test | `PIPS-TODO.md` Tab 9 |
| Business ops / compliance | `docs/COMPLIANCE-RUNBOOK.md` · Tab 10 |
| Subprocessor DPAs | `docs/DPA-SUBPROCESSORS.md` · `npm run check:dpas` |
| SEO launch week | `docs/SEO-AEO-LAUNCH-PLAN.md` |
| Stripe Connect + refunds | `docs/REFUNDS-AND-STRIPE-CONNECT.md` |
| Auth & email notes | `AUTH-SETUP.md`, `SUPABASE-NO-EMAIL.md` |

---

## Notes

- Migrations **001–146** on disk — run any new files in `supabase/migrations/` in order on production.
- **June/July money + data gates** are done — focus is Connect proof test, SEO domain, beta email, business ops.
- Organiser **groups are in Supabase** — July/August focus is **claims, republishing events**, and email waves.
- After editing FAQs run `SITE_URL=https://www.thenetworkeruk.com npm run build-seo` before deploy.
- Add new items here so launch tasks stay in one place.
