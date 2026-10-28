# Hubert Matchmaker — one-pager product spec

**Status:** Draft for decision  
**Owner:** Product  
**Surface:** Attendee dashboard (`/account/`) + Hubert (chat + email)  
**v1 scope:** Platform-wide people discovery (not event-only)

---

## Problem

Networkers book events on The Networker UK but still struggle to find the *right people* — before, at, or between events. LinkedIn is noisy; event guest lists (when they exist) dump contacts without consent. We need a trusted, opt-in way to say “who I want to meet” and get intros.

## Goal

Hubert becomes the Hub’s matchmaker: members opt in, describe who they are / who they’re looking for, search the platform, and request connections. Contact details are shared only after the other person accepts.

**Success (v1):** Opted-in supply grows; connection requests are sent and accepted; spam/complaints stay near zero.

---

## Why start platform-wide (not event-scoped)

| Choice | Why |
|--------|-----|
| **Start global** | Matches the Boardy-style “who do you want to meet?” intent; useful between events; one mental model |
| **Still show next event** | On result cards when the person has an upcoming booking and is discoverable — context without limiting the pool |
| **Trade-off** | Early search can feel thin until opt-in density rises — mitigate with checkout prompts, Hubert nudges, and structured tags (easy to complete) |

Event-scoped “who’s going to X” remains a **v1.1** filter/tab on top of the same opt-in pool, not a separate product.

---

## Principles

1. **Opt-in only** — default off; easy to turn off anytime.  
2. **No public contact details** — never show phone or email in search/results, even if someone wants to be “open.”  
3. **Double opt-in intros** — details reveal only when B accepts A’s request.  
4. **Hubert is the face** — copy, chat entry, and emails come from Hubert; matching rules stay simple and auditable.  
5. **Tags over essays** — reliable filters without requiring long bios.

---

## v1 product

### Profile (discoverability pack)

Shown in account settings + short Hubert onboarding:

| Field | Required for discoverable? | Notes |
|-------|----------------------------|--------|
| Display name | Yes | Existing `attendees.name` |
| Company / job title | Encouraged | Existing |
| **Industry** (tag) | Yes | Reuse / extend existing industry list |
| **I am a** (tag) | Yes | e.g. Founder, Recruiter, Investor, Service provider |
| **Looking to meet** (tag(s)) | Yes | e.g. Clients, Co-founders, Suppliers, Investors |
| Short headline (one line) | Optional | Better results; not a long bio |
| LinkedIn URL | Optional | Paste only in v1 — no scraping |
| Location / country | Optional | Existing; useful filter |
| **Discoverable** toggle | Yes | Master opt-in |

**Out of searchable profile:** phone, email, calendar OAuth.

### Search (attendee dashboard + Hubert)

- Entry points: `/account/` “Meet people” (or Hubert: “Who would you like to meet?”).  
- Filters: industry, I am a, looking to meet, location/keywords on headline.  
- Results (discoverable members only): name, company/title, tags, headline, **next upcoming event** (if any), CTA **Request connection**.  
- Soft reciprocity (recommended): searching while not discoverable shows a Hubert prompt to opt in (blur or limited results until they do).

### Connection request (double opt-in)

1. A finds B → **Request connection**.  
2. Mandatory: “What would you like to discuss?” (short text).  
3. B gets **Hubert email** + dashboard notification: message + **Accept & share details** / **Decline**.  
4. On Accept: A sees B’s email (and LinkedIn URL if set). Phone only if we add an explicit “share phone on accept” field later — **not in v1**.  
5. On Decline / ignore: A sees polite closed state; no contact reveal.  
6. Rate limits: e.g. N pending requests per day; block/report path.

### Hubert’s role

- Voice of opt-in prompts, search, and intro emails.  
- Weekly concierge can later mention “people who match your tags” (post-v1 ok).  
- Does **not** auto-email strangers without an explicit request from A.

---

## Acquisition / cold start (platform-wide)

| Lever | Action |
|-------|--------|
| Ticket checkout / RSVP | 1-click: “Include my profile so other Hub members can request an intro via Hubert” |
| Profile checklist | Industry + I am a + Looking to meet + Discoverable = “networking profile complete” |
| Hubert chat / widget | “Turn on matching” short flow |
| Soft gate on search | Opt in to see full results |
| Organisers (later) | Promote Discover for their members — secondary |

**LinkedIn:** paste URL in v1. Optional later: Sign in with LinkedIn to **prefill** name/headline — user confirms tags. **No profile scraping.**

**Calendar:** out of scope for v1. After accept, users can share a booking link themselves if they want. Full Google/Microsoft calendar OAuth is a later experiment only.

---

## Explicitly out of scope (v1)

- Public phone/email on profiles  
- Scraping LinkedIn  
- Calendar read access  
- Full Boardy-style free-text AI ranking (tags + filters first; NL on top later)  
- Event-only guest lists as the only mode (global first; event filter in v1.1)  
- Charging for intros (monetisation after proof)

---

## Build sketch (reuse existing Hub)

| Layer | Reuse | New |
|-------|--------|-----|
| Auth / account | Session, `/account/`, settings | Discoverability fields + Meet UI |
| Profile | `attendees` industry, role, company, location | Tags, headline, LinkedIn URL, `discoverable_at` |
| Next event | Registrations / dashboard stats | Expose next event on **others’** cards when discoverable |
| Email | Resend + templates (opportunity enquiry pattern) | `hubert-connection-request` / accepted templates |
| Hubert | Widget, tone, concierge brand | Intents + copy for match / opt-in |

---

## Metrics

- % of active members with `discoverable` on  
- % with all required tags complete  
- Connection requests sent / accept rate / decline rate  
- Time-to-first-accept  
- Abuse: blocks, reports, rate-limit hits  
- Qualitative: “met someone useful via Hubert”

---

## Open decisions

1. Soft-gate search (must be discoverable to browse) — **recommend yes**.  
2. Share on accept: email only vs email + LinkedIn — **recommend both if LinkedIn set**.  
3. Naming in UI: “Meet people” vs “Ask Hubert to introduce you” — brand preference.  
4. Whether checkout opt-in copies event attendance into a future “also show on this event’s list” flag (prep for v1.1) — **recommend store the same discoverable flag; add event filter later**.

---

## One-line summary

**Hubert-led, platform-wide, tag-based people search with double opt-in intros — no public contact details, no LinkedIn scrape, no calendar OAuth in v1; next event is context on the card, not the boundary of the product.**
