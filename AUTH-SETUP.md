# Login & Command Center setup

Auth runs on **Supabase Auth** + `hub_accounts` (not Airtable).

## 1. Vercel environment variables

| Key | Example / how to get it |
|-----|-------------------------|
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_ANON_KEY` | Same page (anon / public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page (service role — server only) |
| `SESSION_SECRET` | Run `openssl rand -hex 32` or `./scripts/generate-auth-env.sh` |
| `ADMIN_SETUP_SECRET` | Run `openssl rand -hex 24` (one-time setup secret) |
| `ADMIN_EMAIL` | Your admin email |
| `ADMIN_INITIAL_PASSWORD` | Your chosen password (min 8 chars) |
| `SITE_URL` | `https://www.thenetworkeruk.com` |

**Verify after redeploy:** `/api/auth/config-check` (admin session or `CONFIG_CHECK_SECRET` bearer in production).

See also **`SUPABASE-SETUP.md`**.

## 2. Redeploy, then create admin account

After redeploy, run **once** (replace values):

```bash
curl -X POST https://www.thenetworkeruk.com/api/auth/setup-admin \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "YOUR_ADMIN_SETUP_SECRET",
    "email": "you@example.com",
    "password": "YOUR_CHOSEN_PASSWORD",
    "name": "Pip"
  }'
```

You should see: `"message": "Admin account created."`

Or run `npm run seed-admin` locally with the same env vars.

### Add another user (e.g. team member)

Same endpoint; set `"role": "client"` (most users) or `"admin"` (platform only):

```bash
curl -X POST https://www.thenetworkeruk.com/api/auth/setup-admin \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "YOUR_ADMIN_SETUP_SECRET",
    "email": "rosie@the-networker.co.uk",
    "password": "CHOOSE_A_PASSWORD_MIN_8_CHARS",
    "name": "Rosie McGilvray",
    "role": "client"
  }'
```

Or run `./scripts/create-hub-user.sh` after exporting `ADMIN_SETUP_SECRET`.

## 3. Sign in

- **Login:** https://www.thenetworkeruk.com/login  
- **Command Center (admin only):** https://www.thenetworkeruk.com/admin/  

Forgot / reset password uses Supabase Auth recovery links (Resend when `AUTH_SEND_EMAILS=true`).

## 4. Remove one-time secrets

After the first admin exists, remove `ADMIN_SETUP_SECRET` and `ADMIN_INITIAL_PASSWORD` from Vercel Production.
