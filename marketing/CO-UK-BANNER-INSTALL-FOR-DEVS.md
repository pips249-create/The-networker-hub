# WordPress install brief — Hub upgrade banner

**For:** the-networker.co.uk developers  
**Goal:** Sitewide soft banner pointing visitors to The Networker UK, while co.uk stays fully live for SEO (~3 months).  
**Do not** add hard redirects yet.

---

## What to paste (Simple Custom CSS & JS on co.uk)

**Use Custom JS — not HTML.** HTML snippets are not appearing on the live site (NitroPack / head injection). JS snippets do load.

File: `marketing/co-uk-upgrade-banner-snippet.js` — paste the **entire** file.

1. **Custom CSS & JS → Add Custom JS Code** (type must be **JS**).
2. Title e.g. `Hub 2026 banner`.
3. Paste the full contents of `co-uk-upgrade-banner-snippet.js`.
4. **Where on page:** Header · **In Frontend** · **Active**.
5. Update.
6. **Deactivate** any older Hub / HTML banner snippets so only this JS one runs.
7. NitroPack → **Purge cache** → hard-refresh the homepage (private window).

### Sneak Peek CTA (already in the snippet)

```
https://www.thenetworkeruk.com/peek?utm_source=the-networker.co.uk&utm_medium=banner&utm_campaign=soft_launch_2026&utm_content=peek
```

*(Alternative file `co-uk-upgrade-banner-snippet.html` is for WPCode HTML paste if you switch plugins later.)*

---

## What it looks like

Three columns (unequal widths):

1. **The Networker UK logo** (cream chip) · We’re upgrading · Browse from **25 August**
2. **Find your next** *[rotating word]*
3. **Sneak Peek →** (opens Hub `/peek` mini-site)

Logo is hosted from `thenetworkeruk.com` — do not hotlink a local WordPress media upload.

---

## Behaviour (do not change)

| Item | Spec |
|------|------|
| Placement | Injected above `#c27-site-wrapper` (above the purple nav) |
| CTA | **Sneak Peek** → Hub `/peek` (+ UTMs above) |
| Dismiss | **None** — banner always visible |
| Motion | Rotating word after “Find your next…” every 2s |

**Do not** switch the banner to `position: fixed` or `sticky` — that covers Elementor hero videos.

---

## After install — quick check

1. Home (hero video) — banner above purple bar; video still plays full-bleed.
2. Mobile — stacks cleanly (status → headline → button).
3. **Sneak Peek** — opens Hub `/peek` in a new tab with UTM params.
4. Word rotates: event → opportunity → group → attendee → connection.

---

## When to remove

Disable the snippet only when hard **301s** to `www.thenetworkeruk.com` go live (after the ~3-month SEO hold). Keep MX / `@the-networker.co.uk` mailboxes unchanged.
