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
1. ~~Feature flag + admin gate~~ · dashboard **Meet people** search shell (`#meet`, admin-only) with stub shortlist (max 5, first name + initial, upcoming event primary on cards)
2. Private seed + nominate (ops) — next
3. Real BOH match API
4. Request intro → Hubert email → B join to Accept/Decline
5. Public site teaser (still gated until launch)

---

## Problem

Networkers book events on The Networker UK but still struggle to find the *right people* — before, at, or between events. Guest lists (when they exist) dump contacts without consent; LinkedIn is noisy. We need Hubert-led intros that grow membership and stay trustworthy.

## Goal

Hubert is the Hub’s matchmaker. Logged-in members describe who they want to meet; we match **back of house** and show a **short shortlist** (not a browsable directory of everyone). Requesting an intro emails B; B must create/sign in to Accept or Decline. Contact details are shared only after Accept.

**Success (Phase 1):** Intro requests sent; B’s create accounts and Accept; seed cohort from Rosie converts; spam/complaints near zero.

---

## Principles

1. **Account required to search** — no anonymous people search; membership is the gate.  
2. **Back-of-house matching** — A does not browse the full seed or member graph.  
3. **Capped shortlist** — max **5** people put forward per search.  
4. **Privacy on the shortlist** — show **first name + surname initial** only (e.g. `Jane S.`), not full legal name.  
5. **No public contact details** — never show phone or email before Accept.  
6. **Double opt-in** — details reveal only when B accepts.  
7. **Hubert is the face** — search UX, emails, and invites use Hubert’s voice.  
8. **Rosie/ops seed is curated** — manual blurbs (LI as research aid); **no LinkedIn scraping**.  
9. **Upcoming event is primary card context** — when B is attending something, that sits alongside the intro CTA.

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
| Name | **First name + surname initial only** (e.g. `Alex M.`) — full name only after Accept (or on B’s own claimed profile) |
| Role / company | Yes, if we have them |
| Tags / why matched | Short line from matcher |
| **Upcoming event** | **Primary feature when present** — event name + date sits with equal weight to the intro action (“You’ll both be at X” / “Alex is going to X”) |
| Hub status | Member vs “Hubert can invite them to join” |
| CTA | **Request intro** |

If there is no upcoming event, omit that block; do not invent one. Event presence should **rank / prefer** candidates when quality is otherwise equal (same room > cold intro).

### B — Intro email (join to respond)

1. A requests intro → Hubert emails B.  
2. Copy pattern: *“[First name] would like to connect about [topic]. Create a free Networker UK account to see the request and Accept or Decline.”*  
3. B lands on claim/sign-in → sees full request context → **Accept & share details** / **Decline**.  
4. On Accept: A gets B’s email (+ LinkedIn URL if set); names can show in full in the private thread/result.  
5. On Accept: prompt B to confirm bio/tags + **Discoverable** (they become supply for the next search).  
6. Decline / ignore: no contact reveal; pause further intros to the same seed contact after repeated non-response.

### Private seed (Rosie / ops) — Phase 1 cold start

| Allowed | Not allowed |
|---------|-------------|
| Manual nominate: name, company, role, email, LinkedIn URL, short blurb Rosie pastes/edits (LI About as **her** research aid) | Bulk scrape of LinkedIn connections or bios |
| Use seed **only** in BOH matching + capped shortlist | Public directory of non-consenting people |
| Higher staff nominate quota in Phase 1 | Auto-refresh bios from LinkedIn |

After Accept, B owns and edits their Hub profile text.

**Rosie’s LinkedIn** = distribution + human-curated seed, not an automated import pipe. She can also DM/post invite links; Hubert scales the email Accept loop.

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

**Never before Accept:** phone, email.  
**Out of Phase 1:** calendar OAuth.

---

## Product guards (limits & privacy)

| Guard | Rule |
|-------|------|
| **Pre-launch visibility** | **Admins only** until launch flag is on |
| Search | Account required (and admin during build) |
| Results per search | **Max 5** |
| Search quota | Per day/week (TBD numbers) |
| Intro requests | Cap pending / per week |
| Shortlist identity | **First name + surname initial** only |
| Contact | Email (+ LinkedIn if set) only after Accept |
| Non-response | Pause seed contacts who never Accept |
| Prefer | Candidates with an **upcoming shared/relevant event** when scores are close |

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
| Seed | — | Private seed table (ops-curated); not public API list |
| Matching | Tags / text | BOH matcher → max 5; event boost from registrations |
| Events | Bookings / next-event stats | Upcoming event as **primary** shortlist field when present |
| Email | Resend + templates (enquiry pattern) | Hubert invite-to-join + Accept/Decline templates |
| Site teaser | Marketing pages | Search CTA that forces account for real results |
| Hubert | Widget, tone | Meet intents + copy |

---

## Metrics

- Searches run / shortlists shown / intro requests sent  
- B account creates from intro email  
- Accept rate / decline rate / time-to-Accept  
- % of Accepts who turn Discoverable on  
- Share of shortlist cards that include an upcoming event  
- Abuse: quota hits, blocks, reports  
- Qualitative: useful intros via Hubert

---

## Open decisions

1. Exact search + intro quota numbers.  
2. Public teaser placement (home vs for-networkers vs both).  
3. UI name: “Meet people” vs “Ask Hubert to introduce you.”  
4. Whether A and B must share the **same** upcoming event to get the event boost, or any upcoming event on B is enough — **recommend: boost more if same event; still show B’s next event if different.**  
5. Share on Accept: email only vs email + LinkedIn — **recommend both if LinkedIn set.**

---

## One-line summary

**Member-only Hubert search (admin-only while building), back-of-house matches capped at five (first name + initial; upcoming event primary when present), intro email that onboards B to Accept — Rosie-curated private seed for Phase 1, then members-first as the graph fills; no scrape, no public contacts.**
