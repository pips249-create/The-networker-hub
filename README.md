# The Networker Hub

Member and organiser platform for networking events, exhibitions, and the Academy (training).

**Live preview:** https://the-networker-hub.vercel.app/

## What’s in this folder

| File / folder | Purpose |
|---------------|---------|
| **`PIPS-TODO.md`** | **Pip's to-do list** — tabbed checklist for things to do later (migrations, Resend, etc.) |
| `index.html` | Hub home |
| `events/index.html` | Events & exhibitions (filters, Premium Spotlight, Sponsor Hub) |
| `api/events.js` | Vercel function — loads events from Airtable |
| `js/events.js` | Renders listings from the API |
| `css/hub.css` | Shared styles |
| `assets/logo.png` | Logo (transparent background; `logo-original.png` is the backup) |

## Airtable setup

1. Create a base with a table named **Events** (or set `AIRTABLE_EVENTS_TABLE`).
2. Suggested fields (names are flexible — the API maps common alternatives):

| Field | Example |
|-------|---------|
| Title | Cambridge Business Breakfast |
| Description | Short blurb for cards |
| Date | 2026-06-12 |
| Time | 08:00 |
| Price | 18 or Free |
| Location | Cambridge |
| Industry | Professional services |
| Meeting Format | In person / Online / Hybrid |
| Type | Meeting or Exhibition |
| Featured | Yes (for Premium Spotlight) |
| Photo | Attachment (cover image) |
| Organiser | Yorkshire Network Co. |

3. In [Vercel](https://vercel.com) → your project → **Settings → Environment Variables**, add:

- `AIRTABLE_API_KEY` — personal access token from [airtable.com/create/tokens](https://airtable.com/create/tokens)
- `AIRTABLE_BASE_ID` — from the base URL: `https://airtable.com/appXXXXXXXX/...`
- `AIRTABLE_EVENTS_TABLE` — optional, default `Events`

4. Redeploy. The browse page calls `/api/events` (not Airtable directly, so the key stays private).

**Local testing:** `npx vercel dev` in this folder (requires Vercel CLI and env vars).

Copy `.env.example` for variable names.

## Deploy on Vercel

1. Import `pips249-create/The-networker-hub` from GitHub  
2. Framework: **Other** (static site + `/api` functions)  
3. Add environment variables above  
4. Redeploy after each push  
