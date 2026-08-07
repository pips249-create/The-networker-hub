# WordPress install brief — Hub upgrade banner

**For:** the-networker.co.uk developers  
**Goal:** Sitewide soft banner pointing visitors to the new Hub, while co.uk stays fully live for SEO (~3 months).  
**Do not** add hard redirects yet.

---

## What to paste

File: `marketing/co-uk-upgrade-banner-snippet.html` (entire file — fonts + HTML + CSS + JS).

1. Open **WPCode** or **Code Snippets** (or equivalent header injection).
2. Create a snippet that runs on the **frontend Header** (every public page).
3. Paste the full snippet.
4. Publish / activate.

---

## Behaviour (do not change)

| Item | Spec |
|------|------|
| Placement | **In document flow** above the purple nav — `position: relative` only |
| CTA | One button → `https://www.thenetworkerhub.com/about` (+ UTMs already in snippet) |
| Dismiss | × button hides for **7 days** (`localStorage` key `tnh_upgrade_banner_dismissed_v6`) |
| Motion | Rotating word after “Find your next…” every 3.2s |

**Do not** switch the banner to `position: fixed` or `sticky` — that covers Elementor hero videos.

---

## Spot-check after go-live

- [ ] Home — banner above purple bar; hero video still plays and is not covered
- [ ] Mobile — stacked layout looks intentional
- [ ] Dismiss works; refresh within 7 days stays hidden
- [ ] CTA opens Hub About in a new tab
- [ ] Logged-in WP admin — banner still readable under/near admin bar

---

## When to remove

Disable the snippet only when hard **301s** to `www.thenetworkerhub.com` go live (planned after the ~3-month SEO hold, ~November 2026). Keep MX / `@the-networker.co.uk` mailboxes unchanged.

---

## Contact

Hub side: Catherine / The Networker Hub team.  
Preview mockup (optional): `marketing/co-uk-upgrade-banner-mockup.html`
