# GDPR subject access & rights requests — procedure

**Controller:** The Networker Group Ltd  
**Contact:** hello@thenetworkeruk.com  
**Response deadline:** One calendar month (extendable by two months if complex — inform the requester)  
**Last updated:** 25 August 2026

*Operational procedure. Not legal advice.*

---

## 1. Scope

This procedure covers requests to exercise rights under UK GDPR:

- **Access** (Art. 15) — copy of personal data
- **Rectification** (Art. 16) — correct inaccurate data
- **Erasure** (Art. 17) — delete data (“right to be forgotten”)
- **Restriction** (Art. 18) — limit processing
- **Portability** (Art. 20) — machine-readable export where applicable
- **Objection** (Art. 21) — object to legitimate-interests processing
- **Withdraw consent** — marketing emails, analytics cookies

---

## 2. Roles

| Role | Name | Responsibility |
|------|------|----------------|
| **Privacy lead** | Catherine Hancher | Owns the register and final sign-off |
| **Support owner** | hello@thenetworkeruk.com (Catherine primary, Rosie cover) | Acknowledges within 2 working days |
| **Technical owner** | Catherine Hancher | Runs Supabase exports/deletions; documents actions taken |

---

## 3. Intake

1. Request received at **hello@thenetworkeruk.com** (subject line “Data request” or similar).
2. Log in the **GDPR request register** (spreadsheet or Notion):

   | Field | Example |
   |-------|---------|
   | Reference | SAR-2026-001 |
   | Date received | 2026-07-08 |
   | Requester email | user@example.com |
   | Right exercised | Access |
   | Identity verified? | Y/N |
   | Due date | 2026-08-08 |
   | Status | Open / In progress / Closed |
   | Notes | |

3. Send acknowledgement within **2 working days** confirming receipt and expected response date.

---

## 4. Identity verification

Verify the requester controls the email address or account:

- **Preferred:** Request from the registered account email; match to `hub_accounts` / `attendees`.
- **If different email:** Ask them to email from the registered address, or provide reasonable proof (e.g. last booking reference + name).
- **Do not** disclose personal data until identity is reasonably confirmed.
- **Refuse manifestly unfounded or excessive requests** (document reason; seek legal advice if unsure).

---

## 5. Fulfilment by right type

### Access / portability

Export from Supabase (admin / SQL):

- `hub_accounts` — preferences, role, terms acceptance
- `attendees` — name, email, location, profile fields
- `registrations` — bookings linked to attendee email
- `reviews` — reviews submitted
- `favourites` / saved events
- `opportunity_enquiries` — enquiries sent
- `complaints` — any complaint logged against their email (Command Centre register)
- `international_country_interest` — expansion waitlist rows for their email
- `international_group_intake` — group onboarding submissions for their email
- Preview / city-partner waitlists if their email appears there

Provide a **readable summary** (PDF or email) plus **CSV/JSON** where portability applies. Redact third-party personal data (e.g. other guests) where not the requester’s own data.

### Rectification

Update via admin tools or direct Supabase patch. Confirm changes to requester.

### Erasure

1. Check exceptions: legal retention (7-year financial records), active disputes, organiser obligations.
2. Delete or anonymise:
   - Auth user (Supabase Auth admin)
   - `hub_accounts`, `attendees` row
   - Reviews (or anonymise author)
   - Marketing preferences
   - `international_country_interest` / `international_group_intake` rows for their email
   - Waitlist rows for their email
3. **Retain** transaction records where required by law (anonymise link to individual where possible).
4. Notify Stripe only if Connect account exists (organiser erasure — follow Stripe account closure).

### Restriction / objection

- **Marketing:** Set `emails_enabled = false` on `hub_accounts`.
- **Reminders:** Set `email_pref_event_reminders = false`.
- **Broader objection:** Document; restrict processing pending assessment; seek legal advice for complex cases.

---

## 6. Response template (closure)

> Subject: Your data request — [reference]
>
> We have completed your request dated [date] regarding [right type].
>
> [Summary of action taken / data enclosed / reason if refused in part.]
>
> If you are not satisfied, you may complain to the ICO: ico.org.uk or 0303 123 1113.
>
> The Networker Group Ltd

---

## 7. Escalation

- Suspected **data breach** during handling → follow `DATA-BREACH-RESPONSE.md` immediately.
- Request involves **law enforcement** or **court order** → do not delete without legal advice.
- **Organiser-held data** (attendee lists they downloaded) — explain we cannot delete copies on their systems; confirm deletion from Hub.

---

## 8. Review

Review this procedure annually or after any ICO complaint. Update the change log below.

| Date | Change |
|------|--------|
| 2026-08-25 | Added international interest/intake + waitlist tables to access/erasure checklist |
| 2026-07-08 | Formal procedure created |
