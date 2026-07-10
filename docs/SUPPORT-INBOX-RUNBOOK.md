# Support inbox runbook — hello@thenetworkerhub.com

**Owner:** Catherine Hancher (Operations Director, primary) · Rosie McGilvray (Commercial Director, cover)  
**Last updated:** 10 July 2026

*Operational guide. Not legal advice.*

---

## 1. Purpose

`hello@thenetworkerhub.com` is the support, privacy, and complaints inbox for The Networker Hub (The Networker Group Ltd).

**Response targets**

| Priority | Examples | Target |
|----------|----------|--------|
| Urgent | Payment taken but no confirmation; suspected fraud; data breach report | Same working day |
| Standard | Login issues; publish help; refund request; GDPR request | 2 working days to acknowledge; 5 working days substantive reply |
| Low | General feedback; feature questions | 5 working days |

---

## 2. Daily monitoring

- [ ] Check inbox at least once per working day (morning + end of day before launch week)
- [ ] Triage: label or folder — `Support` · `Billing` · `Privacy` · `Complaint` · `Sales`
- [ ] Escalate **Complaint** or **Privacy** subjects to Catherine same day
- [ ] Log every **Complaint** in Command Centre → **Support → Complaints** (see `docs/COMPLAINTS-PROCEDURE.md`)

**Sales / sponsorship enquiries** → forward or cc `rosie@thenetworkerhub.com`

---

## 3. Common topics (first-line answers)

| Topic | Action |
|-------|--------|
| **Cannot log in** | Point to password reset on `/login.html`. Check account exists in Supabase `hub_accounts`. |
| **Event not on browse** | Event must be Published, Approved, organiser profile published. See FAQ — organiser completes tickets + refund policy. |
| **Refund request** | Direct attendee to organiser first (contract is with organiser). Facilitate via Command Centre if unresolved. |
| **Payout / Stripe Connect** | Organiser completes Connect in organiser dashboard → Financials. See `docs/STRIPE-CONNECT-ORGANISER-GUIDE.md`. |
| **Opportunity listing rejected** | Send automated reason; organiser edits and resubmits. Escalate borderline cases per `docs/OPPORTUNITY-MODERATION.md`. |
| **Report fake review** | Use Report review on event page; Command Centre → Reviews queue. |
| **Data request** | Follow `docs/GDPR-SAR-PROCEDURE.md` — subject line “Data request”. |
| **Formal complaint** | Follow `docs/COMPLAINTS-PROCEDURE.md` — log in Command Centre; ack within 2 working days. |
| **Cookie / marketing** | Account settings → email preferences; cookie banner → Cookie settings. |

Public FAQ: `/faq.html` · Legal: `/legal-policies.html`

---

## 4. Out-of-hours / launch week

During soft launch (late August) and full launch (September):

- Monitor inbox twice daily minimum
- Pre-draft replies for top 5 FAQs (login, publish, refunds, opportunities, sponsorship)
- Keep Command Centre admin login tested (`npm run check:business-ops`)

---

## 5. Escalation

| Situation | Escalate to |
|-----------|-------------|
| Legal threat or regulator contact | Catherine + solicitor |
| Suspected fraud listing | Suspend in Command Centre; preserve evidence |
| ICO / GDPR breach | `docs/DATA-BREACH-RESPONSE.md` — incident lead Catherine |
| ASA / advertising complaint | Rosie McGilvray + legal adviser |

---

## 6. Sign-off

| Item | Owner | Status |
|------|-------|--------|
| Inbox monitored weekdays | Catherine | ☑ Runbook live |
| Auto-reply / signature with company details | Catherine | ☐ Optional before launch |
| Resend receiving for hello@ domain | Tech | ☐ Verify in Resend dashboard |
