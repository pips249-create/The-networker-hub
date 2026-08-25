# Marketing re-permission (pre-ticked opt-in)

**Why:** Until 25 August 2026 the registration marketing checkbox was pre-ticked. Under UK GDPR / PECR, consent should be a clear affirmative opt-in. Accounts created before that date with `emails_enabled = true` should be re-permissioned before bulk marketing.

**Not legal advice.** Operational checklist for The Networker Group Ltd.

---

## 1. Run the audit

```bash
node scripts/audit-legacy-marketing-opt-in.js
```

Writes `data/legacy-marketing-opt-in-audit.csv` (gitignored). Filter where `needs_repermission=yes`.

## 2. Send a one-off re-permission email

Use Resend (or Brevo if that list already lives there). Subject ideas:

- Stay on our tips & recommendations list?
- Quick check: do you still want Networker emails?

Suggested body (plain English):

> Hi {{name}},
>
> You’re on our optional tips and event recommendations list from when you created a The Networker account.
>
> We want to make sure you’re happy to keep receiving these emails.
>
> • Keep receiving tips → open Account settings and confirm email preferences are on: {{settings_url}}
> • Prefer not to → reply “unsubscribe”, or turn off tips in Account settings, or use the unsubscribe link below.
>
> Booking confirmations and security emails are unaffected.
>
> Thanks,
> The Networker team

Include **List-Unsubscribe** headers (already used for marketing templates in Hub). Link to `/account/settings` (or equivalent) and `/legal-policies#privacy`.

## 3. After the campaign

| Action | Owner | Done |
|--------|-------|:----:|
| Audit CSV generated | Ops | ☐ |
| Re-permission email sent | Marketing | ☐ |
| Soft bounce / unsubscribe processed | Ops | ☐ |
| Optional: set `emails_enabled = false` for non-responders after ~14 days (stricter) | Marketing + Tech | ☐ |
| Tick complete in `docs/COMPLIANCE-RUNBOOK.md` | Catherine | ☐ |

## 4. Going forward

- Registration marketing checkbox must stay **unchecked** by default (`register.html`).
- New accounts after 25 Aug 2026 are treated as valid opt-in if they ticked the box.
