# Business opportunity listings — moderation guide

**Purpose:** Reduce legal and reputational risk from franchise, investment, and MLM-style listings  
**Last updated:** 10 July 2026

*Operational guide. Not legal advice.*

**Moderation owner:** Catherine Hancher (primary) · Rosie (cover) · Queue: Command Centre → Opportunities

---

## 1. Risk summary

Opportunity listings sit outside FCA authorisation. The main risks:

| Risk | Law / regulator |
|------|-----------------|
| Misleading investment or earnings claims | Consumer Protection from Unfair Trading Regulations 2008; ASA/CAP Code |
| Unregulated financial promotions | Financial Services and Markets Act 2000; FCA perimeter |
| Pyramid / trading schemes | Trading Schemes Act 1996 |
| Defamation / fraud | Common law; police referral for criminal conduct |

The platform already shows disclaimers and blocks some MLM patterns in `js/opportunities-catalog.js`. **Human review before publish** is the best control.

---

## 2. Recommended course of action

### Tier 1 — Keep (implement now)

1. **Pre-publish review** — All opportunity listings require admin approval before going live (`activateOpportunityListingPayment` sets `Pending Review`; live email on admin approve).
2. **Structured listing fields** — Investment amount, opportunity type, territory / location — required on submit; automated rejection if missing or vague.
3. **Automated red flags** — Server-side pattern checks in `api/_lib/opportunity-moderation.js` for recruitment-primary network marketing, guaranteed income, passive income, crypto, and unregulated investment language.
4. **Reject + email** — `opportunity_listing_rejected` template with required admin reason (or automated reason); edit and resubmit.
5. **Enquiry disclaimer** — Keep on browse, detail, and enquiry form (already implemented).
6. **Organiser terms** — Prohibit pyramid selling, recruitment-primary network marketing, and unregulated financial products (already in legal policies).

### Tier 2 — Strengthen (next quarter)

7. **FCA disclaimer on high-risk types** — Extra checkbox for listers: “This is not a regulated investment; I will not make guaranteed return claims.”
8. **Annual re-review** — Expired listings re-checked on renewal.
9. **Member report listing** — `listing-report.js` on opportunity detail pages (implemented).
10. **Solicitor review** — One-off review of opportunity disclaimer wording before scaling listings — **Director action item** (see `docs/COMPLIANCE-RUNBOOK.md`).

### Tier 3 — If you scale significantly

11. Manual due diligence for listings above £X investment threshold
12. Require Companies House number for franchise listers
13. Insurance review (professional indemnity)

---

## 3. Moderation decision matrix

| Signal | Action |
|--------|--------|
| Guaranteed income / “quit your job in 90 days” | **Reject** |
| Recruitment-primary network marketing (downline / upline / team-build income) | **Reject** |
| Product-selling network marketing (typed `network-marketing`, no recruitment pitch) | **Approve** if substantiated; not eligible for Premium Spotlight |
| Investment opportunity without risk warning | **Reject** or require edit |
| Legitimate franchise with territory + fee stated | **Approve** if substantiated |
| Partnership / white-label B2B | **Approve** if clear and not misleading |
| Duplicate or spam listings | **Reject** / suspend organiser |
| Complaint from member | **Review within 48h**; suspend pending investigation |

---

## 4. Moderation workflow

1. Listing submitted → status `pending_review` (or equivalent).
2. Admin Command Centre → Opportunities queue.
3. Moderator checks:
   - [ ] Truthful title and description
   - [ ] Investment/fee clearly stated
   - [ ] No prohibited patterns (MLM, guaranteed returns)
   - [ ] Lister has organiser terms accepted
   - [ ] Images do not infringe copyright (see legal policies)
4. **Approve** → publish + `opportunity_listing_live` email  
   **Reject** → reason recorded + `opportunity_listing_rejected` email
5. Log decision in internal register (date, listing ID, moderator, outcome).

---

## 5. Escalation

- Suspected **fraud** → suspend listing and account; preserve evidence; consider Action Fraud referral.
- **FCA-regulated product** without authorisation → reject; legal advice if repeated.
- **Media / ASA complaint** → Director + legal adviser.

---

## 6. Change log

| Date | Change |
|------|--------|
| 2026-07-28 | Product-selling `network-marketing` type allowed; recruitment-primary auto-reject; not eligible for Premium Spotlight; browse hide filter default on |
| 2026-07-10 | Earnings attestation required when listers enter financial figures; moderation owner assigned |
| 2026-07-08 | Pre-publish review enforced; automated red flags; report listing; admin rejection reasons |
| 2026-07-08 | Initial moderation guide |
