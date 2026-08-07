# co.uk upgrade banner — install checklist

**Soft banner window:** **6 August – 1 September 2026** (2–4 weeks before hard redirect)  
**CTA (one):** `https://www.thenetworkerhub.com/about`  
**Hard redirect:** 1 September 2026 — see `docs/LEGACY-REDIRECT-MAP.md`

One banner for organisers and networkers. Product voice: rotating **Find your next…** (same pattern as the Hub), one logo, CTA to `/about`. Avoid a video / logo-wall treatment — that reads as advertising on the old site.

`/about` is early-access and open today (no site password).

**Do not use `/for-networkers` on the banner until after deploy** of the Vercel rewrite fix — production currently 308s `/for-attendees` → `/for-networkers` then 404s. Local fix: serve `/for-networkers` via rewrite to `for-attendees.html` without also permanently redirecting that HTML file away.

---

## Files

| File | Use |
|------|-----|
| `co-uk-upgrade-banner-snippet.html` | Paste into WordPress (WPCode / Code Snippets → Header) |
| `co-uk-upgrade-banner-preview.html` | Local visual check |
| `co-uk-upgrade-banner-mockup.html` | **Present this** — live banner on real co.uk homepage screenshot |
| `co-uk-homepage-screenshot.png` | Screenshot used by the mockup |

---

## Install on the-networker.co.uk

1. WordPress → **WPCode** or **Code Snippets** → add snippet, location **Header (frontend)**.
2. Paste **all three parts** from `co-uk-upgrade-banner-snippet.html` (HTML + CSS + JS).
3. Publish / activate for the whole site.
4. Spot-check home + one inner page on mobile and desktop.
5. Confirm dismiss remembers for 14 days (`localStorage` key `tnh_upgrade_banner_dismissed_v3`).

Do **not** point CTAs at gated catalogue URLs (`/events/`) while the hub preview password is still on.

---

## After soft launch / hard flip

- Remove or disable the snippet when 301 redirects are live (banner is redundant).
- Keep `@the-networker.co.uk` mailboxes; only the website redirects.
