# Organiser dashboard & dual-role (attendee + organiser)

One login can **browse and buy tickets** (attendee) and **manage organiser profiles, events, and ticket types** (organiser). Use the **Attendee / Organiser** toggle in the site nav to switch modes.

## How roles work (no separate accounts)

| Concept | Where it lives |
|--------|----------------|
| Login | **Users** table (`Email`, `Password Hash`, `Role`) |
| Organiser brand/profile | **Organisers** table (`Organiser Name`, `Email`, **Users** link, `Events` links) |
| Attendee behaviour | Browse `/events/`, book tickets (same session) |
| Organiser behaviour | `/organiser/` dashboard |

**Users.Role** is `client` (browse/book + organiser toggle) or `admin` (Command Center). Access to the organiser dashboard is tied to your **Users** record and **Organisers** rows linked to you — not a separate organiser role.

Admins still use `Role = admin`.

## Your existing Organisers table

The dashboard uses your **Organisers** table (not a separate “Organiser Groups” table).

### Required / recommended fields

| Field | Purpose |
|-------|---------|
| **Organiser Name** | Profile name (shown in dashboard) |
| **Email** | Matched to login email (fallback ownership) |
| **Users** | Link to **Users** table — **primary ownership** (as in your base) |
| **Description** | Optional profile text |
| **Events** (or Events 2 / Events 3) | Linked events for that profile |

### Events table

Add or confirm a **link to Organisers** on each event, e.g.:

- Field name: `Organisers` (preferred), or `Organiser`, `Host/Organiser`, etc.

The API auto-detects the link field from your first event row.

### Tickets table

| Field | Purpose |
|-------|---------|
| **Linked Event** | Link to Events |
| **Ticket Type** / Ticket Name | Tier label |
| **Price** | Number (0 = free) |
| **Status** | e.g. Available |

## Airtable checklist for Pip’s Test row

1. Open **Organisers → Pip's Test**.
2. Set **Users** → link to the **Users** row for `pips249@gmail.com`.
3. Ensure **Email** = `pips249@gmail.com` (helps matching).
4. Link **Events** on that row (or link **Organisers** on each Event record).

## Environment (Vercel)

```bash
AIRTABLE_ORGANISERS_TABLE=Organisers
AIRTABLE_EVENTS_TABLE=Events
AIRTABLE_TICKETS_TABLE=Tickets
```

(Remove or ignore `AIRTABLE_ORGANISER_GROUPS_TABLE` if you added it earlier.)

## Mode switch (UI)

- Cookie: `hub_view=attendee` | `organiser`
- API: `POST /api/auth/hub-mode` with `{ "mode": "attendee" | "organiser" }`
- **Attendee** → `/events/`
- **Organiser** → `/organiser/`

Session API (`GET /api/auth/session`) returns `hubView` and `organiserProfiles` (count of linked Organisers rows).

## API routes

| Route | Purpose |
|-------|---------|
| `/api/organiser/bootstrap` | Dashboard data |
| `/api/organiser/groups` | List / create **Organisers** profiles |
| `/api/organiser/events` | List / create events |
| `/api/organiser/tickets` | List / create ticket types |

All require sign-in (any role except blocked accounts).

## What you do **not** need

- A second user account for organising vs attending
- Legacy roles `attendee` / `organiser` / `member` in Airtable are treated as `client`
- A new “Organiser Groups” table if **Organisers** already exists
