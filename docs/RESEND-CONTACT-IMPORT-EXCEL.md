# Resend contact import — Excel / CSV format

Resend does **not** upload `.xlsx` directly. Build the list in **Excel or Google Sheets**, then **export as CSV** and import in Resend (**Contacts → Add contacts → Import CSV**).

Docs: [Managing Contacts (CSV import)](https://resend.com/docs/dashboard/audiences/contacts)

---

## Recommended columns (Birmingham intro list)

Use **one row per person** (dedupe emails). Header row must be plain text — no merged cells.

| Column (Excel header) | Maps in Resend | Required | Notes |
|----------------------|----------------|----------|--------|
| `email` | **email** | Yes | Lowercase header `email` auto-maps without extra steps |
| `company_name` | custom property | Recommended | Used in the Birmingham broadcast: `Hello {{{company_name\|there}}},` — create property **`company_name`** in Resend before import |
| `city` | custom property | No | e.g. `Birmingham`, `Solihull` — create/map on import |
| `source` | custom property | No | Where you found them: `linkedin`, `chamber`, `manual` |
| `unsubscribed` | unsubscribed | No | `false` or leave blank for mailable contacts |

**Template file (copy rows):** `data/birmingham-intro-resend-import-template.csv`

### If your headers are capitalised

Resend’s auto-match is **case-sensitive**. Headers like `Email` and `First Name` need mapping in the import UI, or use this mapping:

- `Email` → email  
- `First Name` → first_name  
- `Last Name` → last_name  

---

## Excel rules (avoids broken imports)

1. **One email per row** — remove duplicates (Data → Remove duplicates on email column).
2. **No merged cells** in the data area.
3. **No line breaks** inside cells (especially company names).
4. **Email column = text** — avoid Excel “helpfully” breaking `name@domain.co.uk`.
5. **Trim junk** — no trailing spaces; lowercase emails are fine.
6. **Do not import** addresses already on your global suppression / Brevo unsubscribe list (mark `unsubscribed` = `true` or exclude the row).

---

## Export from Excel for Resend

| App | Steps |
|-----|--------|
| **Excel (Windows)** | File → Save As → **CSV UTF-8 (Comma delimited) (*.csv)** |
| **Excel (Mac)** | File → Save As → **CSV UTF-8** |
| **Google Sheets** | File → Download → **Comma-separated values (.csv)** |

Then in Resend:

1. **Contacts → Add contacts → Import CSV**
2. Upload the `.csv`
3. Confirm mappings (`email` required; map `city`, `company`, `source` to properties if prompted)
4. Optionally add to a **Segment** e.g. `Birmingham intro — Sep 2026`
5. **Continue → review → finish**

Existing emails **upsert** (update) by default.

---

## After import — send the Birmingham intro

1. Create a **Broadcast** and paste HTML from **`data/birmingham-intro-resend-broadcast.html`** (designed for Resend; unsubscribe + first name already wired).
2. Audience = segment from step above.
3. Suggested subject: `Networking in Birmingham — one place to browse what's on`
4. Test send to your team first.

See also: `docs/BIRMINGHAM-INTRO-EMAIL.md` (subject lines and message structure).

---

## Minimal CSV (email only)

If you only have addresses:

```csv
email
someone@company.co.uk
another@business.com
```

Header must be exactly `email` (lowercase) for frictionless import.

---

## Optional: organiser claim CSV (different campaign)

Command Centre / claim rematch scripts use a **different** shape (personalised claim URLs):

`Email,Organiser name,OTHER_GROUPS_NOTE,CLAIM_URL`

That format is for **transactional bulk send**, not Resend Audiences. Do not mix those columns into the Birmingham intro import unless you map only `email`.
