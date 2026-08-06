# Launch list segments — organisers / attendees / both

**Purpose:** Prep the ~3,500 contact database for August wider email and 1 September full send — without sending yet.  
**Related:** `docs/SEGMENT-A-EMAIL1.md` · `docs/SEGMENT-A-EMAIL2.md` · `PIPS-TODO.md` Tab 7

---

## Segments

| Segment | Who | Primary use |
|---------|-----|-------------|
| **Organisers** | Emails on a public group profile (Segment A) | Claim / publish waves (Email 2+) |
| **Attendees** | Hub accounts or legacy contacts with **no** organiser profile email | Soft launch / browse / book messaging |
| **Both** | Same email is on a group **and** has a Hub account (or booked before) | Claim-focused copy; already know the brand |

Always **dedupe by email** (one send per address). Prefer Segment A exclusions: exhibition-style names, internal/test accounts, browse-hidden groups.

---

## What we already have

| Asset | Role |
|-------|------|
| `data/Segment-A-Email1-Brevo-import.csv` | Organiser Email 1 (~1,100 unique) |
| `data/Segment-A-Email2-Brevo-import.csv` | Same + personal `CLAIM_URL` |
| Hub `organisers` + Auth users | Source of truth for organiser vs account |

The legacy **~3,500** Brevo / co.uk list is **not** fully in this repo. Export it from Brevo, then classify.

---

## Build Hub-side classification

```bash
node scripts/build-launch-list-segments.js
```

Writes under `data/`:

| File | Contents |
|------|----------|
| `launch-segment-organisers.csv` | Public organiser emails (Segment A rules) |
| `launch-segment-hub-accounts.csv` | Hub account emails |
| `launch-segment-both.csv` | Intersection |
| `launch-segment-attendees-only.csv` | Hub accounts **not** on organiser list |
| `launch-segment-summary.json` | Counts |

---

## Merge with Brevo 3,500 export

1. Export full list from Brevo (Email column required).
2. Save as `data/brevo-full-list.csv` (local only — do not commit if it contains personal data you don’t want in git).
3. Re-run:

```bash
node scripts/build-launch-list-segments.js --brevo=data/brevo-full-list.csv
```

Extra columns in summary: Brevo-only attendees, Brevo∩organisers, Brevo∩both.

---

## Send order (when ready — not this week)

1. Organisers — Email 2 claim links (Brevo Segment A import already built).  
2. Wider organiser wave (500–1,000) after Resend Pro / feedback.  
3. Attendees / both — soft launch messaging after catalogue gate-off.  
4. Remainder of 3,500 on 1 September.

**Do not** blast the full list until SPF/DKIM, Resend Pro, and soft-launch stability are confirmed.
