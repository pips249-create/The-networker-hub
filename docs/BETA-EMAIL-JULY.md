# July 2026 beta email — organiser two-step outreach

Send to **50–100 organisers** first (not the full 3,500 list). Goal: **20 groups with at least one published event** before widening in August.

## Recommended sequence (trust first, action second)

| Step | When | Template | From | Asks for password? |
|------|------|----------|------|-------------------|
| **Email 1** | This week | `organiser_rebrand_announcement` | `hello@the-networker.co.uk` (or co.uk inbox) | **No** |
| **Email 2** | 3–5 days later | `organiser_launch_invite` | `hello@thenetworkerhub.com` | **Yes** (create password) |

### Why two emails?

Organisers who knew **the-networker.co.uk** may treat a single “claim your page” email from a new domain as phishing. Email 1 establishes recognition; Email 2 asks for action.

---

## Email 1 — Rebrand announcement

**Subject:** `We've been quietly rebuilding The Networker`

**What it does:**

- Explains the move from the-networker.co.uk → thenetworkerhub.com
- Says their listing is being prepared — **nothing to do today**
- CTA: “See the new platform for organisers” → `/for-organisers` (no account)
- Company number + both domains in footer

**How to send:**

1. Command Centre → **Campaigns**
2. Template: **Email 1 — Rebrand announcement**
3. Paste group profile emails (one per line, max 50)
4. Send

**From address options:**

| Method | Setup |
|--------|--------|
| **Resend (bulk)** | Verify `the-networker.co.uk` in Resend; set `RESEND_FROM_LEGACY=Rosie @ The Networker <hello@the-networker.co.uk>` in Vercel |
| **Manual (safest for first 50)** | Send from Rosie/Catherine’s co.uk inbox; copy body from Templates preview or forward the rendered HTML |

Reply-to is set to `hello@the-networker.co.uk` when sent via Campaigns.

---

## Email 2 — Confirm organiser page

**Subject:** `Confirm your organiser page — The Networker Hub`

**What it does:**

- References Email 1 (“you may have seen our note…”)
- CTA: **Confirm your organiser page** → register or login with group email
- Steps: password → confirm page → review profile & seeded event → tickets → publish (Stripe only for paid)

**How to send:**

1. Wait **3–5 days** after Email 1
2. Campaigns → **Email 2 — Confirm organiser page**
3. Same recipient list (or those who didn’t reply “is this real?”)
4. Leave Claim URL blank — auto link per recipient:

```
New account:  {SITE_URL}/register?email={EMAIL}&next=/organiser/?onboard=claim&intent=organiser-claim
Has account:  {SITE_URL}/login?email={EMAIL}&next=/organiser/?onboard=claim&intent=organiser-claim
```

Organisers do **not** need the site preview password (`SITE_ACCESS_PASSWORD`).

### Pre-send page gate (must pass)

Before Email 1, run:

```bash
npm run check:organiser-journey
# or: node scripts/smoke-test-organiser-journey.js https://www.thenetworkerhub.com
```

That checks the Email 1 funnel opens **without** the preview password (`/for-organisers`, contact, about, legal, auth), while guides/FAQ/advertising/catalogue **stay gated**. On `/for-organisers`, CTAs stay soft (“nothing to do today”) until the public catalogue opens.

Middleware early-access + signed-in session bypass live in `middleware.js` (`ORGANISER_EARLY_ACCESS_PREFIXES`). Deploy that before sending.

---

## Segment your list

| Segment | Who | Email 1 angle | Email 2 angle |
|---------|-----|---------------|---------------|
| **A — Networking** | Breakfast clubs, BNI-style, chambers | “Same team, upgraded platform” | Confirm + republish next meeting |
| **B — Exhibition** | Trade shows, summits | Same | Confirm + refresh listing |
| **C — Dormant** | On old list, inactive | Soft rebrand only | Hold until August |

Send **Segment A first** (20–40). Fix friction. Then B.

---

## Tracking spreadsheet

| Email | Segment | Email 1 sent | Email 2 sent | Confirmed? | Event live? | Blocker | Notes |
|-------|---------|--------------|--------------|------------|-------------|---------|-------|
| | A/B/C | | | | | | |

**Weekly review:** Top 3 blockers → fix in product or FAQ → update Hubert.

---

## Pass criteria (end of July)

- [ ] 50–100 organisers received Email 1
- [ ] 50–100 received Email 2 (3–5 days later)
- [ ] 20+ groups with ≥1 published event
- [ ] “Is this real?” replies documented and copy adjusted if needed
- [ ] SPF/DKIM/DMARC on sending domain(s)

## Do not

- Skip Email 1 and go straight to “confirm your page” for cold organisers
- Use emoji or urgency in subject lines for the first wave
- Email the full 3,500 list until beta is stable
- Require paid tickets or Stripe for first republish

---

## Related

- Email 1: `email-templates/organiser-rebrand-announcement.html` (`organiser_rebrand_announcement`)
- Email 2: `email-templates/organiser-launch-invite.html` (`organiser_launch_invite`)
- Short nudge: `email-templates/organiser-claim-invite.html` (`organiser_claim_invite`)
- Migrations **155** + **156** — run before sending
- Organiser early-access paths: `middleware.js` → `ORGANISER_EARLY_ACCESS_PREFIXES`
- Legacy redirect: `docs/LEGACY-REDIRECT-MAP.md`
