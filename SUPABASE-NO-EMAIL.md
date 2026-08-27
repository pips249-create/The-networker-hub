# Import users without sending email

## Default behaviour (this project)

- **Spreadsheet import** → use `scripts/import-attendees-csv.js` → rows go to **`attendees` only** → **no email**
- **Admin / migrate / register API** → `auth.admin.createUser` with **`email_confirm: true`** → marks email verified → **no signup confirmation email**
- **Forgot password** → sends via Resend when `RESEND_API_KEY` is set (set `AUTH_SEND_EMAILS=false` to force off)
- **Resend** → required for password-reset and other transactional mail

## Supabase dashboard (do once)

1. [Authentication → Providers → Email](https://supabase.com/dashboard/project/uztgzbjrmjbonfniyqcu/auth/providers)
2. Turn **off** “Confirm email” (so public sign-up does not send verification mail)
3. Do **not** use **Invite user** in the dashboard for bulk import

## Environment variables (Vercel + local.env)

```env
# Optional kill switch — leave unset so password reset works whenever Resend is configured
# AUTH_SEND_EMAILS=false

# Optional: shared password if you later import logins (not recommended for production)
# IMPORT_DEFAULT_PASSWORD=
```

Password-reset emails send when `RESEND_API_KEY` is set unless you explicitly set `AUTH_SEND_EMAILS=false`.

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
