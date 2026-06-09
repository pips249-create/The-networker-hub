# Compliance runbook — The Networker Hub

Internal checklist for items that cannot be fully automated in code. Review quarterly.

**Last updated:** 9 June 2026

## Implemented in the platform

- [x] Legal policies page (`legal-policies.html`)
- [x] Cookie consent banner with analytics gating (PECR)
- [x] Terms & Privacy checkbox at registration
- [x] Pre-checkout acknowledgement (organiser, price, refund policy, tick-box)
- [x] Per-event refund policy (organiser tickets step + event page display)
- [x] Organiser terms acceptance before first publish (events & opportunities)
- [x] Business opportunity disclaimers (browse + detail + enquiry form)
- [x] Accessibility statement

## Your action items

### Regulatory & legal

| Item | Action | Owner | Status |
|------|--------|-------|--------|
| ICO registration | Pay the data protection fee at [ico.org.uk](https://ico.org.uk) if required for your organisation | Director | ☐ |
| Solicitor review | Have a UK tech/commercial lawyer review `legal-policies.html` before scaling paid ticketing | Director | ☐ |
| DPAs | Sign data processing agreements with Supabase, Stripe, Resend, and Vercel; file copies | Ops | ☐ |
| RoPA | Maintain a Record of Processing Activities (spreadsheet or doc) | DPO contact | ☐ |
| Breach runbook | Document 72-hour ICO notification procedure; assign incident lead | DPO contact | ☐ |

### Operations

| Item | Action | Owner | Status |
|------|--------|-------|--------|
| GDPR requests | Assign `hello@the-networker.co.uk` owner; respond within 30 days | Support | ☐ |
| Email authentication | Configure SPF, DKIM, DMARC for production Resend domain (not `onboarding@resend.dev`) | Tech | ☐ |
| VAT & invoices | Confirm organiser guidance on VAT; ensure Stripe receipts meet your requirements | Finance | ☐ |
| Insurance | Platform liability and cyber insurance | Director | ☐ |

### Product & trust

| Item | Action | Owner | Status |
|------|--------|-------|--------|
| Review reporting | Add/report workflow for fake reviews (CMA / DMCC Act 2024) | Product | ☐ |
| Refund policy enforcement | Block publishing paid events without refund policy selected (already on tickets step — verify in QA) | QA | ☐ |
| Opportunity moderation | Review process for misleading franchise/investment listings | Ops | ☐ |

## GDPR request procedure (draft)

1. Email received at `hello@the-networker.co.uk` with subject containing "Data request"
2. Verify requester identity (account email match or reasonable proof)
3. Log request in internal register with date received
4. Export/delete within **30 days** via Supabase admin tools
5. Confirm completion to requester in writing
6. If breach suspected, follow breach runbook (ICO within 72 hours where required)

## Breach response (draft)

1. **Contain** — revoke keys, limit access, preserve logs
2. **Assess** — within 24 hours, document what data, how many people, likely harm
3. **Notify ICO** — within 72 hours if risk to rights and freedoms
4. **Notify individuals** — without undue delay if high risk
5. **Record** — document all breaches in internal register

## Subprocessors (current)

| Provider | Purpose | DPA |
|----------|---------|-----|
| Supabase | Database, auth, storage | ☐ Signed |
| Stripe | Payments | ☐ Signed |
| Resend | Email | ☐ Signed |
| Vercel | Hosting, analytics | ☐ Signed |

---

*This document is operational guidance, not legal advice.*
