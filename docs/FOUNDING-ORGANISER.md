# Founding Organiser cohort

**Soft launch cutoff:** claim before **1 September 2026** (Europe/London midnight). Badge unlocks when they **publish their first event**.

| Perk | Who gets it | Where it shows |
|------|-------------|----------------|
| **Founding Organiser · 2026 badge** | Claimed before 1 Sept **and** published at least one event | Public organiser profile |
| **Homepage showcase** | **First 50** founding awards only | Logo marquee under the hero through **30 Nov 2026** — each tile links to the Hub organiser page |
| **Group social post** | Founding cohort (homepage 50 featured first) | One (or a few) LinkedIn / social posts: “these groups have listed and are now part of the organiser leaderboard” — **not** individual personal shout-outs |
| **Preview gateway strip** | All founding claimants | `/site-access` — “Organisers who have agreed to list” (loads without preview password) |
| **Claim confirmed email** | Everyone who claims via the invite modal | Resend template `organiser_claim_confirmed` — badge notice + CTA to add logo/website on `/organiser/group-edit` (reply-to Catherine). Generic account welcome is skipped for claim signups. |

Do **not** limit the badge to 50 — that creates #51 disappointment. Cap only the homepage slots.

### Technical
- Migration: `supabase/migrations/241_founding_organiser.sql`
- Award on first published event (eligible if claimed before 1 Sept): `api/_lib/founding-organiser.js` via `publishEventsWithRefund`
- Claim alone no longer awards the badge
- Claim confirmation email: `api/_lib/organiser-claim-confirmed-emails.js` + `email-templates/organiser-claim-confirmed.html` (migration `242_organiser_claim_confirmed_email.sql`) — founding perk row appears when the badge is unlocked (first publish). Badge PNG is embedded in the body and attached as `Founding-Organiser-2026-badge.png` (`assets/founding-organiser-badge-2026.png`).
- API: `GET /api/founding-organisers`
- Email 2 + `/for-organisers` claim invite copy mention both perks + group social

### Command Centre
**Email & social → Founding organisers** (`#social/founding`)

- See who has the badge / homepage slot
- Filter **Needs assets / Missing logo / Missing website** and use **Email chase**
- Add or remove homepage showcase (max 50)
- Revoke badge
- Manually award by organiser UUID
- **Copy group LinkedIn caption** (Founding organisers on the leaderboard)

**Email & social → Social posts** (`#social`) is the general listing caption composer (events / opportunities / organisers) — separate from the founding group announcement.

### Ops (social)
After a batch of claims lands (or weekly), open Command Centre → Founding organisers → **Copy caption** → paste on LinkedIn. Prefer logos from the homepage 50 in any graphic you make. No promise of a personal post per group.
