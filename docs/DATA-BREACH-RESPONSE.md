# Personal data breach response — procedure

**Controller:** The Networker Group Ltd  
**ICO breach line:** 0303 123 1113 · [ico.org.uk/for-organisations/report-a-breach](https://ico.org.uk/for-organisations/report-a-breach)  
**ICO notification deadline:** 72 hours from awareness, where notification is required  
**Last updated:** 8 July 2026

*Operational procedure. Not legal advice.*

---

## 1. Incident lead

| Role | Name (assign internally) | Contact |
|------|------------------------|---------|
| **Incident lead** | | |
| **Technical lead** | | |
| **Privacy lead / Director** | | |

The incident lead coordinates containment, assessment, notification, and documentation.

---

## 2. What counts as a breach

A breach of security leading to accidental or unlawful **destruction, loss, alteration, unauthorised disclosure of, or access to** personal data.

Examples relevant to the Hub:

- Supabase or Vercel credential leak
- Accidental export of attendee list to wrong recipient
- Admin account compromise
- RLS misconfiguration exposing member data
- Lost laptop with unencrypted exports
- Resend mis-send to wrong distribution list

---

## 3. Response phases

### Phase 1 — Contain (0–4 hours)

1. **Stop the bleed:** Revoke compromised API keys; rotate `SESSION_SECRET`, Supabase service role, Stripe keys if exposed.
2. **Preserve evidence:** Screenshot logs; export Vercel/Supabase audit logs before rotation if safe.
3. **Limit access:** Disable affected admin accounts; block suspicious IPs if applicable.
4. **Notify incident lead** and technical lead immediately.

### Phase 2 — Assess (within 24 hours)

Document in the **breach register**:

| Field | Notes |
|-------|-------|
| Reference | BR-2026-001 |
| Date/time discovered | |
| Date/time occurred (if known) | |
| Description | What happened |
| Data categories | e.g. names, emails, booking history |
| Approximate number of people | |
| Likely consequences | Identity theft risk? Reputational? Low? |
| Containment actions taken | |
| Root cause (preliminary) | |

**Risk to rights and freedoms?** If **unlikely** → document internally only. If **likely** → proceed to Phase 3 (ICO). If **high risk to individuals** → also notify affected people (Phase 4).

When in doubt at scale, seek legal advice — but do not miss the 72-hour ICO window.

### Phase 3 — Notify ICO (within 72 hours if required)

Report via ICO online form when the breach is likely to result in a risk to individuals’ rights and freedoms.

Include:

- Nature of the breach
- Categories and approximate number of data subjects and records
- Contact details (DPO / privacy lead)
- Likely consequences
- Measures taken or proposed

If full details are not yet available at 72 hours, file initial notification and follow up.

### Phase 4 — Notify individuals (without undue delay if high risk)

Tell affected people in clear plain language:

- What happened
- What data was involved
- What you are doing
- What they can do (e.g. change password, monitor accounts)
- Contact point for questions

Use email from verified Resend domain or account message where possible.

### Phase 5 — Record & learn

1. Close breach register entry with final outcome.
2. Post-incident review within 2 weeks: root cause, preventive measures, policy updates.
3. Update RoPA or security controls if needed.

---

## 4. Subprocessor breaches

If Supabase, Stripe, Resend, or Vercel notifies you of a breach:

1. Obtain their incident summary and affected data scope.
2. Assess impact on Hub members.
3. Follow Phases 2–5 as controller for your users’ data.
4. Rely on processor DPA for their obligations; you remain responsible for notifying ICO/users where required.

---

## 5. Communication templates

### Internal (immediate)

> **Data incident — action required**  
> Potential personal data breach identified: [one-line summary].  
> Incident lead: [name]. Do not discuss externally. Containment steps: [list].

### Member notification (high-risk example)

> We are writing to tell you about a security incident affecting The Networker Hub on [date].  
> [What happened.] Data that may have been affected: [categories].  
> We have [actions taken]. We recommend you [specific steps].  
> Contact: hello@the-networker.co.uk with subject “Security incident”.  
> You may also contact the ICO: ico.org.uk

---

## 6. Preventive checklist (quarterly)

- [ ] API keys not in client-side code or public repos
- [ ] RLS policies reviewed after schema changes
- [ ] Admin accounts use strong passwords; impersonation audited
- [ ] DPAs on file for all subprocessors
- [ ] Backups and restore tested (Supabase)
- [ ] Staff know this procedure exists

---

## 7. Change log

| Date | Change |
|------|--------|
| 2026-07-08 | Formal procedure created |
