# Segment A — Claim rematch (pre-launch via Resend)

**When:** evening of **31 Aug** / early **1 Sept 2026** (before 9am ticket buying)  
**Audience:** **Unclaimed networking group** organiser profiles only (Segment A rules)  
**Not included:** the ~3,500 Brevo/attendee contact list, claimed groups, exhibitions, internal/test, launch exclusions  
**Send via:** **Resend** (`RESEND_FROM` / `hello@mail.thenetworkeruk.com`)  
**Reply-to:** `catherine@thenetworkeruk.com`  
**Template:** `organiser_claim_invite`  
**Subject (rematch override):** `Claim {{organiser_name}} before launch — Founding Organiser · 2026`

### Why this list (not 3,500)

| List | Who |
|------|-----|
| **This rematch** | Public Hub **organiser** pages that are still unclaimed, with a profile email, networking-style (not exhibition), minus exclusions |
| **~3,500** | Legacy Brevo/co.uk export — attendees + mixed contacts — **do not use for claim rematch** |

Typical size is on the order of **Segment A unclaimed** (hundreds), not thousands. Rebuild for the live count.

### Build

Needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `local.env`.

```bash
npm run build:claim-rematch
# or: node scripts/build-claim-rematch-resend.js
```

Outputs:

| File | Use |
|------|-----|
| `data/Claim-Rematch-Resend.csv` | Full send list |
| `data/Claim-Rematch-Resend-batch-NN.csv` | 50-packs for Command Centre Campaigns |
| `data/Claim-Rematch-Resend-summary.json` | Counts + skip reasons |

### Send (Resend CLI — preferred for a full rematch)

Needs `RESEND_API_KEY` (+ `RESEND_FROM`).

```bash
# Dry-run
npm run send:claim-rematch

# One test to yourself (uses first row’s group personalisation)
node scripts/send-claim-rematch-resend.js --test catherine@thenetworkeruk.com

# Soft batches
node scripts/send-claim-rematch-resend.js --send --limit=50
node scripts/send-claim-rematch-resend.js --send --offset=50 --limit=50

# Full remaining list
node scripts/send-claim-rematch-resend.js --send
```

### Or Command Centre (max 50 per click)

1. `#email/campaigns`
2. Template: **Short claim nudge (existing listing only)**
3. Paste emails from a `Claim-Rematch-Resend-batch-NN.csv` **Email** column (≤50)
4. Leave Claim URL blank — API builds a personalised link per address
5. Send batch, then next file

Campaigns now look up the **group listing name** from the organiser profile when possible (not the email local-part).

### Checklist

1. [ ] Rebuild list so claimed groups from today are excluded  
2. [ ] Spot-check summary JSON — recipients ≪ 3500  
3. [ ] Test send to Catherine / Rosie  
4. [ ] Confirm claim CTA opens their organiser page / register path on production  
5. [ ] Send in batches; pause if bounce/complaint spike  
6. [ ] Track in ops outreach sheet  

See also: `docs/SEGMENT-A-EMAIL2.md`, `docs/FOUNDING-ORGANISER.md`, `docs/BETA-EMAIL-JULY.md`.
