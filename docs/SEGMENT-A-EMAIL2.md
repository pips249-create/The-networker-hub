# Segment A — Email 2 (confirm organiser page)

**When:** **Tue 11 Aug 2026** (Email 1 sent 5 Aug; claim wave deferred from Fri 7 Aug)  
**Status:** **Path B** — CTA lands on their public organiser page first; Claim / Edit → free account → organiser claim flow  
**Template:** `organiser_launch_invite`  
**Subject (Brevo):** `Congratulations: {{ contact.ORGANISER_NAME }} is ready`  
**Send from:** Brevo (same co.uk / organiser list) · **Reply-to:** `catherine@thenetworkerhub.com`  
**Paste HTML:** `data/email2-brevo-ready.html`  
**Sponsor:** My Medical Cover (Barnsgate declined)

**Positioning:** Early access for organisers only. Full workspace after they claim. Public browse + ticket purchase stay closed until **1 September 2026**.  

**Why claim before 1 Sept:** Founding Organiser · 2026 badge for everyone who claims in time **and publishes their first event**; **first 50** also get homepage showcase (+ website link) through November; **group social post** naming founding organisers now on the Hub organiser leaderboard (not personal one-to-ones). See `docs/FOUNDING-ORGANISER.md`.

**Personalisation:** `ORGANISER_NAME` is the **group listing name** (not a person). Greeting stays “Hi there”. Multi-page contacts get `OTHER_GROUPS_NOTE`.

### Claim flow (path B)
1. Email CTA → personal `/organisers/{slug}?email=…&intent=organiser-claim&auth=register|login&next=…` (their listing + events; other groups in the sidebar when the same email has more pages)
2. **Claim / edit this page** → register (free) or sign in
3. → `/organiser/?onboard=claim` → claim prompt
4. On Yes → profile drawer → events summary (if seeded) → tickets → **claim confirmed email** (badge unlocks after first publish; logo/website CTA)

**Fallback (soft path A):** contacts with no public slug still get `/for-organisers?…` — rare.

### Files
| File | Use |
|------|-----|
| `data/email2-brevo-ready.html` | Brevo campaign HTML |
| `data/email2-brevo-preview.html` | Browser preview |
| `data/Segment-A-Email2-Brevo-import.csv` | Re-import — `CLAIM_URL` is now `/organisers/{slug}?…` |
| `data/Segment-A-Email2-TEST-Brevo-import.csv` | Catherine + Rosie + test addresses |

Rebuild:

```bash
node scripts/build-email2-brevo.js
```

**Deploy Hub before send** so path B organiser pages + claim banner work on production (gate allowlist for `/organisers/:slug` and `/api/organisers?slug=`).

### Brevo send
1. [ ] Deploy Hub (path B claim landing)
2. [ ] Re-import `data/Segment-A-Email2-Brevo-import.csv` (update existing)
3. [ ] Map `ORGANISER_NAME` / `OTHER_GROUPS_NOTE` / `CLAIM_URL`
4. [ ] Paste `data/email2-brevo-ready.html`
5. [ ] Subject / reply-to / from as Email 1
6. [ ] Test send → CTA opens their organiser page → Claim / edit → password form → claim
7. [ ] Blast Segment A

Email 1 tracking: `docs/SEGMENT-A-EMAIL1.md`
