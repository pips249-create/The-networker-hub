# VAT guidance for event organisers

**Platform:** The Networker Group Ltd (VAT No. 454 4092 94)  
**Last updated:** 10 July 2026

*Practical summary for organisers. Organisers must take their own tax advice.*

---

## 1. Two different supplies

| Supply | Who provides it | VAT |
|--------|-----------------|-----|
| **Ticket to attend an event** | Event organiser (seller) | Organiser’s responsibility — depends on whether they are VAT-registered and the nature of the event |
| **Membership dues (monthly / annual)** | Event organiser (seller) | Organiser’s responsibility — choose **VAT included** or **Add 20% VAT at checkout** on Memberships |
| **Booking fee on tickets (4.5% + 20p)** | The Networker Group Ltd (platform) | Charged by the Hub on event tickets |
| **Hub fee on memberships (3%)** | The Networker Group Ltd (platform) | **VAT inclusive** — shown as one line; do not add VAT again on this fee |

Attendees see ticket price + booking fee at checkout. The organiser receives the **full ticket price** they set (via Stripe Connect).

---

## 2. Organiser obligations

Organisers should:

1. **Know their VAT status** — register with HMRC if turnover exceeds the threshold (or voluntarily if beneficial).
2. **Choose VAT treatment on tickets** when publishing — the Hub asks whether ticket prices are **VAT included** or **VAT added at checkout**.
3. **Keep records** of ticket sales, refunds, and payouts (Stripe Dashboard + organiser exports).
4. **Issue invoices** if required for B2B sales — Stripe receipts may not replace a proper VAT invoice for all cases; confirm with accountant.
5. **Report income** — ticket revenue is the organiser’s income; platform may report to HMRC under platform operator rules (see `docs/HMRC-PLATFORM-OPERATORS.md`).

---

## 3. Platform (Hub) obligations

- VAT on **booking fees** and **opportunity listing fees** (£25/month + VAT) is charged by The Networker Group Ltd where applicable.
- Stripe Checkout line items should show fees clearly — verify with Finance before scaling paid ticketing.
- Organiser terms state organisers are responsible for their own tax and VAT on ticket revenue.

---

## 4. Finance sign-off checklist

| Item | Owner | Status |
|------|-------|--------|
| Booking fee VAT treatment confirmed with accountant | Finance | ☐ |
| Opportunity listing fee VAT on Stripe checkout verified | Finance | ☐ |
| Organiser ticket VAT options (included vs added) reviewed | Finance | ☐ |
| Sample Stripe receipt meets requirements | Finance | ☐ |

---

## 5. Where organisers see this

- Organiser terms → Payments and fees (`legal-policies.html#organisers`)
- Tickets step → VAT radio buttons when publishing paid events
- This document (internal / link from organiser help when expanded)

**Questions:** hello@thenetworkerhub.com
