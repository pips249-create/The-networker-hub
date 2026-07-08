# Record of Processing Activities (RoPA)

**Controller:** The Networker Group Ltd (Company No. 15252227)  
**ICO registration:** Transferred from the-networker.co.uk  
**Last updated:** 8 July 2026  
**Review cycle:** Quarterly (or when a new feature/subprocessor is added)

*Operational document supporting UK GDPR Article 30. Not legal advice.*

---

## 1. Controller details

| Field | Detail |
|-------|--------|
| Organisation | The Networker Group Ltd |
| Address | Magpas HQ, Barnwell Road, Alconbury Weald, Huntingdon, Cambridgeshire PE28 4YF |
| Contact | hello@the-networker.co.uk |
| DPO / privacy lead | Director (assign named contact internally) |

---

## 2. Processing activities

### A. Member accounts & authentication

| Item | Detail |
|------|--------|
| **Purpose** | Create and manage Hub accounts; sign-in; attendee/organiser mode |
| **Data subjects** | Registered members, organisers, admins |
| **Categories of data** | Name, email, password hash (Supabase Auth), hub preferences, organiser access timestamps |
| **Lawful basis** | Contract (Art. 6(1)(b)); Legitimate interests for security (Art. 6(1)(f)) |
| **Recipients** | Supabase (processor) |
| **Retention** | Life of account + up to 2 years after closure |
| **International transfers** | Supabase may process in US/EU — UK IDTA / adequacy as applicable |

### B. Event discovery, registration & ticketing

| Item | Detail |
|------|--------|
| **Purpose** | Browse events; register; purchase tickets; manage bookings |
| **Data subjects** | Attendees, guests named at checkout |
| **Categories of data** | Name, email, ticket quantity, guest names, payment status, Stripe session/PI references, accessibility requirements, application answers |
| **Lawful basis** | Contract (Art. 6(1)(b)); Legal obligation for financial records (Art. 6(1)(c)) |
| **Recipients** | Supabase, Stripe, event organisers (as separate controllers for event delivery), Resend (confirmations) |
| **Retention** | Registration records ~2 years after event; financial records 7 years |
| **Notes** | Card data processed by Stripe only — Hub does not store PANs |

### C. Organiser dashboard & payouts

| Item | Detail |
|------|--------|
| **Purpose** | List events; manage attendees; Stripe Connect payouts; team access |
| **Data subjects** | Organisers, organiser team members |
| **Categories of data** | Business/group profile, contact email, logos/images, Stripe Connect account IDs, payout records, team invite emails |
| **Lawful basis** | Contract (Art. 6(1)(b)); Legal obligation (tax/platform reporting) (Art. 6(1)(c)) |
| **Recipients** | Supabase, Stripe |
| **Retention** | Life of organiser relationship + 7 years for financial/payout records |

### D. Business opportunities & enquiries

| Item | Detail |
|------|--------|
| **Purpose** | Publish opportunity listings; receive member enquiries |
| **Data subjects** | Opportunity listers, enquiring members |
| **Categories of data** | Listing content, enquiry message, contact details shared in enquiry |
| **Lawful basis** | Contract (Art. 6(1)(b)); Legitimate interests to operate marketplace (Art. 6(1)(f)) |
| **Recipients** | Supabase, Resend; lister receives enquiry directly |
| **Retention** | Listing life + 2 years; enquiries 1 year after resolution unless dispute |

### E. Reviews & moderation

| Item | Detail |
|------|--------|
| **Purpose** | Attendee reviews; organiser replies; fake-review reports |
| **Data subjects** | Reviewers, organisers, reporters |
| **Categories of data** | Rating, review text, organiser reply, report reason/details, reporter user ID/email |
| **Lawful basis** | Legitimate interests — trust & safety (Art. 6(1)(f)); Contract for platform service |
| **Recipients** | Supabase (service role); moderators (internal) |
| **Retention** | Reviews retained while published + 2 years; reports 2 years after resolution |

### F. Email communications

| Item | Detail |
|------|--------|
| **Purpose** | Transactional (bookings, reminders, password reset); optional marketing (tips, re-engagement) |
| **Data subjects** | All members with email |
| **Categories of data** | Email address, name, email preference flags, send logs (Resend) |
| **Lawful basis** | Contract for transactional; **Consent** for marketing (PECR + UK GDPR Art. 6(1)(a)) |
| **Recipients** | Resend |
| **Retention** | Preferences until withdrawal; send metadata per Resend retention |

### G. Analytics & technical logs

| Item | Detail |
|------|--------|
| **Purpose** | Site performance, security, fraud prevention |
| **Data subjects** | Website visitors |
| **Categories of data** | IP (may be truncated), browser/device, pages viewed, session cookies |
| **Lawful basis** | Legitimate interests (Art. 6(1)(f)); Consent for non-essential analytics (PECR) |
| **Recipients** | Vercel (hosting/analytics) |
| **Retention** | Per Vercel defaults; security logs ~90 days internally |

### H. Admin & support

| Item | Detail |
|------|--------|
| **Purpose** | Support requests; moderation; impersonation for debugging (admin only) |
| **Data subjects** | Members contacting support; subjects of admin actions |
| **Categories of data** | Email correspondence, account IDs, moderation notes |
| **Lawful basis** | Legitimate interests; Contract |
| **Recipients** | Internal staff; Supabase admin tools |
| **Retention** | Support 1 year after resolution; admin audit per internal policy |

---

## 3. Subprocessors

| Processor | Processing | Location | DPA status |
|-----------|------------|----------|------------|
| Supabase | Database, auth, storage | US/EU | ☐ File signed copy |
| Stripe | Payments, Connect payouts | US/EU | ☐ File signed copy |
| Resend | Email delivery | US | ☐ File signed copy |
| Vercel | Hosting, Web Analytics | US/EU | ☐ File signed copy |

---

## 4. Data sharing with third-party controllers

| Recipient | Data shared | Purpose |
|-----------|-------------|---------|
| Event organisers | Attendee name, email, guest names, application answers | Run events and manage bookings |
| Stripe | Payment and identity data for Connect | Process payments and payouts |
| HMRC | Seller identity and income (if platform operator thresholds met) | Statutory reporting — see `HMRC-PLATFORM-OPERATORS.md` |

Organisers are **separate controllers** for attendee data they receive. Organiser terms require GDPR-compliant use and prohibit unrelated marketing.

---

## 5. Security measures (summary)

- HTTPS everywhere; session cookies; `SESSION_SECRET` for auth
- Supabase RLS on member-facing tables; service role for server APIs only
- Passwords hashed by Supabase Auth
- Rate limiting on auth endpoints
- Stripe webhook signature verification
- Admin impersonation restricted to admin role

---

## 6. Data subject rights

Handled via procedure in `GDPR-SAR-PROCEDURE.md`. Contact: hello@the-networker.co.uk.

---

## 7. Change log

| Date | Change | Author |
|------|--------|--------|
| 2026-07-08 | Initial RoPA created | — |
