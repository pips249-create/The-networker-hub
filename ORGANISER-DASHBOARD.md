# Organiser dashboard & dual-role (attendee + organiser)

One login can **browse and buy tickets** (attendee) and **manage organiser profiles, events, and ticket types** (organiser). Use the **Attendee / Organiser** toggle in the site nav to switch modes.

## How roles work (no separate accounts)

| Concept | Where it lives |
|--------|----------------|
| Login | Supabase Auth + `hub_accounts` (`role`: `admin` / `client`) |
| Organiser brand/profile | `organisers` table |
| Attendee behaviour | Browse `/events/`, book tickets (same session) |
| Organiser behaviour | `/organiser/` dashboard |

**hub_accounts.role** is `client` (browse/book + organiser toggle) or `admin` (Command Center). Access to the organiser dashboard is tied to your account and **organisers** rows linked to you — not a separate organiser role.

Admins still use `role = admin`.

## Data model (Supabase)

| Table | Purpose |
|-------|---------|
| `organisers` | Group / brand profiles (`listing_status`: draft / published / unpublished) |
| `events` | Events linked to an organiser; public when approved |
| `tickets` | Ticket tiers per event |

## Mode switch (UI)

- Cookie: `hub_view=attendee` | `organiser`
- API: `POST /api/auth/hub-mode` with `{ "mode": "attendee" | "organiser" }`
- **Attendee** → `/events/`
- **Organiser** → `/organiser/`

Session API (`GET /api/auth/session`) returns `hubView` and `organiserProfiles` (count of linked organiser rows).

## API routes

| Route | Purpose |
|-------|---------|
| `/api/organiser/bootstrap` | Dashboard data |
| `/api/organiser/groups` | List / create organiser profiles |
| `/api/organiser/events` | Create / update events |
| `/api/organiser/tickets` | Ticket tiers |

See `SUPABASE-SETUP.md` for env vars.
