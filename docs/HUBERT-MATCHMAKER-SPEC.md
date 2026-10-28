# Hubert Matchmaker — one-pager product spec

**Status:** Approved for build (admin-only until launch)  
**Owner:** Product  
**Surfaces:** Attendee dashboard (`/account/`), public teaser entry on the site, Hubert (chat + email)  
**Phase 1:** Member-gated search · back-of-house matching · capped shortlist · open invite to non-members · Rosie/ops private seed  
**Phase 2:** Members-first discovery (seed used less as density grows)

### Build visibility (non-negotiable while shipping)

Until product explicitly turns Matchmaker on for everyone:

- **UI, search, teaser, and Hubert meet intents are admin-only** (Hub admin / platform staff).
- Regular attendees and logged-out visitors must **not** see the search bar, Meet people nav, or public teaser as a live feature.
- Intro emails to real B’s stay **off or staff-triggered only** until soft launch (avoid accidental outbound while testing).
- Prefer a single feature flag (e.g. `hubert_matchmaker` / admin gate) so we can flip visibility without a redesign.

Implementation branch: `cursor/hubert-matchmaker-8ac8` (off `main` after this spec).

**Build progress**
1. ~~Feature flag + admin gate~~ · dashboard **Meet people** + Overview Hubert ask strip (admin-only), stub shortlist (max 5, first name + initial, event-first matches)
2. ~~Private seed + nominate (ops)~~ · Admin → Hubert Matchmaker seed list (migration `332_hubert_match_seed.sql`)
3. ~~Real BOH match API~~ · `/api/auth/hubert-matchmaker` (admin-gated; seed + discoverable members; max 5; no contacts)
4. Request intro → Hubert email → Accept/Decline · **no contact share** · Hub intro thread · persist + count — next
5. **Introduce someone to The Networker UK & Hubert** (member Hub-invite CTA — UI shell in place)
6. Intro tracking surfaces (admin totals + member “My intros”)
7. Public site teaser (still gated until launch)

---

## Problem

Networkers book events on The Networker UK but still struggle to find the *right people* — before, at, or between events. Guest lists (when they exist) dump contacts without consent; LinkedIn is noisy. We need Hubert-led intros that grow membership and stay trustworthy.

## Goal

Hubert is the Hub’s matchmaker. Logged-in members describe who they want to meet; we match **back of house** and show a **short shortlist** (not a browsable directory of everyone). Requesting an intro emails B; B must create/sign in to Accept or Decline.

**Contact details are never shared via Hubert** — not email, phone, or LinkedIn. Accept opens a **Hubert-mediated introduction** on the Hub (and event context when both are going). That keeps the Hub sticky, safer under GDPR, and stops Matchmaker becoming a lead-scraping tool.

**Success (Phase 1):** Intro requests sent; B’s create accounts and Accept; seed cohort from Rosie converts; spam/complaints near zero.

---

## Principles

1. **Account required to search** — no anonymous people search; membership is the gate.  
2. **Back-of-house matching** — A does not browse the full seed or member graph.  
3. **Capped shortlist** — max **5** people put forward per search.  
4. **Privacy on the shortlist** — show **first name + surname initial** only (e.g. `Jane S.`), not full legal name.  
5. **No contact details via Hubert** — never show phone, email, or LinkedIn on shortlists **or** after Accept.  
6. **Double opt-in** — Accept opens a Hubert-mediated intro on the Hub, not a contact dump.  
7. **Hubert is the face** — search UX, emails, and invites use Hubert’s voice.  
8. **Rosie/ops seed is curated** — manual blurbs (LI as research aid); **no LinkedIn scraping**.  
9. **Upcoming event is primary card context** — when B is attending something, that sits alongside the intro CTA.  
10. **Invite to the Hub** — members can introduce someone to The Networker UK & Hubert (growth), separate from a match intro.

---

## Phasing

| Phase | Matching pool | What A sees | Growth lever |
|-------|---------------|-------------|--------------|
| **1 – Open intros** | Discoverable members **+** private Rosie/ops seed | Up to 5 shortlist cards; non-members labelled as “not on the Hub yet” | B must join to respond → membership |
| **2 – Members-first** | Prefer / default to discoverable members | Same UX; seed only to fill gaps or via explicit “invite someone you know” | Density from Phase 1 Accepts |

Say this upfront in product copy so closing the loop later is not a surprise: *while we’re growing, Hubert may invite people who aren’t members yet; as the network fills, discovery focuses on members.*

---

## Entry points

### 1. Attendee dashboard (primary product)

- Dedicated **Meet people / Ask Hubert** area on `/account/` with the search bar.  
- Hubert chat on account can route “who should I meet?” into the same flow.

### 2. Elsewhere on the site (interest / acquisition)

- Public teaser (e.g. home, `/for-networkers`, events browse): search-bar **lookalike** or “Ask Hubert who you’d like to meet.”  
- Guests can type intent / see the promise; **running a real search requires sign-in / create account**.  
- CTA: *Create a free account to see matches and request intros.*

### 3. Checkout / RSVP (supply)

- 1-click: include me so Hubert can put me forward for intros (discoverable / seed claim path as designed).

---

## Phase 1 product

### A — Search (member only)

1. A is signed in and has remaining **search quota**.  
2. A enters who they want (tags and/or short natural ask + mandatory “what I’d like to discuss” before send).  
3. System matches **BOH** against discoverable members + private seed.  
4. A sees **at most 5** cards (see card layout below).  
5. A selects who to request (also **intro-request capped** per week).

**Soft reciprocity (recommended):** if A is not discoverable, Hubert nudges them to complete tags + opt in (full shortlist or higher limits after).

### Shortlist card layout

| Element | Rule |
|---------|------|
| Name | **First name + surname initial only** (e.g. `Alex M.`) — full name only inside the private Hubert intro thread after Accept |
| Role / company | Yes, if we have them |
| Tags / why matched | Short line from matcher |
| **Upcoming event** | **Primary feature when present** — event name + date sits with equal weight to the intro action (“You’ll both be at X” / “Alex is going to X”) |
| Hub status | Member vs “Hubert can invite them to join” |
| CTA | **Request intro** |

If there is no upcoming event, omit that block; do not invent one. Event presence should **rank / prefer** candidates when quality is otherwise equal (same room > cold intro).

### B — Intro email (join to respond)

1. A requests intro → Hubert emails B.  
2. Copy pattern: *“[First name] would like to connect about [topic]. Create a free Networker UK account to see the request and Accept or Decline.”*  
3. B lands on claim/sign-in → sees full request context → **Accept introduction** / **Decline**.  
4. On Accept (especially non-member B): **2 quick tag taps** — Industry / I am a, and Looking to meet. No essay fields.  
5. **No email / phone / LinkedIn exchange.** Both parties get a Hubert intro on the Hub: topic, first names, role/company, and shared/upcoming event if any — plus a short in-Hub message thread (or “meet at [event]” prompt).  
6. Prompt **Discoverable** on so B becomes supply for future searches.  
7. Decline / ignore: no intro thread. Seed path: one reminder (day 5–7), then pause in BOH.

### Introduce someone to The Networker UK & Hubert

Separate from “Ask Hubert to introduce you” (match someone already in the pool):

| | |
|--|--|
| **Where** | Meet people page + Overview Hubert panel (and later public teaser) |
| **CTA** | **Introduce someone to The Networker UK & Hubert** |
| **Flow** | Member enters name + email (+ optional note) → Hubert emails them an invite to join / turn on matching |
| **Quota** | Separate soft cap (e.g. **5 Hub invites / week**) so it isn’t spam |
| **Why** | Grows membership without scraping; every invite can mint a future discoverable member |

This is a **platform invite**, not a request to meet A. After they join, they can become discoverable and appear in shortlists like anyone else.

### Private seed (Rosie / ops) — Phase 1 cold start

**Yes — Admin / Command Centre is where Rosie’s seed people are added** (not the public site, not attendee self-serve).

| Surface | Role |
|---------|------|
| **Admin → Hubert Matchmaker → Seed list** | Rosie / Catherine / platform admins add or edit seed contacts: name, company, role, email, LinkedIn URL, short blurb, pause/active |
| **Admin intro totals** | Same Matchmaker admin area shows requested / accepted / pending counts |
| Attendee Meet people | Uses seed **only** via BOH shortlist — members never browse or edit Rosie’s list |

| Allowed | Not allowed |
|---------|-------------|
| Manual nominate in admin (LI About as **Rosie’s** research aid when she pastes a blurb) | Bulk scrape of LinkedIn connections or bios |
| Use seed **only** in BOH matching + capped shortlist | Public directory of non-consenting people |
| Higher **staff** nominate / outreach quota in Phase 1 | Auto-refresh bios from LinkedIn |

After Accept, B owns and edits their Hub profile text.

**Rosie’s LinkedIn** = distribution + human-curated seed entered in admin, not an automated import pipe.

---

## Profile fields (after claim / for discoverable members)

| Field | Required for discoverable? | Notes |
|-------|----------------------------|--------|
| Name | Yes | Full name stored; **shortlist shows first + initial** |
| Company / job title | Encouraged | Existing |
| **Industry** (tag) | Yes | Existing list where possible |
| **I am a** (tag) | Yes | Founder, Recruiter, Investor, Service provider, … |
| **Looking to meet** (tag(s)) | Yes | Clients, Co-founders, Suppliers, Investors, … |
| Short blurb / headline | Encouraged | Confirmed by user; seed blurb is a starting point only |
| LinkedIn URL | Optional | Paste / confirm — no scrape |
| Location / country | Optional | Existing |
| **Discoverable** | Yes | Opt-in to be put forward in shortlists |

**Never via Hubert intros:** phone, email, LinkedIn URL (even after Accept). LinkedIn on profile is optional for the member’s own settings only — not passed to the other party by us.  
**Out of Phase 1:** calendar OAuth.

---

## Product guards (limits & privacy)

| Guard | Rule |
|-------|------|
| **Pre-launch visibility** | **Admins only** until launch flag is on |
| Search | Account required (and admin during build); soft reciprocity — tags + discoverable before full search |
| Results per search | **Max 5** people put forward |
| Search quota (members) | **3 searches / week** |
| Intro requests (members) | **5 intro requests / week** (not more to start — see Quotas) |
| Staff / Rosie | Higher seed nominate + reminder quotas (not bound by the member 5) |
| Intent field | **≥ 25 characters** on “what I’d like to discuss”; soft-reject generics (“hi”, “networking”, “sales”) |
| Shortlist identity | **First name + surname initial** only |
| Contact after Accept | **None** — Hubert-mediated Hub intro / thread only |
| Hub invite (“Introduce someone…”) | Name + email → Hubert join invite; not a contact reveal to the inviter |
| Seed non-response | **1** Hubert reminder at day 5–7; then **pause** in BOH pool |
| Prefer | Tiered event boost: same event > B has another upcoming event > cold |

### Quotas — do we want more than 5 intros / week?

**Not at launch.** **5 intro requests / week** for members is the locked default:

- Enough for 1–2 real connections around an event  
- Stops Hubert becoming a free lead-scraping tool  
- We can raise later (e.g. 8–10) if accept rates stay healthy and abuse is low  

**Separate from member intros:** Rosie/admin seed outreach is staff tooling with its own higher limits.

---

## Hubert’s role

- Face of dashboard search, public teaser, and all intro/invite emails.  
- Does **not** email B unless A explicitly requests that intro.  
- Weekly concierge may later mention match opportunities (optional post–Phase 1).

---

## Explicitly out of scope (Phase 1)

- Public phone/email on any card  
- Full name on shortlist before Accept  
- Scraping LinkedIn (connections or bios)  
- Calendar read access  
- Unlimited browse of the seed graph  
- Charging for intros (monetise after proof)

---

## Build sketch (reuse existing Hub)

| Layer | Reuse | New |
|-------|--------|-----|
| Auth / account | Session, `/account/`, register/login | Gate search; B claim/Accept page |
| Profile | `attendees` fields | Tags, blurb, LinkedIn URL, `discoverable_at` |
| Seed | — | Private seed table + **Admin Matchmaker UI** for Rosie/ops |
| Matching | Tags / text | BOH matcher → max 5; event boost from registrations |
| Events | Bookings / next-event stats | Upcoming event as **primary** shortlist field when present |
| Email | Resend + templates (enquiry pattern) | Hubert invite-to-join + Accept/Decline templates |
| Site teaser | Marketing pages | Search CTA that forces account for real results |
| Hubert | Widget, tone | Meet intents + copy |

---

## Intro tracking (required)

Every intro is a row we can count — not just an email send.

### What we store (per intro)

| Field | Purpose |
|-------|---------|
| `id` | Primary key |
| Requester (A) | Hub user / attendee id |
| Target (B) | Member id **or** seed id + email |
| Status | `pending` · `accepted` · `declined` · `expired` · `blocked` |
| Topic / message | “What would you like to discuss?” |
| Timestamps | created · emailed · responded · accepted |
| Source | `search` · `nominate` · `overview` · `staff` |
| Event context (optional) | Upcoming event id if shown on the card |

**“Introductions done”** = status `accepted` (successful double opt-in).  
Also report **requested** (all sends) and **pending** for ops.

### Where people see the numbers

| Surface | Who | What |
|---------|-----|------|
| **Admin → Hubert Matchmaker** | Rosie / platform admins | **Seed list** (add Rosie’s contacts) · intro totals (requested / accepted / declined / pending) · accept rate · recent intros |
| **Meet people** (`#meet`) | The signed-in member | “My intros”: requested · pending · accepted (their outbound + inbound) |
| **Overview** (optional strip) | Member | Small line under Hubert: e.g. `3 intros accepted` once they have any |
| **Email / ops** | Staff | Same admin totals for weekly Hub health |

Do **not** show other people’s intro counts on public profiles.

### Build note

Ship the `hubert_intro_requests` (name TBD) table in the same slice as Request intro / Accept — counters are queries over that table, not a separate analytics product.

---

## Edge-case guards (locked)

1. **Intent validation** — ≥ 25 characters; soft-reject generics (“hi”, “networking”, “sales”).  
2. **Rosie seed follow-ups** — exactly **1** polite reminder at day 5–7, then auto-pause in BOH if still unaccepted.  
3. **Non-member B onboarding** — 2 quick taps (industry/role + looking to meet) before the Hubert intro thread opens.  
4. **Soft reciprocity** — A must set networking tags (+ discoverable) before running full searches.

## Locked defaults

| Decision | Locked choice |
|----------|----------------|
| Member quotas | **3 searches / week**, **5 intro requests / week** (+ separate Hub invite cap) |
| Placements | Dashboard (Overview + Meet) · public teaser on **Home** and **Event browse** |
| UI framing | **“Ask Hubert to introduce you”** (concierge) + **“Introduce someone to The Networker UK & Hubert”** |
| Event boost | Same event > B attending another event > cold |
| After Accept | **No contact details** — Hubert-mediated Hub intro / thread only |
| Admin seed | **Admin Matchmaker → Seed list** (Rosie/ops) |
| Admin metrics | Dedicated **Matchmaker** block (intros + seed health) |

## Metrics (phased)

**Phase 1 (ship with intros)**  
- Intro funnel: requested / pending / accepted / declined  
- Shared-event vs cold **Accept %**  
- Search → ticket conversion (match showed event X → ticket for X within **48h**)

**Phase 2 (when volume exists)**  
- Shared-event check-in / show-up rate  
- Retention cohorts (≥1 accepted intro vs 0)  
- Organiser UTM / Hub adoption from Hubert promo links  

---

## One-line summary

**Ask Hubert to introduce you — no contact details ever exchanged; Accept opens a Hubert Hub intro; members can also introduce someone to The Networker UK & Hubert; quotas 3 searches / 5 intros per week; Rosie seeds in Admin; BOH shortlist max five; Phase 1 metrics = funnel + shared-event Accept % + search-to-ticket.**
