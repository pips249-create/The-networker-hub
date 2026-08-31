# Supabase setup — linking Cursor & Vercel to your database

You do **not** need a special “Cursor ↔ Supabase” integration. The agent works from **files in this repo** plus **environment variables** (local `.env` and Vercel). The live Hub is Supabase-only (Airtable runtime removed).

---

## 1. Your Supabase project

**Dashboard:** [uztgzbjrmjbonfniyqcu](https://supabase.com/dashboard/project/uztgzbjrmjbonfniyqcu)  
**API URL:** `https://uztgzbjrmjbonfniyqcu.supabase.co`

If the project is new, pick a region close to your users (e.g. **London**) and save the database password.

---

## 2. Run migrations (in order)

In **SQL Editor**, run each file from this repo:

| Order | File |
|-------|------|
| 1 | `supabase/migrations/001_initial_schema.sql` |
| 2 | `supabase/migrations/002_hub_platform.sql` |

Confirm tables under **Table Editor**: `organisers`, `events`, `tickets`, `attendees`, `hub_accounts`, etc.

Your original file is also at `~/Downloads/schema.sql` (same as `001`).

---

## 3. Keys the app needs (never paste secrets in chat)

In Supabase: **Project Settings** → **API**.

| Variable | Where to use | Purpose |
|----------|----------------|---------|
| `SUPABASE_URL` | Vercel + local `.env` | Project URL |
| `SUPABASE_ANON_KEY` | Vercel + local `.env` | Browser-safe key (RLS applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Vercel only** (server) | API routes on Vercel — bypasses RLS; **never** expose in frontend or git |

Optional (recommended later):

| Variable | Purpose |
|----------|---------|
| `SUPABASE_JWT_SECRET` | Only if you verify JWTs yourself |

### Local env (for Cursor terminal / local API tests)

In `The-networker-hub/.env` (create from `.env.example` — **do not commit**):

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SESSION_SECRET=your-existing-secret
SITE_URL=http://localhost:3000
```

### Vercel

**Settings** → **Environment Variables** → add the three `SUPABASE_*` vars for **Production** (and Preview if you use it) → **Redeploy**.

Remove any leftover `AIRTABLE_*` variables from Vercel — they are unused by the app.

---

## 4. How to “link” Cursor to Supabase

| Method | What you do | What the agent can do |
|--------|-------------|------------------------|
| **A. Schema file in repo** (best) | Put SQL in `supabase/migrations/` | Read tables, columns, RLS; write matching API code |
| **B. Local `.env`** | Add keys to `.env` in project root | Run scripts / test connections from terminal (you approve) |
| **C. Paste in chat** | Paste the SQL (or a link to a gist) | One-off review; still add to repo for permanence |
| **D. Supabase MCP** (optional) | Cursor **Settings** → **MCP** → add [Supabase MCP](https://github.com/supabase-community/supabase-mcp) with a personal access token | Query schema from the dashboard without copying SQL |

**Do not** paste `SUPABASE_SERVICE_ROLE_KEY` or `SESSION_SECRET` in chat. If something fails, share the **error message** and `/api/auth/config-check` JSON (secrets are stripped).

---

## 5. Verify connection

After env vars are set and redeployed:

```text
GET https://the-networker-hub.vercel.app/api/auth/config-check
```

Look for `"supabase": { "ok": true }` (we add this as migration progresses).

Locally, with Vercel CLI:

```bash
cd ~/Desktop/The-networker-hub
npx vercel env pull .env.local
npx vercel dev
```

Then open `http://localhost:3000/api/auth/config-check`.

---

## 6. Status

Auth, public events, organiser writes, attendee dashboard, and admin metrics all use Supabase.

Historical Airtable → Supabase import: `migrate.js` + `scripts/MIGRATE.md` (local one-off only).

---

## 7. Import Airtable data (historical)

```bash
cd ~/Desktop/The-networker-hub
npm install
node migrate.js
```

See `scripts/MIGRATE.md` for required `.env` keys.

## 8. What to send in your next message

So we can start coding immediately:

1. Confirm the schema is applied in Supabase (or attach `001_initial_schema.sql`).
2. Say whether Claude used **Supabase Auth** (`auth.users`) or a custom `users` table.
3. Confirm env vars are in **Vercel** (yes/no — no need to paste values).

We’ll align `api/_lib/*` to your exact table and column names from the migration file.
