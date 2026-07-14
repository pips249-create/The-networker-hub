# Complaints handling — procedure

**Operator:** The Networker Group Ltd  
**Contact:** hello@thenetworkerhub.com (subject line **Complaint**)  
**Acknowledgement target:** 2 working days  
**Substantive response target:** 14 calendar days  
**Last updated:** 10 July 2026

*Operational procedure. Not legal advice. Public summary: `legal-policies.html#legal`.*

---

## 1. Scope

This procedure covers complaints about The Networker Hub as a platform — not disputes that are solely between an attendee and an organiser about a private event, unless the complaint is about **how the Hub handled** that situation.

| Category | Examples | Primary owner |
|----------|----------|---------------|
| **Platform / service** | Login, bookings, refunds processed via Hub, account access, emails | Catherine Hancher (Operations Director) |
| **Listings & content** | Misleading event or opportunity listing, fake reviews, copyright | Catherine Hancher |
| **Advertising & sponsorship** | ASA concern about sponsored placement labelling or Hub marketing copy | Rosie McGilvray (Commercial Director) |
| **Data protection** | Privacy, cookies, marketing emails | Catherine Hancher → `GDPR-SAR-PROCEDURE.md` |
| **Payments** | Stripe checkout, fees, payout issues | Catherine Hancher + Finance |
| **Accessibility** | Barriers using the site | Catherine Hancher / Tech |

**Route data-protection complaints** under `docs/GDPR-SAR-PROCEDURE.md` (still log them in the complaints register with type “Data protection”).

**Route suspected illegal content** under `docs/ONLINE-SAFETY-ACT.md` and `docs/OPPORTUNITY-MODERATION.md` escalation rules.

---

## 2. Roles

| Role | Name | Responsibility |
|------|------|----------------|
| **Operations Director / complaints owner** | Catherine Hancher | Owns the register, platform/refund/listing complaints, final sign-off on escalated cases |
| **Commercial Director** | Rosie McGilvray | Advertising, sponsorship, ASA/media complaints |
| **Support inbox** | hello@thenetworkerhub.com | Monitored actively — log every complaint in Command Centre within 1 working day |
| **Privacy lead** | Catherine Hancher | Data complaints; ICO liaison if needed |
| **Moderation** | Catherine Hancher (Command Centre) | Listing/review complaints; unpublish or dismiss reports |

---

## 3. Intake

1. Complaint received at **hello@thenetworkerhub.com** with **“Complaint”** in the subject line (or clearly framed as a complaint in the body).
2. Log in the **complaints register** in Command Centre: **Support → Complaints** (`/admin/#support/complaints`). Supabase table: `public.complaints`.

   | Field | Example |
   |-------|---------|
   | Reference | CMP-2026-001 |
   | Date received | 2026-07-10 |
   | Complainant name | Jane Smith |
   | Complainant email | jane@example.com |
   | Category | Refund / Listing / Advertising / Data / Other |
   | Related booking or listing ID | REG-uuid / opportunity slug |
   | Acknowledgement sent | 2026-07-11 |
   | Due date (substantive) | 2026-07-24 |
   | Status | Open / Investigating / Awaiting third party / Resolved / Escalated |
   | Outcome | Upheld / Partly upheld / Not upheld / Referred |
   | Notes | |

3. Send acknowledgement within **2 working days** confirming receipt, reference number, and expected response date.

---

## 4. Triage (within 2 working days)

| If the complaint is about… | Action |
|----------------------------|--------|
| **Refund not received** | Check `registrations` + Stripe refund status; organiser policy in event snapshot |
| **Event cancelled, no refund** | Verify cancellation flow; organiser Connect balance; follow `docs/REFUNDS-AND-STRIPE-CONNECT.md` |
| **Misleading opportunity / earnings claim** | Suspend listing pending review; follow `docs/OPPORTUNITY-MODERATION.md` |
| **Fake or abusive review** | Command Centre → review reports queue |
| **Sponsored unit not labelled** | Fix placement in Command Centre; note ASA risk |
| **Hub marketing / email copy** | Director review; pause campaign if earnings-led or unsubstantiated |
| **Personal data** | Hand to privacy lead; SAR clock may apply |
| **Threats, fraud, illegal content** | Escalate immediately; preserve evidence |

**Do not** promise outcomes in the acknowledgement — only confirm you are investigating.

---

## 5. Investigation

1. Gather facts from Supabase, Stripe Dashboard, Command Centre logs, and email history.
2. Contact the **organiser or lister** if their conduct is relevant; allow them **5 working days** to respond unless urgent (safety/fraud).
3. Document evidence in the register (screenshots, refund IDs, policy version at time of booking).
4. For **attendee vs organiser** disputes where the Hub processed payment correctly:
   - Explain the organiser’s published refund policy and Consumer Rights Act position
   - Facilitate contact where appropriate
   - Escalate to Director if Hub error (wrong fee, failed email, system bug)

### Earnings and advertising complaints

If a complaint concerns **earnings figures** on an opportunity listing or **Hub-sponsored marketing**:

- Treat as **high priority** (reputational + ASA/CAP risk)
- Do not defend unverified earnings — require lister substantiation or remove/suspend the claim
- Hub’s own marketing must not imply we verify returns; see earnings guidance in `docs/OPPORTUNITY-MODERATION.md`
- **ASA complaint** → Director + legal adviser; respond to ASA if contacted

---

## 6. Resolution (within 14 days)

Send a substantive written response covering:

1. What we investigated  
2. What we found  
3. Action taken (refund, listing removal, account warning, bug fix, no breach found)  
4. Complainant’s options if dissatisfied (see section 7)

### Outcome actions (examples)

| Finding | Typical action |
|---------|----------------|
| Hub system error | Fix + refund/credit if applicable + apology |
| Organiser breach of terms | Warning, suspension, or removal; support attendee per policy |
| Misleading listing | Reject/suspend; notify enquirers if warranted |
| Complaint not upheld | Explain reasoning with reference to terms/policy at time of transaction |
| Repeat offender organiser | Suspend account; preserve evidence |

Close the register entry with outcome, date closed, and lessons learned (one line).

---

## 7. Escalation and external routes

If the complainant is not satisfied after our final response, signpost (as in `legal-policies.html`):

| Issue type | External route |
|------------|----------------|
| **Data protection** | ICO — [ico.org.uk](https://ico.org.uk) / 0303 123 1113 |
| **Consumer issues** | Citizens Advice — [citizensadvice.org.uk](https://www.citizensadvice.org.uk) |
| **Advertising** | ASA — [asa.org.uk](https://www.asa.org.uk) |
| **Fraud** | Action Fraud — [actionfraud.police.uk](https://www.actionfraud.police.uk) |
| **Serious illegal content** | Police / NCA as appropriate |

Internal escalation to **Director** when:

- Media or regulatory contact (ICO, ASA, Ofcom)
- Redress over £500 or systemic impact
- Policy change required
- Legal advice recommended

---

## 8. Response templates

### Acknowledgement

> Subject: Complaint received — [reference]
>
> Thank you for contacting us. We have logged your complaint under reference **[CMP-2026-XXX]** and aim to provide a substantive response by **[date]**.
>
> If your complaint relates to personal data, we may also handle it under our data-request process.
>
> The Networker Group Ltd

### Closure (upheld)

> Subject: Your complaint — [reference] — outcome
>
> We have completed our review of your complaint dated [date].
>
> **Outcome:** Upheld.  
> **Action taken:** [e.g. refund processed, listing suspended, account corrected].  
> **Reference:** [Stripe refund ID / ticket ID if applicable].
>
> If you remain dissatisfied, you may contact [ICO / Citizens Advice / ASA as relevant].
>
> The Networker Group Ltd

### Closure (not upheld)

> Subject: Your complaint — [reference] — outcome
>
> We have completed our review. Based on [booking reference / policy version / logs], [summary of findings].
>
> **Outcome:** Not upheld. [Clear reasoning tied to terms and facts.]
>
> If you remain dissatisfied, you may contact [relevant external body].
>
> The Networker Group Ltd

---

## 9. Reporting

**Quarterly** (or before scaling marketing / paid ticketing):

- Count open/closed complaints by category  
- Average days to resolve  
- Repeat themes (refunds, listings, emails)  
- Actions taken (product fixes, policy updates, moderator training)

Share summary with Director. Feed recurring issues into product backlog and `docs/COMPLIANCE-RUNBOOK.md` reviews.

---

## 10. Review

Review this procedure:

- **Annually**
- After any **ICO, ASA, or media** complaint
- Before **scaling opportunity listings** or earnings-related marketing

| Date | Change |
|------|--------|
| 2026-07-10 | Supabase register + Command Centre UI; directors assigned |
| 2026-07-10 | Formal procedure created |
