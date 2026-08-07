# WordPress install brief — Hub upgrade banner

**For:** the-networker.co.uk developers  
**Goal:** Sitewide soft banner pointing visitors to the new Hub, while co.uk stays fully live for SEO (~3 months).  
**Do not** add hard redirects yet.

---

## What to paste

File: `marketing/co-uk-upgrade-banner-snippet.html` (entire file — fonts + HTML + CSS + JS).

**If the banner is already live:** only change the **Peek at the Hub** button `href` to the About URL below (do not re-paste the whole banner unless you also need copy/CSS updates).

### Peek CTA href (only change this)

```
https://www.thenetworkerhub.com/about?utm_source=the-networker.co.uk&utm_medium=banner&utm_campaign=soft_launch_2026&utm_content=peek
```

1. Open **WPCode** or **Code Snippets** (or equivalent header injection).
2. Find the Peek button (`class="tnh-upgrade-banner__cta"`).
3. Replace its `href` with the URL above.
4. Save / publish.

---

## Behaviour (do not change)

| Item | Spec |
|------|------|
| Placement | **In document flow** above the purple nav — `position: relative` only |
| Logo | **None** — co.uk brand stays in the purple header; banner is text + Peek only |
| CTA | **Peek at the Hub** → Hub `/about` (early-access marketing pages; catalogue stays gated) |
| Dismiss | × button hides for **7 days** (`localStorage` key `tnh_upgrade_banner_dismissed_v7`) |
| Motion | Rotating word after “Find your next…” every 3.2s |

**Do not** switch the banner to `position: fixed` or `sticky` — that covers Elementor hero videos.

---

## After install — quick check

1. Home (hero video) — banner above purple bar; video still plays full-bleed.
2. Mobile — stacked layout still readable.
3. Click Peek — opens Hub About in a new tab with UTM params.
4. Dismiss × — banner hidden for 7 days on that browser.
