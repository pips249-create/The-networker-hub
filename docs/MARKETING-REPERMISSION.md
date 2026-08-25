# Marketing re-permission (pre-ticked opt-in)

**Why:** Until 25 August 2026 the registration marketing checkbox was pre-ticked. Under UK GDPR / PECR, consent should be a clear affirmative opt-in.

**Decision (25 Aug 2026):** Do **not** send a re-permission email for now. Going forward, registration stays unchecked-by-default. Revisit before any large bulk marketing send if needed.

**Not legal advice.** Operational note for The Networker Group Ltd.

---

## Audit (already run)

```bash
node scripts/audit-legacy-marketing-opt-in.js
```

Writes `data/legacy-marketing-opt-in-audit.csv` (gitignored). Filter where `needs_repermission=yes` if you later choose to mail.

## If you later send a one-off re-permission email

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

## Going forward

- Registration marketing checkbox must stay **unchecked** by default (`register.html`).
- New accounts after 25 Aug 2026 are treated as valid opt-in if they ticked the box.
