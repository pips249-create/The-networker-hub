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

## Admin — Backend: Sponsorship & Advertisement Management

**Admin page:** `/admin/index.html#sponsorship` (shell in `js/admin-app.js`; save API not wired yet).

**Goal:** swap **Sponsor Hub** image, copy, and tracking link monthly — **no new code or deploy**.

| Layer | Deliverable |
|-------|-------------|
| **Airtable** | `Site Promotions` / `Sponsor Slots` — `slot_key` = `events-sponsor-hub`, `active_from` / `active_to`, image attachment, headline, body lines, `cta_label`, `cta_url`, `is_published` |
| **Public API** | `GET /api/sponsor?slot=events-sponsor-hub` — active creative for today |
| **Admin API** | `GET/POST /api/admin/sponsor` — admin-only upsert + publish |
| **Events browse** | Load sponsor block from API; remove hard-coded block in `events/index.html` when live |
| **Admin UI** | Image, headline, bullets, CTA label, tracking URL, preview, publish |

Extend later: Premium Spotlight promos, city sponsorship blocks, email banners (one `slot_key` per placement).

Full spec: `Redesign 2/NETWORKER-HUB-ROADMAP.md` → Phase 5 → Backend — Sponsorship & Advertisement Management.

## Phase 1+ (brief)

Events, Academy, dashboards, Stripe, full admin — see `Redesign 2/NETWORKER-HUB-ROADMAP.md` for full page map and schema.
