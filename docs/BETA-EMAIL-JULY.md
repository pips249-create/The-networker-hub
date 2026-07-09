# July 2026 beta email — organiser claim wave

Send to **50–100 organisers** first (not the full 3,500 list). Goal: **20 groups with at least one published event** before widening in August.

## How to send

1. Command Centre → **Campaigns** (bulk send, max 50 per batch)
2. Template: `organiser_claim_invite` (auto-selected)
3. Paste recipient emails — **one per line**, must match the email on the organiser profile
4. Leave **Claim URL** blank — default deep-link opens the claim modal after sign-in
5. Track results in the spreadsheet below

**Default claim URL (per recipient):**

```
{SITE_URL}/login.html?email={EMAIL}&next=/organiser/index.html?onboard=claim
```

## Segment your list

| Segment | Who | Email angle | Guide link |
|---------|-----|-------------|------------|
| **A — Networking** | Breakfast clubs, BNI-style groups, chambers | Claim + republish next meeting | `/guides/list-an-event.html` |
| **B — Exhibition / conference** | Trade shows, summits, awards dinners | Claim + refresh listing; paid tickets optional | `/guides/list-a-conference-or-exhibition.html` |
| **C — Dormant** | On old list but inactive | Soft “your profile is ready” — free listing only | Either guide |

Send **Segment A first** (20–40 emails). Fix friction. Then B (10–20). Hold C for August.

## Subject lines (pick one per segment)

**Networking (A):**

- `Your networking group is on The Networker Hub — claim your page`
- `{{Group name}} — claim your organiser profile (2 minutes)`

**Exhibition / conference (B):**

- `Your exhibition listing is ready on The Networker Hub`
- `Claim {{Group name}} — list your next conference or exhibition`

## Plain-text follow-up (if you reply manually)

```
Hi {{name}},

Your group is already listed on The Networker Hub. Three quick steps:

1. Sign in and confirm “Yes, this is my group”
2. Check your logo and description
3. Republish your next event (free is fine)

Claim here: {SITE_URL}/login.html?email={EMAIL}&next=/organiser/index.html?onboard=claim

Guides:
- Networking meetings: {SITE_URL}/guides/list-an-event.html
- Conferences & exhibitions: {SITE_URL}/guides/list-a-conference-or-exhibition.html

Stuck? Reply to this email — we can do a 15-minute screen-share.

— Rosie / Catherine
The Networker Hub
```

## Tracking spreadsheet

| Email | Segment | Sent | Claimed? | Event published? | Paid ticket? | Blocker | Notes |
|-------|---------|------|----------|------------------|--------------|---------|-------|
| | A/B/C | | | | | | |

**Weekly review:** Top 3 blockers → fix in product or FAQ → update Hubert suggestions.

## Pass criteria (end of July)

- [ ] 50–100 emails sent
- [ ] 20+ groups with ≥1 published event
- [ ] 5+ groups with paid checkout (stretch)
- [ ] Top blockers documented and fixed
- [ ] SPF/DKIM/DMARC verified before wider send

## Do not

- Email the full 3,500 list until July beta is stable
- Require paid tickets or Stripe for first republish
- Promise features not shipped (promo codes, booth booking, check-in app)

## Related

- Claim invite template: `email-templates/organiser-claim-invite.html`
- Onboarding flow: dashboard tour → claim modal → profile review → first event
- Migration **135** (`event_type_conference`) must be run in Supabase before deploy
