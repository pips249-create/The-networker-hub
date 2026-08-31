# Legacy Airtable → Supabase mapping

Historical mapping from the original Airtable base. The live Hub is **Supabase-only**.

| Airtable (legacy) | Supabase table | Notes |
|-------------------|----------------|-------|
| Users | `auth.users` + `hub_accounts` | Role: `admin` / `client`; hub mode in `hub_view` |
| Organisers (group profiles) | `organisers` | `listing_status`: draft / published / unpublished |
| Events | `events` | Public when `approval_status = 'Approved'` |
| Tickets | `tickets` | `event_id` FK |
| Attendee profile | `attendees` | `supabase_user_id` → auth |
| Bookings | `registrations` | |
| Reviews | `reviews` | Rating trigger on `events` |
| Training sessions | `workshops` | Training browse (later) |

One-off import: `migrate.js` + `scripts/MIGRATE.md` (requires local `AIRTABLE_*` only for that script).

## Auth model

Uses **[Supabase Auth](https://supabase.com/docs/guides/auth)** (`auth.users`), not a custom password table.

- `organisers.supabase_user_id` → organiser dashboard
- `attendees.supabase_user_id` → attendee dashboard
- `hub_accounts` → platform admin + Attendee/Organiser nav toggle

## Event visibility

| Layer | Field | Public when |
|-------|--------|-------------|
| Event | `approval_status` | `Approved` |
| Organiser | `listing_status` | not `draft` / `unpublished` |
