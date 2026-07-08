# Compliance runbook — The Networker Hub

Internal checklist for items that cannot be fully automated in code. Review quarterly.

**Last updated:** 8 July 2026

## Implemented in the platform

- [x] Legal policies page (`legal-policies.html`) — incl. copyright & content (July 2026)
- [x] Cookie consent banner with analytics gating (PECR)
- [x] Terms & Privacy checkbox at registration
- [x] Marketing email opt-in at registration (unchecked by default) + account settings
- [x] Pre-checkout acknowledgement (organiser, price, refund policy, tick-box)
- [x] Per-event refund policy (organiser tickets step + event page display)
- [x] Organiser terms acceptance before first publish (events & opportunities)
- [x] Business opportunity disclaimers (browse + detail + enquiry form)
- [x] Accessibility statement
- [x] Review report workflow (event/organiser pages + organiser dashboard + Command Centre moderation)
- [x] RoPA (`docs/RoPA.md`)
- [x] GDPR SAR procedure (`docs/GDPR-SAR-PROCEDURE.md`)
- [x] Data breach response (`docs/DATA-BREACH-RESPONSE.md`)
- [x] HMRC platform operator guide (`docs/HMRC-PLATFORM-OPERATORS.md`)
- [x] Opportunity moderation guide (`docs/OPPORTUNITY-MODERATION.md`)
- [x] Online Safety Act risk assessment (`docs/ONLINE-SAFETY-ACT.md`)

## Your action items

### Regulatory & legal

| Item | Action | Owner | Status |
|------|--------|-------|--------|
| ICO registration | Transferred from the-networker.co.uk — confirm Hub legal entity is covered | Director | ☐ Verify |
| Solicitor review | Have a UK tech/commercial lawyer review `legal-policies.html` before scaling paid ticketing | Director | ☐ |
| DPAs | Sign data processing agreements with Supabase, Stripe, Resend, and Vercel; file copies | Ops | ☐ |
| RoPA | Maintain `docs/RoPA.md` when features or subprocessors change | DPO contact | ☑ Created |
| Breach runbook | Follow `docs/DATA-BREACH-RESPONSE.md`; assign incident lead names | DPO contact | ☑ Created — assign names |
| GDPR requests | Follow `docs/GDPR-SAR-PROCEDURE.md`; owner for hello@the-networker.co.uk | Support | ☑ Procedure — assign owner |
| HMRC platform reporting | Follow `docs/HMRC-PLATFORM-OPERATORS.md`; accountant sign-off | Finance | ☐ |

### Operations

| Item | Action | Owner | Status |
|------|--------|-------|--------|
| Email authentication | Configure SPF, DKIM, DMARC for production Resend domain (not `onboarding@resend.dev`) | Tech | ☐ |
| VAT & invoices | Confirm organiser guidance on VAT; ensure Stripe receipts meet your requirements | Finance | ☐ |
| Insurance | Platform liability and cyber insurance | Director | ☐ |
| Legacy marketing opt-in | Accounts created before July 2026 may have marketing on by default — consider one-off re-permission email | Marketing | ☐ |

### Product & trust

| Item | Action | Owner | Status |
|------|--------|-------|--------|
| Review reporting | Report on event/organiser pages + organiser dashboard; remove in Command Centre | Product | ☑ |
| Refund policy enforcement | Block publishing paid events without refund policy selected — verify in QA | QA | ☐ |
| Opportunity moderation | Follow `docs/OPPORTUNITY-MODERATION.md` — pre-publish review enforced in code | Ops | ☑ Enforced |
| OSA annual review | Follow `docs/ONLINE-SAFETY-ACT.md` checklist; solicitor scope review | Director | ☐ |
| Report listing on opportunities | `listing-report.js` on opportunity detail pages | Product | ☑ |
| Opportunity disclaimer solicitor review | One-off UK lawyer review of browse/detail/enquiry disclaimer wording before scaling listings | Director | ☐ |

## Related documents

| Document | Purpose |
|----------|---------|
| `docs/RoPA.md` | Record of Processing Activities (UK GDPR Art. 30) |
| `docs/GDPR-SAR-PROCEDURE.md` | Subject access and rights requests |
| `docs/DATA-BREACH-RESPONSE.md` | 72-hour ICO breach procedure |
| `docs/HMRC-PLATFORM-OPERATORS.md` | Seller due diligence and annual reporting |
| `docs/OPPORTUNITY-MODERATION.md` | Franchise/investment listing review |
| `docs/ONLINE-SAFETY-ACT.md` | UGC risk assessment and reporting |

## Subprocessors (current)

| Provider | Purpose | DPA |
|----------|---------|-----|
| Supabase | Database, auth, storage | ☐ Signed |
| Stripe | Payments | ☐ Signed |
| Resend | Email | ☐ Signed |
| Vercel | Hosting, analytics | ☐ Signed |

---

*This document is operational guidance, not legal advice.*
