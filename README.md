# The Networker UK

Member and organiser platform for UK networking events, exhibitions, and business opportunities.

**Production:** https://www.thenetworkeruk.com · **Preview:** https://the-networker-hub.vercel.app/

## Start here

| Doc | Use when |
|-----|----------|
| [`LOCAL-DEV.md`](LOCAL-DEV.md) | Day-to-day local work (`npm start`, smoke tests, gate unlock) |
| [`SUPABASE-SETUP.md`](SUPABASE-SETUP.md) | Database / Auth project setup |
| [`CHECKOUT-SETUP.md`](CHECKOUT-SETUP.md) | Stripe Connect + ticket checkout |
| [`PIPS-TODO.md`](PIPS-TODO.md) | Launch checklist and ops backlog |
| [`docs/OPS-RELIABILITY.md`](docs/OPS-RELIABILITY.md) | Health checks, backups, cron |

Copy [`.env.example`](.env.example) → `local.env`, fill secrets, then `npm run sync-env && npm start`.

## Stack

- **Frontend:** static HTML/CSS/JS on Vercel
- **API:** Vercel serverless functions under `api/`
- **Data:** Supabase (Postgres) — browse, accounts, organiser workspace, bookings
- **Payments:** Stripe (Connect destination charges)
- **Email:** Resend (when `AUTH_SEND_EMAILS` / transactional mail is enabled)

Airtable is legacy only. Do not use it for new work; see archived notes in `VERCEL-AIRTABLE.md` if you need history.

## What’s in this folder

| Path | Purpose |
|------|---------|
| `index.html` | Hub home |
| `events/` · `opportunities/` | Public directories |
| `organiser/` | Organiser workspace |
| `admin/` | Command Centre |
| `api/` | Serverless routes (`auth`, `organiser`, `admin`, `cron`, listings) |
| `js/` · `css/` | Shared front-end |
| `supabase/migrations/` | Schema migrations |
| `middleware.js` | Soft-launch gate, host canonicalisation, SEO HTML injection |

## Deploy on Vercel

1. Import the GitHub repo  
2. Framework: **Other** (static site + `/api` functions)  
3. Set env vars from `.env.example` (required: Supabase, `SESSION_SECRET`, `SITE_URL`, Stripe, Resend, `CRON_SECRET`)  
4. Redeploy after each push  

Local: `npm start` (wraps Vercel CLI). See `LOCAL-DEV.md`.
