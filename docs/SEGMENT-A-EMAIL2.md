# Segment A — Email 2 (confirm organiser page)

**When:** day after catalogue polish (Email 1 sent 5 Aug 2026 → target **Fri 7 Aug 2026**)  
**Template:** `organiser_launch_invite`  
**Subject (Brevo):** `Confirm {{ contact.ORGANISER_NAME }} on The Networker Hub`  
**Send from:** Brevo (same co.uk / organiser list) · **Reply-to:** `catherine@thenetworkerhub.com`  
**Paste HTML:** `data/email2-brevo-ready.html`  

**Positioning:** Early access for organisers only. Full workspace now (events, LinkedIn, emails, memberships, BOs). Public browse + ticket purchase stay closed until **1 September 2026**.  

**Personalisation:** `ORGANISER_NAME` is the **group listing name** (not a person). Greeting stays “Hi there”. Multi-page contacts get `OTHER_GROUPS_NOTE` (e.g. `, plus Chapter B and Chapter C`).

### Files
| File | Use |
|------|-----|
| `data/email2-brevo-ready.html` | Brevo campaign HTML (merge tags for group name + claim URL) |
| `data/email2-brevo-preview.html` | Browser preview (sample: 121 Business Links) |
| `data/Segment-A-Email2-Brevo-import.csv` | Re-import: `Email`, `Organiser name`, `OTHER_GROUPS_NOTE`, `CLAIM_URL` |

### Claim links
Each row gets a personal URL:
- **No Hub account yet** → `/register?email=…&intent=organiser-claim&next=/organiser/?onboard=claim`
- **Already has account** → `/login?email=…&intent=organiser-claim&next=/organiser/?onboard=claim`

Rebuild anytime:

```bash
node scripts/build-email2-brevo.js
```

### Pre-send checklist
- [ ] Soft register shows full form for `?intent=organiser-claim`
- [ ] Claim CTA opens without site password
- [ ] Brevo attributes mapped: `ORGANISER_NAME`, `OTHER_GROUPS_NOTE`, `CLAIM_URL`
- [ ] Subject uses `{{ contact.ORGANISER_NAME }}`
- [ ] Test to yourselves (register + login paths; check group name in body)
- [ ] Reply-to Catherine

Email 1 tracking: `docs/SEGMENT-A-EMAIL1.md`
