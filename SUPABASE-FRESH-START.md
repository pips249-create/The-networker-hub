# Fresh start — Supabase only (no Airtable)

You can ignore Airtable, `migrate.js`, and any `AIRTABLE_*` env vars. The site uses **Supabase** for login, registration, and public events.

## 1. Database (once)

In [Supabase SQL Editor](https://supabase.com/dashboard/project/uztgzbjrmjbonfniyqcu):

1. Run `supabase/migrations/001_initial_schema.sql`
2. Run `supabase/migrations/002_hub_platform.sql`

## 2. Secrets (local + Vercel)

Edit **`local.env`** (visible in Finder) or hidden `.env`:

```env
SUPABASE_URL=https://uztgzbjrmjbonfniyqcu.supabase.co
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
DATA_PROVIDER=supabase

SESSION_SECRET=<any long random string>
ADMIN_EMAIL=pips249@gmail.com
ADMIN_INITIAL_PASSWORD=<your password>
SITE_URL=https://the-networker-hub.vercel.app
```

**You do not need** `AIRTABLE_*` variables anymore.

Same values in **Vercel → Environment Variables**, then **Redeploy**.

## 3. Create your admin account

```bash
cd ~/Desktop/The-networker-hub
npm install
node scripts/seed-admin.js
```

## 4. Add content in Supabase

Use **Table Editor** to add rows manually (or import CSV later):

- **organisers** — your group profile(s)
- **events** — set `approval_status` = `Approved`, link `organiser_id`
- **tickets** — link `event_id`

Public browse uses `/api/events` from Supabase when `DATA_PROVIDER=supabase`.

## 5. What works now vs later

| Feature | Status |
|---------|--------|
| Login / register | Supabase Auth (`hub_accounts` + `attendees`) |
| Browse events (approved) | Supabase via `/api/events` |
| Admin seed script | `npm run seed-admin` |
| Organiser dashboard writes | Add rows in Supabase Table Editor for now |

## 6. Organiser photos (upload / paste)

Run once in Supabase SQL Editor: `supabase/migrations/004_organiser_storage.sql`

Then in **Organiser dashboard → Edit group**, use **upload, drag-drop, or paste** (Ctrl+V). Images are stored in Supabase Storage; no photo URL required.

## 7. Import users from Excel without email

See **`SUPABASE-NO-EMAIL.md`** and:

```bash
node scripts/import-attendees-csv.js your-file.csv
```

## 8. Optional cleanup

- Remove `AIRTABLE_*` from Vercel when you are confident
- Delete or ignore `migrate.js` and Airtable migration docs
