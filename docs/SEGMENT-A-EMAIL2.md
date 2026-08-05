# Segment A — Email 2 (confirm organiser page)

**When:** 3–5 days after Email 1 (sent 5 Aug 2026 → target **8–10 Aug 2026**)  
**Template:** `organiser_launch_invite`  
**Subject:** Confirm your page & finish setup — The Networker Hub  
**Send from:** Brevo (same co.uk / organiser list) · **Reply-to:** `catherine@thenetworkerhub.com`  
**Paste HTML:** `data/email2-brevo-ready.html`  

### Files
| File | Use |
|------|-----|
| `data/email2-brevo-ready.html` | Brevo campaign HTML (merge tags for name + claim URL) |
| `data/email2-brevo-preview.html` | Browser preview |
| `data/Segment-A-Email2-Brevo-import.csv` | Re-import / update list attributes: `Email`, `Organiser name`, `CLAIM_URL` |

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
- [ ] Brevo attributes mapped: `ORGANISER_NAME`, `CLAIM_URL`
- [ ] Test to yourselves (register + login paths)
- [ ] Reply-to Catherine

Email 1 tracking: `docs/SEGMENT-A-EMAIL1.md`
