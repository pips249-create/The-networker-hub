# Airtable → Supabase migration

## Before you run

1. SQL migrations applied in [Supabase SQL Editor](https://supabase.com/dashboard/project/uztgzbjrmjbonfniyqcu):
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_hub_platform.sql`
2. `.env` filled in (copy from `.env.example`):

```env
SUPABASE_URL=https://uztgzbjrmjbonfniyqcu.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
AIRTABLE_API_KEY=your_airtable_token
AIRTABLE_BASE_ID=appQwgOxCrFFNweHe
ADMIN_EMAIL=pips249@gmail.com
ADMIN_INITIAL_PASSWORD=your_chosen_password
```

Use the **service_role** key (secret), not the anon key, for `SUPABASE_SERVICE_ROLE_KEY`.

## Run (once)

```bash
cd ~/Desktop/The-networker-hub
npm install
node migrate.js
```

Or: `npm run migrate`

## What it does

| Step | Tables |
|------|--------|
| 1 | `organisers` from Airtable Organisers |
| 2 | `events` (linked to organisers) |
| 3 | `tickets` (linked to events) |
| 4 | Supabase Auth + `hub_accounts` for users that have a password to set (admin uses `ADMIN_INITIAL_PASSWORD`) |

Rows are upserted on `airtable_id` — safe to re-run.

## After migration

1. Add `DATA_PROVIDER=supabase` in Vercel (if not already).
2. Redeploy the site.
3. Check https://the-networker-hub.vercel.app/api/events — should list Supabase events.
4. Login still uses Airtable until auth is migrated in the API; admin can be created in Supabase Auth by this script.

Other Airtable users without a migration password are skipped — they need a password reset in Supabase after you switch auth.
