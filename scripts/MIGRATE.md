# Airtable → Supabase migration (Phase 2)

## Before you run

1. SQL migrations in [Supabase SQL Editor](https://supabase.com/dashboard/project/uztgzbjrmjbonfniyqcu):
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_hub_platform.sql`
2. Airtable token needs **data.records:read** and **schema.bases:read** (for field IDs).
3. `.env`:

```env
SUPABASE_URL=https://uztgzbjrmjbonfniyqcu.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
AIRTABLE_API_KEY=your_airtable_token
AIRTABLE_BASE_ID=appQwgOxCrFFNweHe
ADMIN_EMAIL=pips249@gmail.com
ADMIN_INITIAL_PASSWORD=your_chosen_password
```

## Run (once)

```bash
cd ~/Desktop/The-networker-hub
npm install @supabase/supabase-js dotenv
node migrate.js
```

## Migration order

| Step | What |
|------|------|
| 1 | Supabase Auth users + `hub_accounts` (emails from Organisers + Attendees) |
| 2 | `organisers` |
| 3 | `attendees` |
| 4 | `events` |
| 5 | `tickets` |
| 6 | `registrations` |
| 7 | `reviews` |

Uses your Airtable **table IDs** and **field IDs** from the Phase 2 script. Safe to re-run (upsert on `airtable_id`).

**Note:** New auth users get `ADMIN_INITIAL_PASSWORD` as their password. Tell users to change it after go-live, or run password reset.

## After migration

1. `DATA_PROVIDER=supabase` in Vercel → Redeploy.
2. Check `/api/events` and Supabase Table Editor.
3. Site login still uses Airtable cookies until Phase 3 auth API work.
