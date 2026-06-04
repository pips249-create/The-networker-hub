# Import users without sending email

## Default behaviour (this project)

- **Spreadsheet import** → use `scripts/import-attendees-csv.js` → rows go to **`attendees` only** → **no email**
- **Admin / migrate / register API** → `auth.admin.createUser` with **`email_confirm: true`** → marks email verified → **no signup confirmation email**
- **Forgot password** → **does not email** unless you set `AUTH_SEND_EMAILS=true`
- **Resend** (optional) → only used when `AUTH_SEND_EMAILS=true` and `RESEND_API_KEY` is set

## Supabase dashboard (do once)

1. [Authentication → Providers → Email](https://supabase.com/dashboard/project/uztgzbjrmjbonfniyqcu/auth/providers)
2. Turn **off** “Confirm email” (so public sign-up does not send verification mail)
3. Do **not** use **Invite user** in the dashboard for bulk import

## Environment variables (Vercel + local.env)

```env
# Leave unset or false — no auth emails from the app
# AUTH_SEND_EMAILS=false

# Optional: shared password if you later import logins (not recommended for production)
# IMPORT_DEFAULT_PASSWORD=
```

To **allow** password-reset emails later: `AUTH_SEND_EMAILS=true` and configure Supabase SMTP or Resend.

## Import Excel / CSV (recommended)

1. Save Excel as **CSV** with columns: `email`, `name`
2. Run:

```bash
cd ~/Desktop/The-networker-hub
/Applications/Cursor.app/Contents/Resources/app/resources/helpers/node scripts/import-attendees-csv.js ~/Desktop/your-users.csv
```

No Auth users are created → **no Supabase auth emails**.

## If you need logins later (still no email)

Use admin API only (`email_confirm: true`), e.g. `seed-admin` or `migrate.js` — never “Invite user” in the dashboard.
