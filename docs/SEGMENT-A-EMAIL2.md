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

### Brevo setup
- [ ] Re-import `data/Segment-A-Email2-Brevo-import.csv` (update existing contacts)
- [ ] Map attributes: `Organiser name` → `ORGANISER_NAME`, `OTHER_GROUPS_NOTE` → `OTHER_GROUPS_NOTE`, `CLAIM_URL` → `CLAIM_URL`
- [ ] Paste HTML from `data/email2-brevo-ready.html`
- [ ] Subject: `Confirm {{ contact.ORGANISER_NAME }} on The Networker Hub`
- [ ] Reply-to: `catherine@thenetworkerhub.com`
- [ ] From: Hub / co.uk sender you used for Email 1 (or agreed Hub address)

### Test-send checklist (tick before Fri blast)
Send a **test campaign** (or preview to contact) to Catherine + Rosie covering both path types.

**Register path** (pick a row whose `CLAIM_URL` contains `/register?`)
- [ ] Inbox: subject shows the **group name** (not “your organiser page”)
- [ ] Body headline + “We’ve prepared **…” use the same group name
- [ ] CTA opens **without** site-access password
- [ ] Email field is prefilled; claim/create-account form is visible
- [ ] “Prefer a walkthrough” mailto links open to Catherine / Rosie

**Login path** (pick a row whose `CLAIM_URL` contains `/login?`)
- [ ] Same personalisation checks as above
- [ ] Lands on sign-in (not register); email prefilled
- [ ] After sign-in, `/organiser/?onboard=claim` is reachable without site password

**Smoke (optional, 2 minutes)**
- [ ] `/for-organisers` still opens without password
- [ ] Footer Privacy / Terms / Refunds / Contact open
- [ ] One multi-group contact (WIBN or BMUK) shows the “plus …” note if you include them in the test list

### Pre-send checklist
- [ ] Soft register shows full form for `?intent=organiser-claim`
- [ ] Claim CTA opens without site password
- [ ] Brevo attributes mapped (see above)
- [ ] Test sends passed
- [ ] Catalogue / Events / Organisers / BO polish you’re waiting on is done enough to send

Email 1 tracking: `docs/SEGMENT-A-EMAIL1.md`
