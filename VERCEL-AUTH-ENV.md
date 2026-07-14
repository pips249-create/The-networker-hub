# Vercel auth environment variables — step by step

Your live site already has **Events** Airtable vars. Login needs **six more** variables plus a **write-capable** Airtable token.

**Quick check after each step:**  
https://the-networker-hub.vercel.app/api/auth/config-check

---

## Step 1 — Update your Airtable personal access token

1. Open [airtable.com/create/tokens](https://airtable.com/create/tokens).
2. Edit your existing token (or create a new one).
3. Scopes — enable **both**:
   - `data.records:read`
   - `data.records:write`
4. Access — same base: `appQwgOxCrFFNweHe`.
5. Save and copy the token (`pat…`).

In Vercel, update **`AIRTABLE_API_KEY`** to this new token (replace the old read-only one).

---

## Step 2 — Create the **Users** table in Airtable

In base `appQwgOxCrFFNweHe`, add a table named **`Users`** with these fields (names must match):

| Field name | Field type |
|------------|------------|
| Email | Email or Single line text |
| Password Hash | Long text |
| Role | Single select: `admin`, `client` |
| Name | Single line text |
| Reset Token | Single line text |
| Reset Token Expires | Date (include time) |

---

## Step 3 — Generate secrets on your Mac

In Terminal:

```bash
cd ~/Desktop/The-networker-hub
chmod +x scripts/generate-auth-env.sh
./scripts/generate-auth-env.sh
```

It prints `SESSION_SECRET` and `ADMIN_SETUP_SECRET` and asks for your admin password. **Save the output** in a password manager.

Or generate manually:

```bash
openssl rand -hex 32   # SESSION_SECRET
openssl rand -hex 24   # ADMIN_SETUP_SECRET
```

---

## Step 4 — Add variables in Vercel

1. Go to [vercel.com](https://vercel.com) → project **the-networker-hub**.
2. **Settings** → **Environment Variables** (not “Environments”).
3. Click **Add Environment Variable** for each row below.

| Key | Value | Notes |
|-----|--------|--------|
| `SESSION_SECRET` | *(64-char hex from script)* | No quotes |
| `ADMIN_SETUP_SECRET` | *(48-char hex from script)* | One-time; used for setup-admin only |
| `ADMIN_EMAIL` | `pips249@gmail.com` | |
| `ADMIN_INITIAL_PASSWORD` | *password you chose* | Min 8 characters |
| `AIRTABLE_USERS_TABLE` | `Users` | Exact table name |
| `SITE_URL` | `https://the-networker-hub.vercel.app` | No trailing slash |

For **each** variable, tick **Production** (and **Preview** if you use preview URLs).

**Do not** wrap values in quotes. Paste the raw string only.

You should already have these (keep them):

| Key | Value |
|-----|--------|
| `AIRTABLE_API_KEY` | `pat…` (write-capable token) |
| `AIRTABLE_BASE_ID` | `appQwgOxCrFFNweHe` |
| `AIRTABLE_EVENTS_TABLE` | `tblOwGcn7BKt71j6b` |
| `AIRTABLE_EVENTS_VIEW` | `viwuzobg711IGzgev` |

---

## Step 5 — Redeploy (required)

Saving variables does **not** update the running deployment.

1. **Deployments** tab  
2. Latest deployment → **⋯** → **Redeploy**  
3. Wait until status is **Ready**

---

## Step 6 — Confirm env vars are loaded

Open:

https://the-networker-hub.vercel.app/api/auth/config-check

Success looks like:

```json
{
  "authReady": true,
  "canSeedAdmin": true,
  "env": {
    "hasSessionSecret": true,
    "hasAdminSetupSecret": true,
    "hasAdminEmail": true,
    "hasAdminInitialPassword": true,
    ...
  }
}
```

If `hasSessionSecret` is `false`, redeploy again or check variable names are exact.

---

## Step 7 — Create your admin account (once)

In Terminal (use **your** `ADMIN_SETUP_SECRET` and password):

```bash
curl -X POST https://the-networker-hub.vercel.app/api/auth/setup-admin \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "PASTE_ADMIN_SETUP_SECRET_HERE",
    "email": "pips249@gmail.com",
    "password": "PASTE_YOUR_PASSWORD_HERE",
    "name": "Pip"
  }'
```

Expected response:

```json
{ "ok": true, "message": "Admin account created.", "email": "pips249@gmail.com" }
```

Check Airtable **Users** — you should see one row for `pips249@gmail.com` with Role `admin`.

---

## Step 8 — Sign in

- https://the-networker-hub.vercel.app/login  
- Email: `pips249@gmail.com`  
- Password: the one you used in setup-admin  

Admins are redirected to the **Command Center**:  
https://the-networker-hub.vercel.app/admin/dashboard.html

---

## Troubleshooting

### `AUTHENTICATION_REQUIRED` / “Authentication required”

This comes from **Airtable**, not Vercel login. Your `AIRTABLE_API_KEY` in Vercel is missing, wrong, expired, or pasted with extra quotes/spaces.

**Fix:**

1. Open [airtable.com/create/tokens](https://airtable.com/create/tokens) → **Create token** (or edit).
2. Scopes: `data.records:read` + `data.records:write`.
3. Access: base **appQwgOxCrFFNweHe**.
4. Copy the token — it must start with **`pat`**.
5. Vercel → **Environment Variables** → edit **`AIRTABLE_API_KEY`**:
   - Paste **only** the token (no `"` quotes, no spaces before/after).
6. **Redeploy** (Deployments → ⋯ → Redeploy).
7. Check: https://the-networker-hub.vercel.app/api/auth/config-check — `"airtable": { "ok": true }`.

| Problem | Fix |
|---------|-----|
| `Set SESSION_SECRET in Vercel` on login | Add variable, **Redeploy** |
| `authReady: false` on config-check | Compare keys character-for-character |
| `AUTHENTICATION_REQUIRED` | New Airtable `pat` token → update `AIRTABLE_API_KEY` → Redeploy |
| setup-admin `403 forbidden` | `secret` in curl must match `ADMIN_SETUP_SECRET` exactly |
| setup-admin Airtable error | Token needs **write** scope; **Users** table + field names |
| Sign-in fails after setup | Password in curl must match what you type on login page |

---

## Pre-launch site access gate

While the live domain is up but the site is not yet public, lock it behind a shared preview password.

| Key | Value | Notes |
|-----|--------|--------|
| `SITE_ACCESS_PASSWORD` | *your chosen preview password* | When set, the public only sees `/site-access` (waitlist + team unlock). Everyone else needs this shared password. |

**Cookie:** after a correct password, a signed `hub_site_preview` cookie unlocks the site for 7 days (signed with the preview password value).

**Still works without unlocking:** Stripe webhooks, Vercel crons (`CRON_SECRET`), and CSS/JS/assets for the gate page.

**No admin bypass:** signed-in admins must also use the preview password while the gate is on.

**Keeping the site private until launch (~28 August 2026):**
1. Keep `SITE_ACCESS_PASSWORD` set in Vercel Production.
2. Do not set `DISABLE_SITE_ACCESS_GATE=true`.
3. Share the password only with your team.
4. Clear unlocks anytime via `/site-access?lock=1`.

**To open the site publicly:** remove `SITE_ACCESS_PASSWORD` from Vercel → **Redeploy**. No code change needed.

**Preview waitlist:** run migration `109_preview_waitlist.sql` in Supabase. Emails from the launch page are stored in `preview_waitlist` (view in Supabase Table Editor).

After deploy, check `/api/auth/config-check` — `siteAccess.siteAccessRequired` should be `true` while the gate is on.

---

## Optional later

| Key | Purpose |
|-----|---------|
| `RESEND_API_KEY` | Email for forgot-password links |
| `AUTH_DEV_RESET_LINK` | `true` on Preview only — shows reset URL in API (dev) |

See also: `AUTH-SETUP.md`
