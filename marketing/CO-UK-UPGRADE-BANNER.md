# co.uk upgrade banner — install checklist

**Soft banner window:** **6 August – 1 September 2026**  
**Banner CTA (one):** `https://www.thenetworkerhub.com/about` → “Peek at the Hub”  
**On About:** choose **For organisers** or **For networkers**  
**Hard redirect:** 1 September 2026 — see `docs/LEGACY-REDIRECT-MAP.md`

UTM: `utm_source=the-networker.co.uk&utm_medium=banner&utm_campaign=soft_launch_2026`

Product voice: rotating **Find your next…**, Hub logo, dismissible **7 days**.

**Deploy first:** ship `for-networkers.html` (and About updates) so `/for-networkers` returns 200 before pasting the banner on co.uk.

Do **not** link the banner straight to gated catalogue URLs (`/`, `/events/`) while the site password is on.

---

## Visitor path

1. co.uk banner → **Peek at the Hub** (`/about`)
2. On About → **For organisers** and/or **For networkers**
3. Catalogue browse / tickets stay closed until 1 Sept (explained on those pages)

Skip on the public banner: claim/register links (Email 2), `/contact` (use if support gets noisy).

---

## Files

| File | Use |
|------|-----|
| `co-uk-upgrade-banner-snippet.html` | Paste into WordPress (Header) |
| `co-uk-upgrade-banner-mockup.html` | Present — banner on real co.uk screenshot |
| `co-uk-homepage-screenshot.png` | Screenshot used by the mockup |

---

## Video heroes on co.uk

Banner is **in normal document flow** (`position: relative`), not fixed/sticky. It sits above the purple nav and **pushes** the hero video and later section videos down — it does not overlay them.

Spot-check after install:
1. Home (hero video) — banner above purple bar; video still plays full-bleed in its section.
2. A page with “container 3” video — unaffected (further down the page).
3. Mobile — stacked banner is taller; confirm the hero still feels intentional.
4. Logged-in WP admin — banner `z-index` is above the admin bar edge cases.

Do **not** change the banner to `position: fixed` — that is what would clash with video backgrounds.

---

## Nice-to-haves (optional, not required)

- Deploy Hub `/for-networkers` + About audience links before go-live.
- After ~1 week, check UTM traffic in analytics (`utm_campaign=soft_launch_2026`).
- If the strip feels busy on video pages, dismiss + slower word rotate (3.2s) already keep it calm.

---

## Install on the-networker.co.uk

1. Confirm Hub `/about`, `/for-organisers`, and `/for-networkers` return **200**.
2. WPCode / Code Snippets → Header → paste `co-uk-upgrade-banner-snippet.html`.
3. Spot-check mobile + desktop; dismiss = **7 days** (`tnh_upgrade_banner_dismissed_v5`).

---

## After soft launch / hard flip

- Disable the snippet when 301s go live.
- Keep `@the-networker.co.uk` mailboxes; only the website redirects.
