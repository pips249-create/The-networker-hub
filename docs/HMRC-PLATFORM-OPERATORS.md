# HMRC platform operator obligations — action guide

**Entity:** The Networker Group Ltd  
**Relevant rules:** Platform Operators (Due Diligence and Reporting) Regulations 2023  
**Last updated:** 28 August 2026

*Operational guidance. Confirm thresholds and reporting with your accountant or tax adviser — not legal advice.*

---

## 1. Why this applies

The Networker UK:

- Connects **sellers** (event organisers) with **buyers** (attendees)
- Processes **ticket payments** via Stripe (including Stripe Connect destination charges)
- May **facilitate** income to organisers

That can make The Networker Group Ltd a **platform operator** for HMRC purposes, with duties to collect seller identity/tax information and **report seller income** to HMRC annually when thresholds are met.

---

## 2. What you likely need to do

### Step A — Confirm platform operator status

Ask your accountant:

- Are we a “platform operator” under the 2023 Regulations for ticket sales?
- Does the **booking fee** (our revenue) vs **ticket price** (organiser revenue) affect reporting?
- Do **Stripe Connect** onboarding fields satisfy due diligence, or must we collect more?

### Step B — Due diligence on organisers (sellers)

Before organisers receive payouts (or at Connect onboarding), ensure you have:

| Data | Source today | Gap? |
|------|--------------|------|
| Legal name / trading name | Stripe Connect + organiser profile | Verify complete |
| Address | Stripe Connect | Verify UK organisers |
| Tax identifier (UTR / VAT number where applicable) | Stripe may collect | Confirm stored & accessible for reporting |
| Date of birth (individuals) | Stripe Connect | Stripe-dependent |
| Bank account | Stripe Connect | ✓ |

**Action:** Export a sample Connect account from Stripe Dashboard and map fields to HMRC reporting requirements with your accountant.

### Step C — Annual reporting to HMRC

If an organiser exceeds reporting thresholds in a calendar year (consult current HMRC guidance for exact figures and rules):

- Report seller identity and **consideration** (gross ticket revenue facilitated) to HMRC
- Deadline is typically **31 January** following the reportable year

**Action:** Build an internal **seller report** (CSV) from Supabase + Stripe:

```bash
npm run export:hmrc-sellers
npm run export:hmrc-sellers -- --year 2025
```

Writes `ops/hmrc-seller-report-YYYY.csv` (gitignored) with organiser identity, Stripe Connect account ID, paid registration counts, and gross ticket revenue per calendar year. Map Stripe Connect KYC fields in the Dashboard export and confirm reporting thresholds with your accountant before filing.

### Step D — Privacy and terms

- Tell organisers in **Organiser terms** that income may be reported to HMRC where legally required
- Update privacy policy subprocessors/sharing section if not already covering statutory tax reporting

### Step E — VAT (separate but related)

You are VAT-registered. With your accountant confirm:

- VAT on **booking fees** (your supply)
- Display of VAT on checkout where required
- Organiser responsibility for VAT on ticket prices

---

## 3. What Stripe does vs what you do

| Task | Stripe | The Networker UK |
|------|--------|-------------------|
| KYC on Connect accounts | Collects identity documents | Ensure onboarding completed before payouts |
| Payment processing | ✓ | Webhook + registration records |
| HMRC DAC7/OECD reporting (if applicable) | May report some data | **You** remain responsible as UK platform operator |
| Seller statements | Stripe Express dashboard | Provide organiser revenue view in dashboard |

Do **not** assume Stripe’s reporting replaces yours — verify with adviser.

---

## 4. Practical checklist

| # | Action | Owner | Status |
|---|--------|-------|--------|
| 1 | Accountant call: confirm platform operator status | Finance | ☐ |
| 2 | Map Stripe Connect fields → HMRC due diligence | Ops + Tech | ☐ |
| 3 | Add HMRC reporting clause to organiser terms (if advised) | Director | ☑ In organiser terms §2 (Jul 2026) |
| 4 | Build annual seller income export (Supabase + Stripe) | Tech | ☑ `npm run export:hmrc-sellers` (Aug 2026) |
| 5 | Calendar reminder: review reportable sellers each January | Finance | ☐ |
| 6 | File first report if thresholds met in 2026 | Finance | ☐ |

---

## 5. References

- [HMRC: Digital platforms reporting rules](https://www.gov.uk/guidance/digital-platforms-reporting-rules-for-sellers)
- Internal: `docs/RoPA.md` (processing activity C)
- Stripe Connect onboarding: organiser dashboard → Revenue → Connect Stripe
