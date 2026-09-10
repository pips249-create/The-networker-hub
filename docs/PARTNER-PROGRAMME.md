# Partner Programme — The Networker UK

**Status:** Phase 2 built (Stripe → ledger, clawbacks, hold cron, manual attribute, referral email)  
**Inbox:** `partnerships@thenetworkeruk.com` (forwards to Catherine)  
**Commercial cover:** Rosie McGilvray  
**Last updated:** 10 September 2026

*Operational / commercial guide. Not legal or tax advice — confirm VAT and invoicing with the accountant before first payout.*

---

## 1. What this programme is

Invite-only referral partners who introduce paying customers for:

1. **Business opportunity** products (directory listing, Featured Opportunity Boost)
2. **Advertising & sponsorship** packages (all paid sponsor / placement slots on `/advertising`)

Public enquire page: [`/partners`](https://www.thenetworkeruk.com/partners) (applications reviewed — not self-serve signup).  
Not in scope (for now): event ticket booking fees or organiser acquisition bounties.

---

## 2. Locked commercial rules

| Rule | Decision |
|------|----------|
| Commission | **20% of net sale (ex-VAT)** |
| Cookie window | **30 days** |
| Tracking | Unique **link** + **code** + manual **“introduced by”** for sales-led deals |
| Recurring | **First 3 successful paid months** only |
| Prepaid (3 / 6 / 12 mo) | **20% of that invoice, once** |
| One-offs (e.g. £55 boost) | **20% once** |
| Earns when | Customer **payment succeeds** (and listing approved where required) |
| Hold | **14 days** after payment (refund / chargeback buffer) |
| Payout | Monthly, **1st working day**, minimum **£25** (carry forward below) |
| Clawback | Refunds and chargebacks → negative commission line |
| Attribution | Last valid cookie/code wins; manual intro may override if confirmed by staff |

### Quick examples

| Sale | Partner earns |
|------|----------------|
| Opportunity listing £25/mo × 3+ months | £5 × 3 = **£15** total |
| Featured Opportunity Boost £55 | **£11** once |
| Sponsor £100/mo for 6 months | £20 × 3 = **£60** (months 4–6 no commission) |
| Prepaid 12-month package £1,020 ex-VAT | **£204** once (20% of invoice) |

---

## 3. Inbox

| Address | Role |
|---------|------|
| `partnerships@thenetworkeruk.com` | Public programme address — applications, partner queries, statements |
| `rosie@thenetworkeruk.com` | Warm commercial / large sponsor closes |
| `hi@thenetworkeruk.com` | General support — forward partner topics to partnerships@ |

**Monitoring:** Catherine (primary). Reply from partnerships@ when possible so the thread stays on the programme address.

---

## 4. Partner-facing one-pager (copy)

*Paste into a PDF or email when inviting a pilot partner.*

### The Networker UK Partner Programme

Earn **20%** when you introduce brands and opportunity providers who pay to list or advertise on The Networker UK — the UK hub for networking events and business opportunities.

**What counts**
- Business opportunity directory listings (£25/mo + VAT)
- Featured Opportunity Boost (£55 one-time)
- Advertising & sponsorship packages (see [thenetworkeruk.com/advertising](https://www.thenetworkeruk.com/advertising))

**How you earn**
- Share your unique link or code (30-day cookie)
- Or tell us you introduced someone — email **partnerships@thenetworkeruk.com**
- Commission is **20% of the ex-VAT** amount on the first **three** paid months (or 20% of a prepaid invoice once; one-offs once)
- Paid monthly after a 14-day hold · minimum payout £25

**What you get**
- Unique link + code
- Partner hub: earnings + logos, square/landscape/Story creatives (SVG + PNG), suggested copy, one-pager rate card PDF (`/partners/earnings?ref=CODE`)
- `/partners/kit` redirects to the hub
- Branded invite email from Command Centre
- Visibility of referrals and earnings on `/partners/earnings` (live ledger API next; monthly statement from Phase 4)
- A named inbox: partnerships@thenetworkeruk.com

**Important**
- Commission only after the customer **pays** (opportunity listings must also pass review)
- No discounts off our rate card unless we agree in writing
- Listings and ads remain subject to our moderation and advertising policies
- You are an independent referrer — not an employee or agent with authority to bind The Networker Group Ltd

**Contact:** partnerships@thenetworkeruk.com

---

## 5. Sales kit

### Rate card (guide — always point to live `/advertising`)

| Product | Guide price (ex-VAT) | Partner cut (20%) |
|---------|----------------------|-------------------|
| Opportunity listing | £25 / month | £5 / mo × first 3 |
| Featured Opportunity Boost | £55 one-time | £11 once |
| City Partner | from £29 / city / month | 20% × first 3 (or 20% of prepaid) |
| County / Industry Partner | from £49 / month (launch) | same |
| Events Headline Sponsor | £2,000 / month | £400 × first 3 |
| Events Mini Sponsor | £600 / slot / month | £120 × first 3 |
| Organisers Headline | £1,000 / month | £200 × first 3 |
| Organisers Mini | £300 / slot / month | £60 × first 3 |
| Opportunities Headline | £2,000 / month | £400 × first 3 |
| Opportunities Mini | £600 / slot / month | £120 × first 3 |
| Featured event / organiser spotlights | £55 / £27.50 one-time | 20% once |

Prepaid terms (1 / 3 / 6 / 12 months) may include discounts — commission is **20% of the net invoice ex-VAT**, once.

**One-pager PDF** (email attachments): `/assets/guides/partner-rate-card.pdf` — regenerate with `npm run build:partner-kit` after editing rates.

### Creative assets

| Asset | Size | Formats |
|-------|------|---------|
| Opportunity / sponsor square | 1080×1080 | PNG + SVG |
| Opportunity landscape | 1200×628 | PNG + SVG |
| Opportunity / sponsor Story | 1080×1920 | PNG + SVG |
| Partner badges / lockup | various | PNG + SVG |

All live on `/partners/earnings` (media kit + earnings in one page). `/partners/kit` redirects there.

### Suggested outreach (short)

> Just a quick one — The Networker UK is where UK founders and networking organisers find events and business opportunities. If you (or a client) want a listing or a sponsorship placement, I can introduce you. Here’s my partner link: [LINK]

### Suggested email / LinkedIn

> I partner with The Networker UK — the UK hub for networking events, exhibitions and business opportunities. If you promote franchises, partnerships or B2B services and want to reach that audience through a directory listing or sponsorship, I’m happy to make an introduction. Message me and I’ll send the details.

### Do / don’t

| Do | Don’t |
|----|--------|
| Use official prices from `/advertising` | Promise exclusivity or inventory you haven’t checked |
| Send serious, relevant intros | Spam or bought email lists |
| Disclose you’re a partner if asked | Claim guaranteed ROI or fake audience numbers |
| CC partnerships@ on warm intros | Offer unauthorised discounts |
| Check opportunity copy is honest | Push listings that can’t pass moderation (`docs/OPPORTUNITY-MODERATION.md`) |

### Links (replace CODE when partner is created)

- Homepage (general intros): `https://www.thenetworkeruk.com/?ref=CODE`
- Advertising: `https://www.thenetworkeruk.com/advertising?ref=CODE`
- List an opportunity: `https://www.thenetworkeruk.com/opportunities/list?ref=CODE`
- Partner hub: `https://www.thenetworkeruk.com/partners/earnings?ref=CODE`
- Code fallback: tell the buyer to enter **CODE** at checkout / enquiry

Prefer the **homepage** link when the intro is open-ended; use advertising / list links when you already know the product. The 30-day cookie attributes whichever path they take next.

---

## 6. Monthly money process (until product ships)

1. Log every attributed paid sale in a ledger spreadsheet (one row per payment; never overwrite — clawbacks = new negative row).
2. Columns: date paid · partner · product · Stripe/invoice id · net ex-VAT · commission 20% · eligible_from (+14 days) · status (`hold` / `eligible` / `statemented` / `paid`) · statement month · bank ref.
3. On payout day: include only `eligible` rows not yet statemented; freeze as that month’s statement; email PDF/CSV from partnerships@; pay by bank transfer if ≥ £25.
4. Send accountant: statements + payout CSV + bank export.

**Partner visibility before the app exists:** reply to partnerships@ with a short status, or send a simple mid-month “progress” email (pending vs eligible) — do not treat that email as the payable statement.

---

## 7. Accountant checklist (ask before first payout)

- [ ] Confirm commission is coded as marketing / affiliate expense
- [ ] Confirm we commission on **ex-VAT** sales (recommended)
- [ ] Prefer **partner invoices** or **self-billing agreement**?
- [ ] If partner is VAT-registered: handle VAT on their commission invoice
- [ ] What supplier details to collect (name, address, UTR / company number, bank)
- [ ] Any threshold reporting we should track for HMRC

---

## 8. Build roadmap (product)

| Phase | Deliverable | Est. |
|-------|-------------|------|
| 0 | Mailbox + this doc + accountant sign-off | Mailbox + doc done · accountant pending |
| 1 | DB partners · codes · 30-day cookie · checkout + enquiry attribution · Command Centre **Referral partners** | **Built** — run migration `289_affiliate_partners.sql` |
| 2 | Stripe webhook → ledger · first-3 cap · clawbacks · manual attribute · hold cron · referral email | **Built** — cron `/api/cron/affiliate-commissions` daily 06:15 |
| 3 | Partner hub `/partners/earnings` (earnings + media kit) · optional weekly digest | Hub shell built · live ledger API next |
| 4 | Admin statements / payouts · monthly statement email | 2–3 days |

MVP = Phases 1–3 · Full ops = + Phase 4.

---

## 9. Pilot launch (ops)

1. Accountant ticks §7  
2. Invite **3–5** known partners (and triage `/partners` enquiries)
3. Issue code + link + this one-pager from partnerships@  
4. Track sales in ledger until Phase 1–2 ships  
5. First payout month: statement + bank transfer + accountant pack  
