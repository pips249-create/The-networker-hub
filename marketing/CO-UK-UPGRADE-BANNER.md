# co.uk upgrade banner — install checklist

**Soft banner window:** **6 August – 1 September 2026** (2–4 weeks before hard redirect)  
**CTA:** `https://www.thenetworkerhub.com/for-organisers`  
**Hard redirect:** 1 September 2026 — see `docs/LEGACY-REDIRECT-MAP.md`

---

## Files

| File | Use |
|------|-----|
| `co-uk-upgrade-banner-snippet.html` | Paste into WordPress (WPCode / Code Snippets → Header) |
| `co-uk-upgrade-banner-preview.html` | Local visual check |

---

## Install on the-networker.co.uk

1. WordPress → **WPCode** or **Code Snippets** → add snippet, location **Header (frontend)**.
2. Paste **all three parts** from `co-uk-upgrade-banner-snippet.html` (HTML + CSS + JS).
3. Publish / activate for the whole site.
4. Spot-check home + one inner page on mobile and desktop.
5. Confirm dismiss remembers for 14 days (`localStorage` key `tnh_upgrade_banner_dismissed_v1`).

Do **not** point the CTA at gated catalogue URLs (`/events/`) while the hub preview password is still on — `/for-organisers` is early-access.

---

## After soft launch / hard flip

- Remove or disable the snippet when 301 redirects are live (banner is redundant).
- Keep `@the-networker.co.uk` mailboxes; only the website redirects.
