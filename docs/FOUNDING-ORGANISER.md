# Founding Organiser cohort

**Soft launch cutoff:** claim before **1 September 2026** (Europe/London midnight).

| Perk | Who gets it | Where it shows |
|------|-------------|----------------|
| **Founding Organiser · 2026 badge** | Everyone who claims before 1 Sept | Public organiser profile |
| **Homepage showcase** | **First 50** claims only | Home strip through **30 Nov 2026** — Hub page + website link |
| **Group social post** | Founding cohort (homepage 50 featured first) | One (or a few) LinkedIn / social posts: “these groups have listed and are now part of the organiser leaderboard” — **not** individual personal shout-outs |
| **Preview gateway strip** | All founding claimants | `/site-access` — “Organisers who have agreed to list” (loads without preview password) |

Do **not** limit the badge to 50 — that creates #51 disappointment. Cap only the homepage slots.

### Technical
- Migration: `supabase/migrations/241_founding_organiser.sql`
- Award on claim: `api/_lib/founding-organiser.js` via `claimGroupForSession`
- API: `GET /api/founding-organisers`
- Email 2 + `/for-organisers` claim invite copy mention both perks + group social

### Command Centre
**Email & social → Founding organisers** (`#social/founding`)

- See who has the badge / homepage slot
- Add or remove homepage showcase (max 50)
- Revoke badge
- Manually award by organiser UUID
- **Copy group LinkedIn caption** (Founding organisers on the leaderboard)

**Email & social → Social posts** (`#social`) is the general listing caption composer (events / opportunities / organisers) — separate from the founding group announcement.

### Ops (social)
After a batch of claims lands (or weekly), open Command Centre → Founding organisers → **Copy caption** → paste on LinkedIn. Prefer logos from the homepage 50 in any graphic you make. No promise of a personal post per group.
