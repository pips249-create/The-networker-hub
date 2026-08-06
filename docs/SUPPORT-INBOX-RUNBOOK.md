# Support inbox runbook — hello@thenetworkerhub.com

**Owner:** Catherine Hancher (Operations Director, primary) · Rosie McGilvray (Commercial Director, cover)  
**Last updated:** 6 August 2026

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
| **Cannot log in** | Point to password reset on `/login`. Check account exists in Supabase `hub_accounts`. |
| **Event not on browse** | Event must be Published, Approved, organiser profile published. See FAQ — organiser completes tickets + refund policy. |
| **Refund request** | Direct attendee to organiser first (contract is with organiser). Facilitate via Command Centre if unresolved. |
| **Payout / Stripe Connect** | Organiser completes Connect in organiser dashboard → Financials. See `docs/STRIPE-CONNECT-ORGANISER-GUIDE.md`. |
| **Opportunity listing rejected** | Send automated reason; organiser edits and resubmits. Escalate borderline cases per `docs/OPPORTUNITY-MODERATION.md`. |
| **Report fake review** | Use Report review on event page; Command Centre → Reviews queue. |
| **Data request** | Follow `docs/GDPR-SAR-PROCEDURE.md` — subject line “Data request”. |
| **Formal complaint** | Follow `docs/COMPLAINTS-PROCEDURE.md` — log in Command Centre; ack within 2 working days. |
| **Cookie / marketing** | Account settings → email preferences; cookie banner → Cookie settings. |

Public FAQ: `/faq` · Legal: `/legal-policies`

---

## 4. Pre-draft replies (launch week)

Copy/paste and personalise. Keep tone short and human.

### Login / password

> Thanks for getting in touch.  
> Please try resetting your password at https://www.thenetworkerhub.com/login — use the same email as your account.  
> If that doesn’t work, reply from the address on the account and we’ll look it up.

### Claim / “where is my group?”

> Your networking group may already be listed on The Networker Hub.  
> Use the personal claim link from our email if you have one, or go to https://www.thenetworkerhub.com/for-organisers and follow Claim your page.  
> If your email has changed since the-networker.co.uk, reply with the old and new addresses and the group name.

### Publish an event

> Sign in → organiser dashboard → create or open the event → complete tickets and refund policy → Publish.  
> Guide: https://www.thenetworkerhub.com/guides/list-an-event  
> If it still doesn’t appear on Browse after publishing, send us the event title and we’ll check approval/status.

### Bookings / confirmation email missing

> Your tickets also appear under My Hub: https://www.thenetworkerhub.com/account/  
> Please check spam/junk for the confirmation. If it’s still missing, reply with the event name and the email used at checkout.

### Refunds

> Refunds follow the organiser’s refund policy on the event page. Please contact the organiser first.  
> If you’ve already done that and need us to help, send the event name, order/reference, and what the organiser said.

### Payouts / Stripe Connect

> Paid ticket money goes to your connected Stripe account after Connect onboarding.  
> In the organiser dashboard open Revenue / Financials → Connect Stripe.  
> Guide: see Stripe Connect organiser help in our docs, or reply and we’ll walk you through it.

### “Where did the old site go?” (after redirect)

> We’ve upgraded the-networker.co.uk to The Networker Hub: https://www.thenetworkerhub.com  
> Same team — new platform for events, organiser pages, and bookings.  
> Bookmark the new address; your co.uk email still works as before.

### Sponsorship / advertising

> Thanks — I’ve copied Rosie (rosie@thenetworkerhub.com).  
> Overview of placements: https://www.thenetworkerhub.com/advertising

---

## 5. Out-of-hours / launch week

During soft launch (late August) and full launch (September):

- Monitor inbox twice daily minimum
- Use Section 4 drafts for the top FAQs
- Keep Command Centre admin login tested (`npm run check:business-ops`)

---

## 6. Escalation

| Situation | Escalate to |
|-----------|-------------|
| Legal threat or regulator contact | Catherine + solicitor |
| Suspected fraud listing | Suspend in Command Centre; preserve evidence |
| ICO / GDPR breach | `docs/DATA-BREACH-RESPONSE.md` — incident lead Catherine |
| ASA / advertising complaint | Rosie McGilvray + legal adviser |

---

## 7. Sign-off

| Item | Owner | Status |
|------|-------|--------|
| Inbox monitored weekdays | Catherine | ☑ Runbook live |
| Launch FAQ pre-drafts | Catherine | ☑ Section 4 (6 Aug 2026) |
| Auto-reply / signature with company details | Catherine | ☐ Optional before launch |
| Resend receiving for hello@ domain | Tech | ☐ Verify in Resend dashboard |
