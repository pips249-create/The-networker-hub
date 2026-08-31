# Auth environment variables (Vercel)

Supabase-backed login for The Networker UK. Do **not** add Airtable tokens.

## Required

| Key | Value |
|-----|--------|
| `SUPABASE_URL` | `https://YOUR_PROJECT.supabase.co` |
| `SUPABASE_ANON_KEY` | anon / public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key (**server only**) |
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `SITE_URL` | `https://www.thenetworkeruk.com` |

## One-time admin bootstrap

| Key | Value |
|-----|--------|
| `ADMIN_SETUP_SECRET` | `openssl rand -hex 24` |
| `ADMIN_EMAIL` | your admin email |
| `ADMIN_INITIAL_PASSWORD` | min 8 chars |

Remove `ADMIN_SETUP_SECRET` / `ADMIN_INITIAL_PASSWORD` after the first admin exists.

Generate secrets: `./scripts/generate-auth-env.sh`

## Optional

| Key | Purpose |
|-----|---------|
| `CONFIG_CHECK_SECRET` | Bearer token for `/api/auth/config-check` in production |
| `RESEND_API_KEY` / `RESEND_FROM` | Password reset + transactional email |
| `AUTH_SEND_EMAILS` | Set `true` to send auth emails |

## Verify

1. Redeploy after saving env vars.
2. Open `/api/auth/config-check` (admin session or `Authorization: Bearer <CONFIG_CHECK_SECRET>`).
3. Expect `"supabase": { "ok": true }` and sign in at `/login`.

Full database setup: **`SUPABASE-SETUP.md`**. Account bootstrap: **`AUTH-SETUP.md`**.
