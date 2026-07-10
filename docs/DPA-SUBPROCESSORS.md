# Subprocessor DPAs — execution guide

**Entity:** The Networker Group Ltd (Company No. 15252227)  
**Registered address:** Magpas HQ, Barnwell Road, Alconbury Weald, Huntingdon PE28 4YF  
**Owner:** Catherine Hancher  
**Last updated:** 10 July 2026

*Operational guide. Not legal advice. Track completion in `docs/DPA-REGISTER.md`.*

---

## Before you start (5 minutes)

1. Create a folder **outside this repo**:  
   `Company records / Data protection / DPAs / 2026 / The Networker Hub`
2. Open `docs/DPA-REGISTER.md` — you will note dates and file names there after each step.
3. Log in as the **organisation owner** for each account (not a team member with limited access).
4. Run `npm run check:dpas` when done to confirm the register is complete.

**Do not commit signed PDFs or PandaDoc exports to git.**

---

## Summary — how each DPA is formed

| Provider | How it becomes binding | Your action |
|----------|------------------------|-------------|
| **Stripe** | DPA is part of the [Stripe Services Agreement](https://stripe.com/gb/legal/ssa) — active when you use Stripe | Download current DPA PDF + note SSA acceptance date |
| **Vercel** | DPA deemed signed when you accept the [Vercel Terms](https://vercel.com/legal/terms) | Download DPA PDF + note account / deploy date |
| **Resend** | DPA executed when you accept [Resend Terms](https://resend.com/legal/terms-of-service) | Download executed DPA from dashboard |
| **Supabase** | **Requires explicit PandaDoc signature** | Request + sign via organisation dashboard |

---

## 1. Stripe (~10 minutes)

**Counterparty (UK):** Stripe Payments Europe, Limited / Stripe Payments UK Ltd (per [regional terms](https://stripe.com/gb/legal/ssa))

### Steps

1. Log in to [Stripe Dashboard](https://dashboard.stripe.com) (production account for The Networker Hub).
2. Confirm the legal entity on the account is **The Networker Group Ltd** (Settings → Business settings → Business details).
3. Download the current DPA: [stripe.com/gb/legal/dpa](https://stripe.com/gb/legal/dpa) → **Click here to download** (PDF).
4. Optional: Settings → **Legal** — review Services Agreement acceptance (if shown).
5. Save as: `2026-07-10_stripe-dpa-v2025-11-18.pdf` (use actual download date / version from PDF footer).
6. In `docs/DPA-REGISTER.md`, record:
   - **Effective date** = date you first accepted Stripe SSA (or earliest Hub payment processing date)
   - **Mechanism** = “Incorporated in Stripe Services Agreement”

**FAQ:** [stripe.com/legal/dpa/faqs](https://stripe.com/legal/dpa/faqs) — UK IDTA included in Data Transfers Addendum.

---

## 2. Vercel (~10 minutes)

**Counterparty:** Vercel Inc.

### Steps

1. Log in to [Vercel Dashboard](https://vercel.com) (team/account for The Networker Hub).
2. Download DPA: [vercel.com/legal/dpa](https://vercel.com/legal/dpa) — use browser Print → Save as PDF, or any official download link on that page.
3. Note your **Vercel account creation date** or date of first production deploy — the DPA is deemed signed as of the [Effective Date of the Agreement](https://vercel.com/legal/terms).
4. Optional: email **privacy@vercel.com** to subscribe to sub-processor change notices (recommended in DPA).
5. Save as: `2026-07-10_vercel-dpa.pdf`
6. Update `docs/DPA-REGISTER.md`.

---

## 3. Resend (~5 minutes)

**Counterparty:** Plus Five Five, Inc. (Resend)

### Steps

1. Log in to [Resend](https://resend.com).
2. Go to **Settings → Documents**.
3. Download **DPA** — pre-signed by Resend; considered fully executed when you signed up (no counter-signature).
4. While there, optionally download SOC 2 / penetration test letter for your records.
5. Save as: `2026-07-10_resend-dpa-executed.pdf`
6. Update `docs/DPA-REGISTER.md` with account signup date as effective date.

**Docs:** [resend.com/docs/knowledge-base/downloading-documents](https://resend.com/docs/knowledge-base/downloading-documents)

---

## 4. Supabase (~15 minutes + up to 24h wait)

**Counterparty:** Supabase, Inc.

This is the **only provider that needs an explicit signature**.

### Steps

1. Log in to [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your **Organisation** (not just the project).
3. Open **Legal documents**: [supabase.com/dashboard/org/_/documents](https://supabase.com/dashboard/org/_/documents)  
   (replace `_` with your organisation slug if the link redirects).
4. Request the **executable DPA** — enter **catherine@thenetworkerhub.com** (or your director email).
5. Within ~24 hours, complete the **PandaDoc** envelope:
   - Signatory: **Catherine Hancher**, Director, The Networker Group Ltd
   - Complete Part 1 processing details (Hub database, auth, storage; UK data subjects; contact hello@thenetworkerhub.com)
6. When PandaDoc confirms execution, download the signed PDF from PandaDoc or the dashboard.
7. Save as: `2026-07-XX_supabase-dpa-signed.pdf`
8. Update `docs/DPA-REGISTER.md`.

**Preview (unsigned):** [supabase.com/legal/dpa](https://supabase.com/legal/dpa) — not sufficient alone; you need the PandaDoc version.

---

## 5. After all four — internal filing

| Task | Done |
|------|:----:|
| Four PDFs saved in company folder (not git) | ☐ |
| `docs/DPA-REGISTER.md` completed | ☐ |
| `docs/RoPA.md` subprocessor table marked filed | ☐ |
| `npm run check:dpas` passes | ☐ |
| `docs/COMPLIANCE-RUNBOOK.md` DPAs row updated | ☐ |

---

## Privacy policy

`legal-policies.html` already lists Stripe, Supabase, Resend, and Vercel as processors. No change required unless you add new tools.

---

## Related

- `docs/DPA-REGISTER.md` — live completion tracker
- `docs/RoPA.md` — Art. 30 record
- `docs/COMPLIANCE-RUNBOOK.md` — launch checklist
- `npm run check:dpas` — validates register
