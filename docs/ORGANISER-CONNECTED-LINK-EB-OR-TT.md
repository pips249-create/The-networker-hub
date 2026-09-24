# How to link a TNH event to Eventbrite **or** Ticket Tailor

One TNH listing → **one** checkout platform. Eventbrite and Ticket Tailor do not connect to each other; both send orders to The Networker UK using the steps below.

## Before you start

1. **Connected plan** — `/organiser/connected-booking` (subscribe or complimentary pilot).
2. **Organiser page on Connected** — workspace **Organiser pages** → tick your group(s) → **Save assignment** (Starter = 1 page).

---

## Choose the platform (this event only)

1. Open the event → **Set up tickets**.
2. **Connected booking** → **Where do people book?** → pick **Eventbrite**, **Ticket Tailor**, or **Your own website**.
3. **Continue to Connected setup →**

---

## One-time account setup

Do once per platform you use (not once per event).

### Eventbrite

| Step | Where |
|------|--------|
| Enable + copy webhook | TNH **Connected booking → Booking providers** or Connected setup → Enable **Eventbrite** |
| Paste webhook | Eventbrite **Account settings → Webhooks** · URL `https://www.thenetworkeruk.com/w/eb/…` · Action **`order.placed`** |
| Private token | Connected setup → **Save API token** (Eventbrite Developer links) |

### Ticket Tailor

| Step | Where |
|------|--------|
| Enable + copy webhook | Enable **Ticket Tailor** → URL `https://www.thenetworkeruk.com/w/tt/…` |
| Paste webhook | Ticket Tailor **Settings → Webhooks** · **Order created** (`ORDER.CREATED`) |
| API key (optional) | Box office **Settings → API** → Save on Connected setup — **listing import only**; webhooks do not need it |

You can enable **both** on one account if some events use Eventbrite and others Ticket Tailor.

---

## This event: checkout + link registrations

On **Connected setup** for the event:

| | Eventbrite | Ticket Tailor |
|---|------------|---------------|
| **Booking URL** | Eventbrite `/e/…` or checkout link | Ticket Tailor event/checkout URL |
| **Provider event id** | Numeric id (use **Use id from booking URL** if offered) | **`ev_…`** from Box office — **not** the URL slug |
| **Display price on TNH** | e.g. `From £15` or `Free` | Same |
| **Save** | **Save link for this event** | Same |

Optional: tick **copy title, date, venue when I save the link** (Eventbrite needs token; Ticket Tailor needs API key for import).

**Publish** the TNH listing.

---

## Check it worked

- **Connected booking → Recent sync attempts** — `eventbrite:accepted` or `ticket_tailor:accepted`
- **Attendees** on the event after a paid test order

---

## More detail

- [TICKET-TAILOR-CONNECTED.md](./TICKET-TAILOR-CONNECTED.md)
- [CONNECTED-BOOKING-PILOT-TEST.md](./CONNECTED-BOOKING-PILOT-TEST.md)
- [CONNECTED-BOOKING-PROVIDERS.md](./CONNECTED-BOOKING-PROVIDERS.md)
