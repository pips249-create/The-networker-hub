# Organiser outreach tracker (ops CRM-lite)

**Not in Command Centre.** Shared Google Sheet for the first month of claim outreach — who we emailed, called, and what’s still open.

## Setup (once)

1. From the repo root (needs `local.env` Supabase keys):

```bash
node scripts/build-organiser-outreach-tracker.js
```

2. Open `ops/organiser-outreach-tracker.csv` in **Google Sheets** (File → Import), or upload to Airtable.
3. Share the Sheet with whoever is calling / emailing.
4. Optional Sheet views (Data → Filter views):
   - **Call list** — `claim_status` = `awaiting_claim`, `phone` not blank, `outcome` blank
   - **Claimed** — `claim_status` = `claimed`
   - **My follow-ups** — `owner` = you, `next_action` not blank

`claim_status` values: `awaiting_claim` (needs outreach), `claimed`, `disputed`.

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

## Weekly refresh

Export the Sheet as CSV over `ops/organiser-outreach-tracker.csv` (or keep Notes only in Sheets and only use the script for a fresh Hub snapshot).

Then re-run:

```bash
node scripts/build-organiser-outreach-tracker.js
```

The script **keeps** your manual columns when it finds a matching `organiser_id`, and updates `claim_status` from the Hub. If Hub shows `claimed` and `outcome` is empty, it sets `outcome` to `claimed`.

## Outcome values (keep consistent)

`interested` · `not_now` · `wrong_contact` · `no_answer` · `claimed` · `do_not_contact`
