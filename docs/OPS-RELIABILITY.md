# Ops reliability — backups, restore, monitoring

**Owner:** Catherine Hancher  
**Last updated:** 13 August 2026  

*Operational checklist for SurgoTech / launch readiness. Not a full DR policy yet.*

---

## 1. Health probe (done in code)

| Check | URL |
|-------|-----|
| App up | `https://www.thenetworkerhub.com/api/health` |

Expect JSON `{ "ok": true, "supabaseConfigured": true, ... }`.  
Works while the site gate is on (bypassed in middleware).

### Turn on monitoring (do this week)

1. Create a free [UptimeRobot](https://uptimerobot.com) (or Better Stack) monitor.
2. Type: **HTTP(s)** → URL above → every **5 minutes**.
3. Alert to **hello@thenetworkerhub.com** (and a phone SMS if available).
4. Optional second monitor: `https://www.thenetworkerhub.com/` (may 302/403 while gate is on — prefer `/api/health`).

Also in Vercel: **Project → Settings → Notifications** — enable deployment failure emails for the team.

---

## 2. Backups (Supabase) — confirm before Wednesday

| Step | Action | Status |
|------|--------|--------|
| 1 | Supabase project → **Settings → Billing** → ensure **Pro** (or plan with daily backups) | ☐ |
| 2 | **Settings → Database → Backups** — note retention (e.g. 7 days) and last backup time | ☐ |
| 3 | Confirm project is **not** on Free auto-pause | ☐ |
| 4 | Store project ref + dashboard URL in company password manager | ☐ |

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
  "https://www.thenetworkerhub.com/api/cron/booking-reminders"
```

---

## 6. Incident contacts

See `docs/DATA-BREACH-RESPONSE.md` and `docs/SUPPORT-INBOX-RUNBOOK.md`.  
Infra outage (site down, payments failing): treat as P0 — check Vercel / Supabase / Stripe status pages, then hello@.

---

## Change log

| Date | Note |
|------|------|
| 2026-08-13 | Created; health endpoint added; SurgoTech prep |
