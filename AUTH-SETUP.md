# Login & Command Center setup

## 1. Create Airtable **Users** table

In base `appQwgOxCrFFNweHe`, add a table named **Users** with these fields:

| Field name | Type |
|------------|------|
| Email | Email (or Single line text) |
| Password Hash | Long text |
| Role | Single select: `admin`, `client` |
| Name | Single line text |
| Reset Token | Single line text |
| Reset Token Expires | Date (include time) |

Optional tables for the dashboard:

**System Logs** — `Message` (long text), `Type` (text), `Timestamp` (date)

**System Alerts** — `Title`, `Detail`, `Severity` (high/medium/low), `Created` (date)

## 2. Vercel environment variables

**Full click-by-click guide:** see **`VERCEL-AUTH-ENV.md`**.

Add alongside your existing Airtable vars:

| Key | Example / how to get it |
|-----|-------------------------|
| `SESSION_SECRET` | Run `openssl rand -hex 32` or `./scripts/generate-auth-env.sh` |
| `ADMIN_SETUP_SECRET` | Run `openssl rand -hex 24` (one-time setup secret) |
| `ADMIN_EMAIL` | `pips249@gmail.com` |
| `ADMIN_INITIAL_PASSWORD` | Your chosen password (min 8 chars) |
| `AIRTABLE_USERS_TABLE` | `Users` |
| `SITE_URL` | `https://the-networker-hub.vercel.app` |

**Update your Airtable token** scopes to include **data.records:read** and **data.records:write** on this base.

**Verify after redeploy:** https://the-networker-hub.vercel.app/api/auth/config-check

## 3. Redeploy, then create admin account

After redeploy, run **once** (replace values):

```bash
curl -X POST https://the-networker-hub.vercel.app/api/auth/setup-admin \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "YOUR_ADMIN_SETUP_SECRET",
    "email": "pips249@gmail.com",
    "password": "YOUR_CHOSEN_PASSWORD",
    "name": "Pip"
  }'
```

You should see: `"message": "Admin account created."`

### Add another user (e.g. team member)

Same endpoint; set `"role": "client"` (most users) or `"admin"` (platform only):

```bash
curl -X POST https://the-networker-hub.vercel.app/api/auth/setup-admin \
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

## 4. Sign in

- **Login:** https://the-networker-hub.vercel.app/login  
- **Command Center (admin only):** https://the-networker-hub.vercel.app/admin/dashboard.html  

The dashboard is not linked on the public site — only admins reach it after sign-in.

## Forgot password

1. User clicks **Forgot password** on the login page.  
2. A reset token is saved in Airtable.  
3. If `RESEND_API_KEY` is set, an email is sent.  
4. Production never returns `resetUrl` in the API response. On Preview only, set `AUTH_SHOW_RESET_LINK=true` (or `AUTH_DEV_RESET_LINK=true`) to opt in to showing the reset URL when email is not sent.

Reset page: `/reset-password?token=...`

## Revenue metrics

The Command Center estimates revenue from Airtable **Price** × **Tickets Sold** (or **Attendees** / **Registrations** if present). Add those columns to your Events table for live figures.
