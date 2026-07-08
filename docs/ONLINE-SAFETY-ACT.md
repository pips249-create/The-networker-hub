# Online Safety Act 2023 — risk assessment & action plan

**Service:** The Networker Hub (user-to-user content: reviews, listings, enquiries, profiles)  
**Last updated:** 8 July 2026

*Risk assessment for internal use. Ofcom guidance and thresholds evolve — seek legal advice on in-scope duties. Not legal advice.*

---

## 1. Does the OSA apply to us?

The **Online Safety Act** primarily targets **user-to-user (U2U)** services and search services with **UK users**. Many duties apply only above **threshold user numbers** (category 1/2A/2B services).

**Our U2U features:**

- Event and opportunity **listings** (organiser-generated)
- **Reviews** (attendee-generated)
- **Enquiries** on opportunities (member → lister)
- Organiser **profiles** and images

**Likely position (early-stage platform):**

- We provide U2U functionality but may be **below** category thresholds today.
- We should still implement **proportionate** safety measures — good practice, CMA/DMCC alignment, and future-proofing if user base grows.

**Action:** Ask a UK tech lawyer annually: “Are we in scope for Category 1/2A/2B and what duties apply?”

---

## 2. Illegal content priorities (UK)

Focus moderation and reporting on content that is **illegal**:

| Category | Examples on Hub |
|----------|-----------------|
| Harassment / threats | Abusive reviews, enquiry messages |
| Hate | Discriminatory listing or review text |
| Fraud | Fake events, scam opportunities |
| CSEA | Not expected; zero tolerance if reported |
| Terrorism | Not expected; zero tolerance |

**Already in place:**

- Acceptable use policy (`legal-policies.html`)
- Admin moderation (opportunities, reviews)
- Review report workflow (`js/review-report.js` + Command Centre)
- Listing report (`js/listing-report.js` on event, organiser, and opportunity pages)

---

## 3. Proportionate measures (implement / maintain)

### A. Terms and policies ✓

- Acceptable use prohibits harassment, fraud, hate, spam
- Organiser terms require lawful listings
- Complaints procedure in legal information

### B. Reporting mechanisms

| Content type | Report path | Status |
|--------------|-------------|--------|
| Reviews | “Report review” on event/organiser pages + organiser dashboard | ✓ / extending to organiser dashboard |
| Opportunity listings | “Report listing” on detail page | ☑ Wired |
| General / illegal content | hello@the-networker.co.uk — subject “Content report” | Document in footer/help |

### C. Moderation capability

- Command Centre: review reports, opportunity queue, user suspension
- Target: acknowledge reports within **2 working days**; resolve simple cases within **5 working days**

### D. Transparency

- Publish how to report content (add to FAQ or legal overview if not visible enough)
- Annual internal record: number of reports, removals, account suspensions

### E. Children

- Terms require 18+ (or parental consent)
- Do not target children; no child-specific features

---

## 4. Risk register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Fake/scam opportunity listing | Medium | High | Pre-publish moderation — `OPPORTUNITY-MODERATION.md` |
| Fake negative review harming organiser | Medium | Medium | Report review + admin removal |
| Harassing enquiry message | Low | Medium | Block organiser; acceptable use enforcement |
| Platform grows into OSA category | Medium (over time) | High | Annual legal review; build moderation audit trail now |

---

## 5. Action checklist

| # | Action | Owner | Status |
|---|--------|-------|--------|
| 1 | Annual OSA scope review with solicitor | Director | ☐ |
| 2 | Ensure “Report listing” on all opportunity detail pages | Product | ☑ |
| 3 | Add “Report a problem” link in footer → content report email | Product | ☐ |
| 4 | Log content reports in moderation register | Ops | ☐ |
| 5 | Train moderator on illegal content escalation | Ops | ☐ |
| 6 | Document removals in internal audit log | Ops | ☐ |

---

## 6. Escalation to authorities

- **Immediate threat to life** → 999
- **CSEA content** → NCA CEOP; do not re-distribute material
- **Terrorism content** → Police Counter Terrorism Internet Referral Unit (via police.gov.uk)
- **Fraud at scale** → Action Fraud; internal account suspension

Preserve evidence (screenshots, IDs, timestamps) for law enforcement requests.

---

## 7. Change log

| Date | Change |
|------|--------|
| 2026-07-08 | Initial risk assessment |
