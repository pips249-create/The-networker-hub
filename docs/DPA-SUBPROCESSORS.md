# Subprocessor DPAs — execution guide

**Entity:** The Networker Group Ltd (Company No. 15252227)  
**Registered address:** Magpas HQ, Barnwell Road, Alconbury Weald, Huntingdon PE28 4YF  
**Owner:** Catherine Hancher  
**Last updated:** 10 July 2026

*Operational guide. Not legal advice. Track completion in `docs/DPA-REGISTER.md`.*

---

## Before you start (5 minutes)

1. Create a folder **outside this repo**:  
   `Company records / Data protection / DPAs / 2026 / The Networker UK`
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

*OpenAI is **not** in use — Hubert runs on in-house FAQ only. Optional steps if you enable AI later: `docs/DPA-SUBPROCESSORS.md` §5.*

---

## 1. Stripe (~10 minutes)

**Counterparty (UK):** Stripe Payments Europe, Limited / Stripe Payments UK Ltd (per [regional terms](https://stripe.com/gb/legal/ssa))

### Steps

1. Log in to [Stripe Dashboard](https://dashboard.stripe.com) (production account for The Networker UK).
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

Vercel does **not** provide a “Download PDF” button on [vercel.com/legal/dpa](https://vercel.com/legal/dpa) (unlike Stripe or Resend). The DPA is **deemed signed** when you accepted the [Vercel Terms](https://vercel.com/legal/terms). For your records, save a PDF copy using one of the methods below.

**Current version on site:** Last updated **17 March 2026** · Effective **31 March 2026**

### Option A — Save as PDF in your browser (recommended)

**Safari (Mac)**

1. Open [vercel.com/legal/dpa](https://vercel.com/legal/dpa)
2. Wait for the page to load fully (scroll to the bottom once)
3. **File → Export as PDF…** (or **File → Print** → **PDF → Save as PDF**)
4. Save as: `2026-07-10_vercel-dpa-20260317.pdf`

**Chrome (Mac)**

1. Open [vercel.com/legal/dpa](https://vercel.com/legal/dpa)
2. **File → Print** (or ⌘P)
3. Destination: **Save as PDF**
4. Turn **Headers and footers** on so the URL and date appear on the printout
5. Save with the filename above

This snapshot is sufficient for your DPA register — you are archiving the version in force when you filed it.

### Option B — Hosted PDF (older version — use only if print fails)

Vercel hosts an older customer DPA PDF (March 2023, may not match the live page):

[assets.vercel.com/.../Vercel_Customer_DPA__032923.pdf](https://assets.vercel.com/image/upload/v1682696728/front/legal/terms/Vercel_Customer_DPA__032923.pdf)

If you use this, add a note in `docs/DPA-REGISTER.md` that the **binding version** is the current web DPA (March 2026) incorporated by your Terms acceptance, and the PDF is a reference copy only.

### Finish up

1. Note your **Vercel account creation date** or first production deploy date as the effective date (or 31 March 2026 if you signed up after the current DPA effective date).
2. Optional: email **privacy@vercel.com** to subscribe to sub-processor change notices (recommended in the DPA).
3. Update `docs/DPA-REGISTER.md`.

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
4. Request the **executable DPA** — enter **catherine@thenetworkeruk.com** (or your director email).
5. Within ~24 hours, complete the **PandaDoc** envelope:
   - Signatory: **Catherine Hancher**, Director, The Networker Group Ltd
   - Complete Part 1 processing details (Hub database, auth, storage; UK data subjects; contact hello@thenetworkeruk.com)
6. When PandaDoc confirms execution, download the signed PDF from PandaDoc or the dashboard.
7. Save as: `2026-07-XX_supabase-dpa-signed.pdf`
8. Update `docs/DPA-REGISTER.md`.

**Preview (unsigned):** [supabase.com/legal/dpa](https://supabase.com/legal/dpa) — not sufficient alone; you need the PandaDoc version.

---

## 5. OpenAI (optional — not in use)

**Status:** **Not required.** The Networker UK runs **Hubert** on built-in FAQ answers and live Supabase event/opportunity lookups. There is **no** `OPENAI_API_KEY` in production — visitor chat is not sent to OpenAI or ChatGPT.

Keep this section for reference **only if** you later decide to enable third-party AI for Hubert.

**Counterparty (UK / EEA):** **OpenAI Ireland Ltd** (select this in the form — not OpenAI OpCo LLC)  
**Would apply if:** `OPENAI_API_KEY` is added to Vercel for `/api/contact-chat`

### Before you start

| Check | Why |
|-------|-----|
| **Business account** at [platform.openai.com](https://platform.openai.com) | Personal ChatGPT accounts cannot execute the DPA |
| Legal entity = **The Networker Group Ltd** | Must match ICO register and other DPAs |
| Billing on company card / invoice | Keeps account in business mode |
| `OPENAI_API_KEY` in **Vercel Production** (if Hubert should use AI) | Without a key, Hubert falls back to rule-based replies only |

### Step 1 — Organisation ID

1. Sign in at [platform.openai.com](https://platform.openai.com) as the organisation owner.
2. Go to **Settings → Organization → General**  
   Direct: [platform.openai.com/settings/organization/general](https://platform.openai.com/settings/organization/general)
3. Copy the **Organization ID** (starts with `org-…`). You need this for the DPA form.

### Step 2 — Execute the DPA

1. Open [openai.com/policies/data-processing-addendum](https://openai.com/policies/data-processing-addendum) (effective 1 January 2026).
2. Scroll to the bottom and click **Execute Data Processing Agreement**.
3. Complete the online form (Ironclad):

   | Field | Value |
   |-------|--------|
   | Legal company name | The Networker Group Ltd |
   | Company number | 15252227 |
   | Registered address | Magpas HQ, Barnwell Road, Alconbury Weald, Huntingdon, Cambridgeshire PE28 4YF |
   | Organization ID | `org-…` from Step 1 |
   | Based in EEA or Switzerland? | **Yes** |
   | OpenAI contracting entity | **OpenAI Ireland Ltd** |
   | Signatory name | Catherine Hancher |
   | Signatory title | Director |
   | Signatory email | catherine@thenetworkeruk.com (or your director email) |

4. Submit — you receive an email to **review and e-sign** the DPA.
5. When countersigned, download the **PDF** from the email link or Ironclad portal.
6. Save as: `2026-07-XX_openai-dpa-signed.pdf` in your company DPA folder (not git).
7. Update `docs/DPA-REGISTER.md` — set Status to ☑ and add the effective date.

**Support:** privacy@openai.com (data protection enquiries)

### Step 3 — API key in Vercel (if not already)

1. [platform.openai.com/api-keys](https://platform.openai.com/api-keys) → **Create new secret key** (name e.g. `The Networker UK production`).
2. **Vercel → Project → Settings → Environment Variables → Production:**
   - `OPENAI_API_KEY` = `sk-…`
   - Optional: `OPENAI_CHAT_MODEL` = `gpt-4o-mini` (default in code if unset)
3. Redeploy the project.

### Step 4 — Optional hardening (recommended)

| Control | Action |
|---------|--------|
| **No training on API data** | Default for API — confirm in [OpenAI API data usage policies](https://openai.com/policies/api-data-usage-policies) |
| **Minimise personal data in chat** | Already in RoPA + privacy policy — users should not paste unnecessary PII into Hubert |
| **Usage limits** | Set monthly budget cap in OpenAI **Settings → Billing → Limits** |
| **Zero retention (enterprise)** | Available on some plans via OpenAI support — only needed if solicitor advises stricter retention |

### Finish up

1. Update `docs/DPA-REGISTER.md` (OpenAI row).
2. Update `docs/RoPA.md` subprocessor table — OpenAI DPA ☑.
3. Run `npm run check:dpas` (expects 5 / 5 when Hubert uses OpenAI).

---

## 6. After all four — internal filing

| Task | Done |
|------|:----:|
| Four PDFs saved in company folder (not git) | ☐ |
| `docs/DPA-REGISTER.md` completed | ☐ |
| `docs/RoPA.md` subprocessor table marked filed | ☐ |
| `npm run check:dpas` passes | ☐ |
| `docs/COMPLIANCE-RUNBOOK.md` DPAs row updated | ☐ |

---

## Privacy policy

`legal-policies.html` lists Stripe, Supabase, Resend, Vercel, and describes Hubert as on-site help (no third-party AI). Update only if you add new tools or enable OpenAI.

---

## Related

- `docs/DPA-REGISTER.md` — live completion tracker
- `docs/RoPA.md` — Art. 30 record
- `docs/COMPLIANCE-RUNBOOK.md` — launch checklist
- `npm run check:dpas` — validates register
