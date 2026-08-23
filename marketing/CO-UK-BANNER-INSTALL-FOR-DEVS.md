# WordPress install brief — Hub upgrade banner

**For:** the-networker.co.uk developers  
**Goal:** Sitewide soft banner pointing visitors to the new Hub, while co.uk stays fully live for SEO (~3 months).  
**Do not** add hard redirects yet.

---

## What to paste

File: `marketing/co-uk-upgrade-banner-snippet.html` — paste the **entire** file (fonts + HTML + CSS + JS).

**If an older banner is already live:** replace the whole snippet (layout and copy changed — CTA-only swap is not enough).

1. Open **WPCode** or **Code Snippets** (or equivalent header injection).
2. Create / edit a snippet that runs on the **frontend Header** (every public page).
3. Paste the full contents of `co-uk-upgrade-banner-snippet.html`.
4. Publish / activate.
5. Hard-refresh the homepage (and clear any WP/CDN cache if used).

### Sneak Peek CTA (already in the snippet)

```
https://www.thenetworkeruk.com/peek?utm_source=the-networker.co.uk&utm_medium=banner&utm_campaign=soft_launch_2026&utm_content=peek
```

---

## What it looks like

Three columns (unequal widths):

1. **We’re upgrading** · Browse from **25 August**
2. **Find your next** *[rotating word]*
3. **Sneak Peek →** (opens Hub `/peek` mini-site)

No Hub logo — co.uk purple header keeps the brand.

---

## Behaviour (do not change)

| Item | Spec |
|------|------|
| Placement | **In document flow** above the purple nav — `position: relative` only |
| CTA | **Sneak Peek** → Hub `/peek` (+ UTMs above) |
| Dismiss | × hides for **7 days** (`localStorage` key `tnh_upgrade_banner_dismissed_v14`) |
| Motion | Rotating word after “Find your next…” every 3.2s |

**Do not** switch the banner to `position: fixed` or `sticky` — that covers Elementor hero videos.

---

## After install — quick check

1. Home (hero video) — banner above purple bar; video still plays full-bleed.
2. Mobile — stacks cleanly (status → headline → button).
3. **Sneak Peek** — opens Hub `/peek` in a new tab with UTM params.
4. Dismiss × — banner hidden for 7 days on that browser.
5. Word rotates: event → opportunity → group → attendee → connection.

---

## When to remove

Disable the snippet only when hard **301s** to `www.thenetworkeruk.com` go live (after the ~3-month SEO hold). Keep MX / `@the-networker.co.uk` mailboxes unchanged.
