# The Networker Hub — build roadmap

Repo: [pips249-create/The-networker-hub](https://github.com/pips249-create/The-networker-hub)  
Live: `https://the-networker-hub.vercel.app/`

## Current (Phase 0)

Static preview: hub home, events browse (filters, Premium Spotlight, Sponsor Hub), auth, admin shell, Airtable-backed `/api/events`.

## Location filter — Postcode Outcode Match

**Do not** use radial distance / haversine for every listing (heavy, slow).

When the user enters a postcode or outcode (e.g. `M1`, `SW1A`):

1. Parse UK **outcode** from input and from each event’s Postcode / Location in Airtable.
2. Match events in the **same sector** and **adjacent outcodes** for that city region (e.g. Manchester M1–M90, London SW/SE/NW…).
3. “Near me” uses the same outcode rules (no live GPS radius required).

Implemented in `js/postcode-outcode.js` + `outcode` on API events.

## Backend — Sponsorship & Advertisement Management

Required for Admin Panel (Claude/Cursor): **monthly sponsor swaps without new code**.

| Item | Notes |
|------|--------|
| Airtable `Site Promotions` / `Sponsor Slots` | slot key (`events-sponsor-hub`), active dates, image, title, body, CTA text, URL |
| Admin form | Replace image, copy, tracking link; preview; publish |
| Public API | `GET /api/sponsor?slot=events-sponsor-hub` returns active creative |
| Events page | Renders API payload — remove hard-coded Sponsor Hub when live |

Extend later to spotlight promos, city pages, email banners.

## Phase 1+ (brief)

Events, Academy, dashboards, Stripe, full admin — see `Redesign 2/NETWORKER-HUB-ROADMAP.md` for full page map and schema.
