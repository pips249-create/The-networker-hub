# Supabase setup — linking Cursor & Vercel to your database

You do **not** need a special “Cursor ↔ Supabase” integration. The agent works from **files in this repo** plus **environment variables** (local `.env` and Vercel). Follow these steps once; then we can migrate API routes off Airtable slice by slice.

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
| `DATA_PROVIDER` | `supabase` or `airtable` (we’ll add a switch while migrating) |

### Local env (for Cursor terminal / local API tests)

In `The-networker-hub/.env` (create from `.env.example` — **do not commit**):

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATA_PROVIDER=supabase
SESSION_SECRET=your-existing-secret
SITE_URL=http://localhost:3000
```

### Vercel

**Settings** → **Environment Variables** → add the same three `SUPABASE_*` vars for **Production** (and Preview if you use it) → **Redeploy**.

Keep existing `AIRTABLE_*` vars during the transition; we’ll remove them when each feature is moved.

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

## 6. Migration order (what we’ll build next)

1. **Config + client** — `@supabase/supabase-js`, `api/_lib/supabase.js` ✅ (starter in repo)
2. **Auth** — profiles + roles (replace Airtable Users)
3. **Public events** — read listings + detail
4. **Organiser writes** — groups, events, tickets
5. **Attendee dashboard** — registrations, favourites
6. **Admin metrics** — aggregate queries
7. **Data import** — one-off script from Airtable → Supabase
8. Remove `DATA_PROVIDER=airtable` and Airtable env vars

---

## 7. What to send in your next message

So we can start coding immediately:

1. Confirm the schema is applied in Supabase (or attach `001_initial_schema.sql`).
2. Say whether Claude used **Supabase Auth** (`auth.users`) or a custom `users` table.
3. Confirm env vars are in **Vercel** (yes/no — no need to paste values).

We’ll align `api/_lib/*` to your exact table and column names from the migration file.
