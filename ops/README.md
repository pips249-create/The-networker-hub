# Organiser outreach tracker (ops CRM-lite)

**Not in Command Centre.** Shared Google Sheet for the first month of claim outreach — who we emailed, called, and what’s still open.

## Live Sheet

**[Organiser outreach — Aug 2026](https://docs.google.com/spreadsheets/d/1DjUCEl8HaDux-FqtpXDzhtPVuFYJv2VglZ1l0vBfzoc/edit)**

Share with the team (editors). Source data: 1,110 public groups · ~356 with phone numbers · claim status from Hub.

## First load (if the Sheet is empty)

1. Open the Sheet link above in **Chrome**.
2. Click cell **A1**.
3. Press **Cmd+V** (full tracker is on your Mac clipboard), **or** File → Import → Upload → choose `Organiser-outreach-Aug-2026.csv` on your Desktop.
4. If importing: location = **Replace current sheet**.

## Refresh claim status later

```bash
node scripts/build-organiser-outreach-tracker.js
```

Re-import Hub columns carefully so you don’t wipe call/email notes.

## Columns

| Column | Source | Notes |
|--------|--------|--------|
| `organiser_id` … `claim_url` | Hub (script) | Refreshed on each run |
| `priority` | You | e.g. `high` for warm leads |
| `email_1_sent` / `email_2_sent` | You | Date or `Y` |
| `last_called` / `last_emailed` | You | Date |
| `next_action` | You | e.g. `Call Friday` |
| `outcome` | You | `interested` / `not_now` / `wrong_contact` / `no_answer` / `claimed` |
| `owner` | You | Who owns the follow-up |
| `notes` | You | Free text |

## Filter views to add

- **Call list** — `claim_status` = `awaiting_claim`, `phone` not blank, `outcome` blank  
- **Claimed** — `claim_status` = `claimed`  
- **My follow-ups** — `owner` = you, `next_action` not blank  

`claim_status` values: `awaiting_claim` (needs outreach), `claimed`, `disputed`.

## Outcome values (keep consistent)

`interested` · `not_now` · `wrong_contact` · `no_answer` · `claimed` · `do_not_contact`
