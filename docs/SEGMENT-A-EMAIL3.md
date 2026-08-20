# Segment A — Email 3 (optional help)

**When:** after Email 2 openers are known  
**Audience:** Email 2 **openers only**  
**Send via:** **Resend** (`hello@mail.thenetworkerhub.com`) — not Brevo  
**Reply-to:** `catherine@thenetworkerhub.com`  
**Template:** `organiser_call_followup`  
**Subject:** `Do you need a hand with {{group_name}}?`

**Tone:** Help is optional. Claim in their own time, book a 15-minute slot, or reply **please call** / **email only**. Do **not** say we will ring tomorrow.

### Files
| File | Use |
|------|-----|
| `email-templates/organiser-call-followup.html` | Source HTML |
| `data/email3-brevo-ready.html` | Static preview / backup paste |
| `data/email3-brevo-preview.html` | Browser preview |
| `data/Email3-A-Segment.csv` | 28 openers |
| `data/Email3-A-Segment-call-sheet.csv` | Dial list |

```bash
node scripts/build-email3-call-followup.js
node scripts/send-email3-call-followup.js --test catherine@thenetworkerhub.com
node scripts/send-email3-call-followup.js --send
```
