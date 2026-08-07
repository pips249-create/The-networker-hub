# Segment A — Email 2 (confirm organiser page)

**When:** **Fri 7 Aug 2026** (Email 1 sent 5 Aug)  
**Status:** **Soft path (A)** — CTA lands on `/for-organisers` first; password only when they choose Confirm  
**Template:** `organiser_launch_invite`  
**Subject (Brevo):** `Congratulations: {{ contact.ORGANISER_NAME }} is ready`  
**Send from:** Brevo (same co.uk / organiser list) · **Reply-to:** `catherine@thenetworkerhub.com`  
**Paste HTML:** `data/email2-brevo-ready.html`  

**Positioning:** Early access for organisers only. Full workspace after they confirm. Public browse + ticket purchase stay closed until **1 September 2026**.  

**Why confirm before 1 Sept:** Founding Organiser · 2026 badge for everyone who claims in time; **first 50** also get homepage showcase (+ website link) through November; **group social post** naming founding organisers now on the Hub organiser leaderboard (not personal one-to-ones). See `docs/FOUNDING-ORGANISER.md`.

**Personalisation:** `ORGANISER_NAME` is the **group listing name** (not a person). Greeting stays “Hi there”. Multi-page contacts get `OTHER_GROUPS_NOTE`.

### Claim flow (soft path A)
1. Email CTA → personal `/for-organisers?email=…&intent=organiser-claim&auth=register|login&next=…` (no password yet)
2. They read what’s included; banner + hero CTA: **Confirm your page**
3. Register/set password (or sign in) → `/organiser/?onboard=claim` → claim prompt

**Next (path B):** personalised preview of *their* group listing before password — not required for this send.

### Files
| File | Use |
|------|-----|
| `data/email2-brevo-ready.html` | Brevo campaign HTML |
| `data/email2-brevo-preview.html` | Browser preview |
| `data/Segment-A-Email2-Brevo-import.csv` | Re-import (~1,091 rows) — `CLAIM_URL` is now `/for-organisers?…` |
| `data/Segment-A-Email2-TEST-Brevo-import.csv` | Catherine + Rosie test |

Rebuild:

```bash
node scripts/build-email2-brevo.js
```

**Deploy Hub before send** so `/for-organisers` claim banner + new claim URLs work on production.

### Brevo send
1. [ ] Deploy Hub (for-organisers claim invite + claim URL change)
2. [ ] Re-import `data/Segment-A-Email2-Brevo-import.csv` (update existing)
3. [ ] Map `ORGANISER_NAME` / `OTHER_GROUPS_NOTE` / `CLAIM_URL`
4. [ ] Paste `data/email2-brevo-ready.html`
5. [ ] Subject / reply-to / from as Email 1
6. [ ] Test send → CTA opens for-organisers (not register) → Confirm → password form
7. [ ] Blast Segment A

Email 1 tracking: `docs/SEGMENT-A-EMAIL1.md`
