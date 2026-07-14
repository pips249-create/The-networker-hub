# SEO & AEO launch plan

**Private until ~28 August 2026** · Public hub: `www.thenetworkerhub.com`  
Code foundations ~65% ready — gate, domain, and Search Console still decide launch discoverability.

> Cursor canvas side panel: `seo-aeo-launch-plan.canvas.tsx` (open from the Canvas / right sidebar in Cursor).

---

## Short answer: Google Business Profile

**Yes — create one.** Claim The Networker Hub as a software / online business (office address at Magpas HQ). It helps Google Knowledge Panel, Maps checks, and brand trust.

It is **not** a substitute for Search Console, sitemap, or the `the-networker.co.uk` redirect.

| Do | Don't expect |
|----|--------------|
| Claim GBP as “Software company” or similar | It to rank individual event pages |
| Use Magpas HQ address + hub domain / hello@ email | Local “events near me” for every city yet |
| Point website URL to www.thenetworkerhub.com after go-live | GBP to replace Search Console verification |
| Add photos / categories matching the product | Rapid Maps traffic — primary win is brand entity |

---

## Already in the product

### SEO foundations
- Pretty URLs: `/events/slug`, `/organisers/slug`, `/opportunities/slug`
- Dynamic `/sitemap.xml` (static + events + organisers + opportunities)
- `robots.txt` (public allow; private areas blocked)
- Canonical + Open Graph on static pages
- Server-side meta injection for event / organiser / opportunity pages
- JSON-LD: Organization, WebSite, FAQ, Event, Product, Breadcrumbs
- `noindex` on account, admin, organiser, login, booking-success

### AEO (AI / answer engines)
- `llms.txt` built from Hubert FAQs
- `agents.txt` → machine discovery endpoints
- `/api/hubert-schema` + `/api/seo-meta`
- FAQPage schema synced with `faq.html`
- Rebuild: `npm run build-seo`
- While the preview gate is on, crawlers see `Disallow: /` and discovery files return 403 — intentional

---

## Do beforehand (while still private)

1. **Lock the public origin** — `www.thenetworkerhub.com` (apex → www). Set `SITE_URL` in Vercel Production to that exact URL.
2. **Align SEO surfaces** — `robots.txt` Sitemap line, rebuild `llms.txt` (`npm run build-seo`), fix hard-coded `the-networker.co.uk` canonical leftovers (guides/faq).
3. **Redirect map** — old `the-networker.co.uk` URLs → hub equivalents; plan 301s (or temporary “we’ve upgraded” page) for apex + www.
4. **Google Search Console** — property for `www.thenetworkerhub.com` (domain property if possible). Prepare DNS TXT / HTML verification.
5. **Google Business Profile** — Software company / online platform; Magpas HQ; website field ready for hub URL.
6. **Analytics** — keep Vercel Analytics only, or add GA4/GTM after cookie consent.
7. **Content freeze** — FAQs, About, Contact NAP; spot-check View Source on sample event + organiser pages after a staging gate-off test.
8. **Optional polish** — canonical/OG for `/guides` subpages; include key guides in sitemap.

---

## Launch week (~28 August)

1. Remove `SITE_ACCESS_PASSWORD` → Redeploy.
2. Confirm `/robots.txt` Allow, `/sitemap.xml` 200, `/llms.txt` + `/agents.txt` 200, no public `noindex`.
3. Search Console: verify → submit `https://www.thenetworkerhub.com/sitemap.xml` → request indexing on home + 3–5 key pages.
4. Flip `the-networker.co.uk` → hub 301s; keep legacy brand email working.
5. Set GBP website to live hub URL; publish if verification complete.
6. Week 1–2: watch Coverage / Page indexing; fix 404s from old URLs; confirm Event schema where eligible.

---

## Post-launch (not day-one)

- City / region landing pages
- Rich Results testing for Event markup at scale
- Guide → events / opportunities internal links
- Re-run `npm run build-seo` after FAQ edits
- Adjust robots Allow for `/api/seo-meta` if machines need it

---

## Domain story

| Domain | Role now | Launch action |
|--------|----------|---------------|
| `www.thenetworkerhub.com` | Live hub + default SEO/AEO origin | Single canonical; apex 301 → www |
| `the-networker.co.uk` | Legacy brand / email / leftover canonicals | 301 → hub; keep email |
| `the-networker-hub.vercel.app` | Deploy / preview host | Never submit to GSC as primary |

**Biggest risk:** `SITE_URL` / robots Sitemap / hard-coded co.uk canonicals pointing at different hosts. Align weeks before opening the gate, then submit one clean GSC property.

### Suggested order
1. Domain + `SITE_URL`
2. Align robots / llms / canonicals
3. GSC + GBP setup
4. Redirect map ready
5. Gate off + sitemap submit

---

*Related: `PIPS-TODO.md` Tabs 6–7 · preview gate in `middleware.js`*
