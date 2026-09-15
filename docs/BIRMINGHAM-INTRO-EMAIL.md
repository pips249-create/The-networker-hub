# Birmingham intro email (Brevo)

**Purpose:** Introduce The Networker UK to a Birmingham / West Midlands contact list — browse first, optional free account, soft ask for missing groups and exhibitions/conferences.

**HTML (Resend Broadcast — use this):** `data/birmingham-intro-resend-broadcast.html`  
**HTML (Brevo):** `data/birmingham-intro-brevo-ready.html`

**Resend contact list (Excel → CSV):** `docs/RESEND-CONTACT-IMPORT-EXCEL.md` · template `data/birmingham-intro-resend-import-template.csv`

**Primary link:** [thenetworkeruk.com/networking/birmingham](https://www.thenetworkeruk.com/networking/birmingham)

**Secondary link:** [Create account → back to Birmingham page](https://www.thenetworkeruk.com/register?next=%2Fnetworking%2Fbirmingham)

---

## Subject lines (A/B friendly)

**Variant A — growth / events (pairs with v8 hero subline in HTML)**

- `Looking to grow your business in Birmingham? Check out these events`
- `Growing in Birmingham? Events worth a look`

**Variant B — invitation / calendar (softer cold open)**

- `An invitation — find Birmingham networking & events in one place`
- `Networking in Birmingham — one place to browse what's on`
- `Birmingham business events & groups on The Networker UK`

**Tip:** Send variant A to ~15–20% of the segment first; compare click rate on `utm_content=cta-hero` and Birmingham page UTMs. Keep variant B for the rest if A feels too “marketing” in replies.

## Preheader (matches HTML hidden text in v8)

`Networking, workshops and trade shows in Birmingham — see what's on, free on The Networker UK.`

For variant B subjects only, you can override preheader in Resend to:  
`Breakfasts, groups, exhibitions and conferences around Birmingham — browse free on The Networker UK.`

---

## Message structure

| Block | Intent |
|-------|--------|
| Hero + intro | Headline + growth subline; what TN UK is; Birmingham relevance |
| Gold “free browse” band | Groups, exhibitions/conferences — no sign-up |
| **Primary CTA** | `/networking/birmingham` (above event cards) |
| Live event cards | Four Birmingham listings with images |
| Purple “missing listing” box | Reply with name / introduce us to organiser |
| Sign-off | Rosie & Catherine · reply or `hi@thenetworkeruk.com` |

No partner-programme or organiser-claim language in this send — keep it attendee / introducer friendly.

---

## Resend checklist (audience first)

1. [ ] Build list in Excel using columns in `data/birmingham-intro-resend-import-template.csv`
2. [ ] Dedupe on `email`, export **CSV UTF-8**
3. [ ] Resend → Contacts → Import CSV → map columns → segment e.g. `Birmingham intro`
4. [ ] In Resend, create contact property **`company_name`** (string) if you don’t have it; map CSV column on import
5. [ ] Create Broadcast — **replace all HTML** with **`data/birmingham-intro-resend-broadcast.html`**. Confirm the source contains `<!-- birmingham-resend-v8` (growth subline, CTA above event cards).
6. [ ] **Logo URL:** Until the PR that adds `assets/logo-networker-uk-email-header.png` is deployed, the HTML uses a GitHub raw image URL so Resend preview works. After deploy, switch the header `img src` to `https://www.thenetworkeruk.com/assets/logo-networker-uk-email-header.png?v=20260915tnuk` (better for deliverability).
7. [ ] Test send, then send to segment
8. [ ] **Before each send:** refresh the four Birmingham event cards (live listings):

```bash
node scripts/build-birmingham-intro-resend-events.js
```

Then re-paste HTML into Resend (or update the draft).

Full Excel/export rules: `docs/RESEND-CONTACT-IMPORT-EXCEL.md`.

---

## Brevo checklist

1. [ ] New campaign → paste HTML from `birmingham-intro-brevo-ready.html`
2. [ ] Confirm `{{ unsubscribe }}` renders (Brevo tag)
3. [ ] From name: **The Networker UK** (or Rosie / Catherine if you prefer personal)
4. [ ] Reply-to: **hi@thenetworkeruk.com** (or catherine@ — stay consistent)
5. [ ] Audience: Birmingham list only — **exclude** Segment A organiser claim waves if sending the same week
6. [ ] Test send to team inboxes (Gmail + iPhone Mail)
7. [ ] Batch (e.g. 200–500/day) if list is large; watch unsubscribes and spam reports

UTM params are already on CTA links: `utm_campaign=birmingham-intro`.

---

## What to track

- Clicks on Birmingham page (UTM + `/networking/birmingham` analytics)
- New registrations with `next=/networking/birmingham`
- **Replies** tagged in inbox: “Birmingham intro — missing listing” (groups, exhibitions, conferences)

---

## Plain-text fallback (optional)

```
Hi there,

If you ever hunt across different sites for a breakfast, business group, or trade show in Birmingham, we built The Networker UK to pull that into one place — networking meetings, workshops, exhibitions and conferences included.

Free to browse: https://www.thenetworkeruk.com/networking/birmingham

Create a free account when you want tickets or saved events (about 2 minutes):
https://www.thenetworkeruk.com/register?next=%2Fnetworking%2Fbirmingham

Know a group or event we're missing? Reply with the name — or introduce us to the organiser and we'll follow up.

Rosie & Catherine
The Networker UK
hi@thenetworkeruk.com
```
