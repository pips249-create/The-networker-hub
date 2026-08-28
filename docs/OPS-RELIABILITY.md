# Ops reliability — backups, restore, monitoring

**Owner:** Catherine Hancher  
**Last updated:** 28 August 2026  

*Operational checklist for SurgoTech / launch readiness. Not a full DR policy yet.*

---

## Quick check

```bash
npm run check:ops
npm run check:ops -- https://www.thenetworkeruk.com
```

Verifies `/api/health` returns `{ ok: true, supabaseConfigured: true }` and prints manual dashboard gates.

## 1. Health probe (done in code)

| Check | URL |
|-------|-----|
| App up | `https://www.thenetworkeruk.com/api/health` |

Expect JSON `{ "ok": true, "supabaseConfigured": true, ... }`.  
Works while the site gate is on (bypassed in middleware).

**Verified 28 Aug 2026:** production `/api/health` returns 200 + `supabaseConfigured: true`.

### Turn on monitoring (~5 minutes)

1. Sign in at [UptimeRobot](https://uptimerobot.com) (free tier is fine).
2. **Add New Monitor** → type **HTTP(s)**.
3. **URL:** `https://www.thenetworkeruk.com/api/health`
4. **Monitoring interval:** 5 minutes.
5. **Monitor timeout:** 30 seconds.
6. **Alert contacts:** add **hi@thenetworkeruk.com** (and SMS to Catherine’s mobile if available).
7. Save — note the monitor name/ID below in the change log.

**What “up” looks like:** HTTP 200 and JSON containing `"ok": true` and `"supabaseConfigured": true`.

**What to do when down:** check [Vercel status](https://www.vercel-status.com/), [Supabase status](https://status.supabase.com/), then Stripe if checkout fails. See `docs/DATA-BREACH-RESPONSE.md` if personal data may be involved.

Also in Vercel: **Project → Settings → Notifications** — enable deployment failure emails for the team.

---

## 2. Backups (Supabase) — confirm before Wednesday

| Step | Action | Status |
|------|--------|--------|
| 1 | Supabase project → **Settings → Billing** → ensure **Pro** (or plan with daily backups) | ☐ Confirm in dashboard |
| 2 | **Settings → Database → Backups** — note retention (e.g. 7 days) and last backup time | ☐ |
| 3 | Confirm project is **not** on Free auto-pause | ☐ |
| 4 | Store project ref + dashboard URL in company password manager | ☐ |
| 5 | Run `npm run check:ops` after UptimeRobot monitor is live | ☑ Script added 28 Aug 2026 |

**RPO (current target):** up to ~24 hours (daily backups).  
**RTO (current target):** same day, manual restore via Supabase support/dashboard.

---

## 3. Restore drill (quarterly)

When you have Pro backups:

1. Pick a non-destructive test: restore to a **new** temporary project / branch (prefer this over overwriting prod).
2. Or document: open Supabase support → “restore backup from DATE to new project”.
3. Verify: can log in to admin on restored DB; one event + one registration row visible.
4. Tick the box in `docs/DATA-BREACH-RESPONSE.md` quarterly checklist.
5. Record date + who ran it in this file’s change log below.

**Do not** run experimental SQL against production without a backup timestamp noted first.

---

## 4. Migrations (prod safety)

- Apply via Supabase **SQL Editor** from `supabase/migrations/` in order (see `supabase/migrations/README.md`).
- Before capacity / money migrations: confirm backup exists that day.
- Migration **255** (`255_event_capacity_enforce_trigger.sql`) — run before busy ticket weekends.
- Migration **256** (`256_api_rate_limit_buckets.sql`) — shared auth rate limits.

---

## 5. Secrets & cron

| Secret | Where | Notes |
|--------|-------|-------|
| `CRON_SECRET` | Vercel Production **and** Preview | Required on all hosted deploys; Vercel Cron sends `Authorization: Bearer …` |
| `SESSION_SECRET` | Vercel | Rotate if leaked (logs everyone out) |
| Supabase service role | Vercel only | Never in git / client |

Manual cron test:

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://www.thenetworkeruk.com/api/cron/booking-reminders"
```

---

## 6. Incident contacts

See `docs/DATA-BREACH-RESPONSE.md` and `docs/SUPPORT-INBOX-RUNBOOK.md`.  
Infra outage (site down, payments failing): treat as P0 — check Vercel / Supabase / Stripe status pages, then hello@.

---

## Change log

| Date | Note |
|------|------|
| 2026-08-28 | `npm run check:ops` added; production health probe verified |
| 2026-08-13 | Created; health endpoint added; SurgoTech prep |
