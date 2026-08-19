# Segment A — Email 3 (optional help)

**When:** after Email 2 openers are known  
**Audience:** Email 2 **openers only**  
**Send via:** **Resend** (`hello@mail.thenetworkerhub.com`) — not Brevo  
**Reply-to:** `catherine@thenetworkerhub.com`  
**Template:** `organiser_call_followup`  
**Subject:** `Need a hand with {{group_name}}?`

**Tone:** Help is optional. Claim in their own time, book a 15-minute slot, or reply **please call** / **email only**. Do **not** say we will ring tomorrow.

### Files
| File | Use |
|------|-----|
| `email-templates/organiser-call-followup.html` | Source HTML |
| `data/email3-brevo-ready.html` | Static preview / backup paste |
| `data/email3-brevo-preview.html` | Browser preview |
| `data/Segment-A-Email3-openers-Brevo-import.csv` | 28 openers |
| `data/Segment-A-Email3-call-sheet.csv` | Only ring people who reply **please call** |

```bash
node scripts/build-email3-call-followup.js
node scripts/send-email3-call-followup.js --test catherine@thenetworkerhub.com
node scripts/send-email3-call-followup.js --send
```
