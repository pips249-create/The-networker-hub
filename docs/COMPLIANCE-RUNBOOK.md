# Compliance runbook — The Networker UK

Internal checklist for items that cannot be fully automated in code. Review quarterly.

**Last updated:** 28 August 2026  
**Readiness check:** `npm run check:business-ops` (target ~75% before marketing push)

## Implemented in the platform

- [x] Legal policies page (`legal-policies.html`) — incl. copyright & content (July 2026)
- [x] Cookie consent banner with analytics gating (PECR)
- [x] Terms & Privacy checkbox at registration (client + server validation)
- [x] Hubert in-chat automated-assistant disclosure + updated privacy policy wording
- [x] OpenAI double-gate (`OPENAI_API_KEY` + `HUBERT_OPENAI_ENABLED=true`) + PII redaction if ever enabled
- [x] Optional admin IP allowlist (`ADMIN_IP_ALLOWLIST` env, comma-separated)
- [x] Marketing email opt-in at registration (unchecked by default) + account settings
- [x] Pre-checkout acknowledgement (organiser, price, refund policy, tick-box)
- [x] Per-event refund policy (organiser tickets step + event page display)
- [x] **Paid checkout blocked without refund policy** (server-side, July 2026)
- [x] **Earnings attestation on opportunity listings** when financial figures entered (July 2026)
- [x] Organiser terms acceptance before first publish (events & opportunities)
- [x] Business opportunity disclaimers (browse + detail + enquiry form)
- [x] Accessibility statement
- [x] Review report workflow (event/organiser pages + organiser dashboard + Command Centre moderation)
- [x] RoPA (`docs/RoPA.md`)
- [x] GDPR SAR procedure (`docs/GDPR-SAR-PROCEDURE.md`) — named owners
- [x] Self-service data download in account settings (`/api/auth/data-export`)
- [x] Complaints procedure (`docs/COMPLAINTS-PROCEDURE.md`) + Supabase register in Command Centre
- [x] Data breach response (`docs/DATA-BREACH-RESPONSE.md`) — named leads
- [x] HMRC platform operator guide (`docs/HMRC-PLATFORM-OPERATORS.md`)
- [x] Opportunity moderation guide (`docs/OPPORTUNITY-MODERATION.md`) — named owner
- [x] Online Safety Act risk assessment (`docs/ONLINE-SAFETY-ACT.md`)
- [x] Support inbox runbook (`docs/SUPPORT-INBOX-RUNBOOK.md`)
- [x] Email DNS guide (`docs/EMAIL-DNS-SETUP.md`)
- [x] ICO verification guide (`docs/ICO-REGISTRATION.md`)
- [x] DPA subprocessor guide (`docs/DPA-SUBPROCESSORS.md`)
- [x] Organiser VAT guidance (`docs/VAT-ORGANISER-GUIDANCE.md`)
- [x] Refund policy compliance tests (`scripts/test-refund-policy-compliance.js`)
- [x] Legacy marketing opt-in audit script (`scripts/audit-legacy-marketing-opt-in.js`)

## Your action items

### Regulatory & legal

| Item | Action | Owner | Status |
|------|--------|-------|--------|
| ICO registration | Follow `docs/ICO-REGISTRATION.md` — **ZB694959** · expires 29 May 2027 | Catherine | ☑ Verified 6 Aug 2026 |
| Solicitor review | UK lawyer review `legal-policies.html` before scaling paid ticketing | Catherine | ☑ Done (confirmed 6 Aug 2026) |
| DPAs | Follow `docs/DPA-SUBPROCESSORS.md`; track in `docs/DPA-REGISTER.md`; run `npm run check:dpas` | Catherine | ☑ Filed 10 Jul 2026 |
| RoPA | Maintain `docs/RoPA.md` when features or subprocessors change | Catherine | ☑ Updated 28 Aug 2026 (Brevo retired) |
| Backups / monitoring | `docs/OPS-RELIABILITY.md` — **Free tier today**; upgrade Supabase Pro before scale; UptimeRobot on `/api/health`; run `npm run check:ops` | Catherine | ☑ Health probe live · ☐ UptimeRobot · ☐ Supabase Pro upgrade |
| Breach runbook | Named leads in `docs/DATA-BREACH-RESPONSE.md` | Catherine | ☑ |
| GDPR requests | `docs/GDPR-SAR-PROCEDURE.md` — hello@ monitored | Catherine / Rosie | ☑ Procedure + owners |
| Admin access hardening | Set `ADMIN_IP_ALLOWLIST` in Vercel for Command Centre; enable Supabase Auth MFA on admin accounts when ready | Catherine | ☐ Optional IP allowlist · ☐ MFA |
| Complaints | `docs/COMPLAINTS-PROCEDURE.md` — log in Command Centre → Support → Complaints | Catherine Hancher | ☑ hi@thenetworkeruk.com monitored |
| HMRC platform reporting | `docs/HMRC-PLATFORM-OPERATORS.md`; run `npm run export:hmrc-sellers`; accountant sign-off | Finance | ☑ Export script · ☐ Accountant confirmation |

### Operations

| Item | Action | Owner | Status |
|------|--------|-------|--------|
| Support inbox | `docs/SUPPORT-INBOX-RUNBOOK.md` — monitor hello@ weekdays | Catherine | ☑ Runbook |
| Email authentication | `docs/EMAIL-DNS-SETUP.md` — SPF, DKIM, DMARC on Resend domain | Tech | ☑ Dig verified 6 Aug |
| Company VAT | The Networker Group Ltd VAT No. 454 4092 94 | Finance | ☑ Registered |
| Organiser VAT treatment | Accountant sign-off on booking-fee / ticket VAT options (`docs/VAT-ORGANISER-GUIDANCE.md` §4) | Finance | ☐ |
| Insurance | Optional: platform liability + cyber (broker quotes) — park if deferred | Catherine | ☐ Optional |
| Legacy marketing opt-in | Audit CSV available; **re-permission email not sending** (decision 25 Aug 2026). Keep register checkbox unchecked; see `docs/MARKETING-REPERMISSION.md` | Marketing | ☑ Deferred — no send |

### Product & trust

| Item | Action | Owner | Status |
|------|--------|-------|--------|
| Review reporting | Report on event/organiser pages + organiser dashboard; remove in Command Centre | Product | ☑ |
| Refund policy enforcement | Server + tests — `npm run test:refund-policy` | Product | ☑ |
| Opportunity moderation | Pre-publish review + owner assigned | Catherine | ☑ |
| OSA annual review | `docs/ONLINE-SAFETY-ACT.md` checklist; solicitor scope review | Catherine | ☑ Proportionate measures · ☐ Solicitor scope review |
| Report listing on opportunities | `listing-report.js` on opportunity detail pages | Product | ☑ |
| Opportunity disclaimer solicitor review | Lawyer review before scaling listings marketing | Catherine | ☐ |

## Subprocessors (current)

| Provider | Purpose | DPA |
|----------|---------|-----|
| Supabase | Database, auth, storage | ☑ Filed 10 Jul 2026 — PandaDoc |
| Stripe | Payments | ☑ DPA PDF filed (incorporated in SSA) |
| Resend | Email | ☑ DPA from Settings → Documents |
| Vercel | Hosting, analytics | ☑ DPA PDF filed (incorporated in Terms) |

**Retired:** Brevo — no longer used (Aug 2026). Delete remaining lists in Brevo account if it still exists.

**Hubert:** FAQ + live Supabase lookups only — no OpenAI subprocessor.

## Related documents

| Document | Purpose |
|----------|---------|
| `docs/RoPA.md` | Record of Processing Activities (UK GDPR Art. 30) |
| `docs/ORGANISER-DATA-SHARING-TEMPLATE.md` | Optional enterprise organiser data-sharing schedule |
| `docs/GDPR-SAR-PROCEDURE.md` | Subject access and rights requests |
| `docs/COMPLAINTS-PROCEDURE.md` | Customer complaints — register in Command Centre |
| `docs/DATA-BREACH-RESPONSE.md` | 72-hour ICO breach procedure |
| `docs/HMRC-PLATFORM-OPERATORS.md` | Seller due diligence and annual reporting |
| `docs/OPPORTUNITY-MODERATION.md` | Franchise/investment listing review |
| `docs/ONLINE-SAFETY-ACT.md` | UGC risk assessment and reporting |
| `docs/SUPPORT-INBOX-RUNBOOK.md` | hello@ triage and SLAs |
| `docs/EMAIL-DNS-SETUP.md` | SPF / DKIM / DMARC for Resend |
| `docs/ICO-REGISTRATION.md` | ICO fee verification |
| `docs/OPS-RELIABILITY.md` | Backups, restore drill, uptime monitoring |
| `docs/DPA-SUBPROCESSORS.md` | Processor agreements |
| `docs/MARKETING-REPERMISSION.md` | Re-permission for pre-ticked marketing opt-in |
| `docs/VAT-ORGANISER-GUIDANCE.md` | Organiser VAT summary |

---

*This document is operational guidance, not legal advice.*
