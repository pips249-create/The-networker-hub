# Founding Organiser cohort

**Soft launch cutoff:** claim before **1 September 2026** (Europe/London midnight). Badge unlocks **on claim** (no need to publish an event first).

| Perk | Who gets it | Where it shows |
|------|-------------|----------------|
| **Founding Organiser · 2026 badge** | Claimed before 1 Sept | Public organiser profile |
| **Homepage showcase** | **First 50** founding awards only | Logo marquee under the hero through **30 Nov 2026** — each tile links to the platform organiser page |
| **Group social post** | Founding cohort (homepage 50 featured first) | One (or a few) LinkedIn / social posts: “these groups have listed and are now part of the organiser leaderboard” — **not** individual personal shout-outs |
| **Preview gateway strip** | All founding claimants | `/site-access` — “Organisers who have agreed to list” (loads without preview password) |
| **Claim confirmed email** | Everyone who claims via the invite modal | Resend template `organiser_claim_confirmed` — badge notice + CTA to add logo/website on `/organiser/group-edit` (reply-to Catherine). Generic account welcome is skipped for claim signups. |

Do **not** limit the badge to 50 — that creates #51 disappointment. Cap only the homepage slots.

### After the first 50 homepage slots fill
Everyone who claims before 1 Sept still gets the **Founding Organiser · 2026 badge** on their profile (and the claim email / PNG). What stops at 50 is only the **homepage logo strip**.

| Still get after #50 | Do not get after #50 |
|---------------------|----------------------|
| Founding badge on public organiser page | Homepage marquee slot |
| Named in group social / leaderboard shoutouts (cohort) | Soft-launch “first 50 on homepage” framing |
| Preview gateway / About founding strips (where those load all founding claimants with logos) | — |

Ops can still manually add/remove a homepage slot in Command Centre if needed (e.g. swap a logo-less early claim for a later one with assets). The homepage UI uses **two scrolling rows** once there are enough logos, so a full first-50 strip does not crawl as one endless line.

### Technical
- Migration: `supabase/migrations/241_founding_organiser.sql` (+ `254_founding_award_on_claim.sql` backfill)
- Award on claim (before 1 Sept): `api/_lib/founding-organiser.js` → `foundingFieldsForClaim` via `claimGroupForSession` only (personalised claim URL). **Not** on admin provision / `ensureOrganiserClaimedForAdminEvent`.
- Staff/test workspaces never get founding: `rosie@the-networker.co.uk`, `rosie@thenetworkeruk.com`, `jamie@thenetworkeruk.com`, `catherine@thenetworkeruk.com`, `pips249@gmail.com` — groups they create or claim are marked `is_internal` and excluded from public founding strips (migration `258_staff_founding_excluded.sql`).
- **Backfill:** migration 254 awards the badge to every page already claimed before 1 Sept (dated to `ownership_claimed_at`), and backdates anyone who got the badge later via the old publish rule. First 50 by claim time get homepage slots.
- Publish path keeps `maybeAwardFoundingAfterEventPublish` as a safety net for older claims that missed the badge
- Claim confirmation email: `api/_lib/organiser-claim-confirmed-emails.js` + `email-templates/organiser-claim-confirmed.html` (migration `242_organiser_claim_confirmed_email.sql`) — founding perk row + badge PNG when the claim was in-window. Badge PNG is embedded in the body and attached as `Founding-Organiser-2026-badge.png` (`assets/founding-organiser-badge-2026.png`).
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

**Email & social → Social posts** (`#social`) — listing captions plus post type **Founding organisers** (caption styles + downloadable logo graphic).

### Ops (social)
After a batch of claims lands (or weekly), open Command Centre → **Social posts** → post type **Founding organisers** → copy caption / download graphic → paste on LinkedIn. Prefer logos from the homepage 50 in any graphic (the composer does this automatically). The Founding organisers tab still has a one-click **Copy caption** shortcut. No promise of a personal post per group.
