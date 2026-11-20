# SEO & AEO launch plan

**Public hub:** `www.thenetworkeruk.com` (gate off; tickets live)  
Code foundations are live (schema in HTML, discovery files, sitemap). **Search Console submit + indexing requests** are the remaining human step for Google/AIO visibility.

> Cursor canvas side panel: `seo-aeo-launch-plan.canvas.tsx` (open from the Canvas / right sidebar in Cursor).

---

## Short answer: Google Business Profile

**Create one if Google allows an online / no-storefront profile — do not pin Magpas HQ.** Magpas is the registered / accountants address (not a premises you can verify with Google’s postcard or video). Using it as a public Maps location risks suspension.

**Primary launch SEO remains Search Console + sitemap + schema.** GBP is a brand-trust bonus, not a blocker. Knowledge Panel can still form from the live site, Organization JSON-LD, and consistent NAP without a Maps pin.

| Do | Don't |
|----|--------|
| Sign in with `catherine@thenetworkeruk.com` (Google Workspace); add Rosie as Owner/Manager | Use Magpas HQ / PO box / accountants address on GBP |
| Category: Software company (or Online service) | Claim “customers visit this location” at Magpas |
| No public address / no storefront; UK service area if asked | Expect it to rank individual event pages or replace GSC |
| Website `https://www.thenetworkeruk.com`; contact hello@ | Force a Maps pin if Google won’t verify without a real premises |
| If Google won’t create without a verifiable address — **park GBP** until you have one | Treat Trustpilot as day-one (optional later) |

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
- **Live feeds for assistants:** `/api/public/events` and `/api/public/organisers` (read-only JSON; filters for city, date, free, guest visits)
- FAQPage schema synced with `faq.html`
- Rebuild: `npm run build-seo`
- While the preview gate is on, crawlers see `Disallow: /` and discovery files return 403 — intentional

---

## Do beforehand (while still private)

1. **Lock the public origin** — `www.thenetworkeruk.com` (apex → www). Set `SITE_URL` in Vercel Production to that exact URL.
2. **Align SEO surfaces** — `robots.txt` Sitemap line, rebuild `llms.txt` (`SITE_URL=https://www.thenetworkeruk.com npm run build-seo`), fix hard-coded `the-networker.co.uk` canonical leftovers (guides/faq).
3. **Redirect map** — draft in [`docs/LEGACY-REDIRECT-MAP.md`](./LEGACY-REDIRECT-MAP.md); confirm old analytics URLs → hub 301s for apex + www.
4. **Google Search Console** — property for `www.thenetworkeruk.com` (domain property if possible). Prepare DNS TXT / HTML verification.
5. **Google Business Profile** (optional / best-effort) — Software company / online, **no Magpas pin**; hide address or UK service area; verify via phone/email/video. Park if Google requires a premises you can’t verify. Keep Magpas on legal footer / Companies House only.
6. **Analytics** — keep Vercel Analytics only, or add GA4/GTM after cookie consent.
7. **Content freeze** — FAQs, About, Contact NAP; spot-check View Source on sample event + organiser pages after a staging gate-off test.
8. **Optional polish** — canonical/OG for `/guides` subpages; include key guides in sitemap.

---

## Browse / launch week — status (updated 19 Nov 2026)

1. ~~Remove `SITE_ACCESS_PASSWORD`~~ ✅ public browsing on.
2. ~~Confirm `/robots.txt` Allow, `/sitemap.xml` 200, `/llms.txt` + `/agents.txt` 200~~ ✅
3. ~~Explicit Allow for ChatGPT / Claude / Perplexity search crawlers in `robots.txt`~~ ✅
4. **Why ChatGPT / Gemini still may not “recommend” you**
   - `llms.txt` is navigation for agents — **not** a confirmed ranking lever for ChatGPT or Gemini.
   - **Gemini / Google AI Overviews** ≈ normal Google indexing (Search Console + crawlable pages).
   - **ChatGPT Search / Copilot** lean on **Bing** index + `OAI-SearchBot` / `bingbot` access.
   - Assistants cite brands with **third-party mentions** (press, LinkedIn, directories). Own-site SEO alone is rarely enough for “best UK networking site” style answers.
5. **Search Console (Google → Gemini path — needs your Google login):**
   1. Open [Google Search Console](https://search.google.com/search-console) → property `thenetworkeruk.com` (or `www.thenetworkeruk.com`).
   2. **Sitemaps** → submit: `https://www.thenetworkeruk.com/sitemap.xml`
   3. **URL inspection** → Request indexing for home, `/events/`, `/opportunities/`, `/faq`, top city hubs under `/networking/`.
6. **Bing Webmaster (ChatGPT / Copilot path — do this if not done):**
   1. Open [Bing Webmaster Tools](https://www.bing.com/webmasters) → add `https://www.thenetworkeruk.com`.
   2. Import from Google Search Console if offered, or verify via DNS/meta.
   3. Submit the same sitemap: `https://www.thenetworkeruk.com/sitemap.xml`
   4. Optional: enable **IndexNow** for faster refresh when events/organisers change.
7. Tickets / enquiries are live — keep FAQ / `llms.txt` copy current (no “opens 1 September” leftovers).
8. If GBP exists: website = hub URL; no Magpas Maps pin. Otherwise skip — GSC + Bing are enough.
9. Ongoing: watch Page indexing; fix 404s; earn citations (organiser blogs, LinkedIn, niche directories) pointing at hub URLs.

## Tickets week (1st September)

1. Turn on checkout and opportunity enquiries.
2. Do **not** flip `the-networker.co.uk` → hub 301s yet (SEO hold ~November). Keep legacy brand email working.

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
| `www.thenetworkeruk.com` | Live hub + default SEO/AEO origin | Single canonical; apex 301 → www |
| `thenetworkerhub.co.uk` (+ www) | UK brand variant / typo catch | 301 → `www.thenetworkeruk.com` (Vercel domain + `vercel.json`) |
| `the-networker.co.uk` | Legacy brand / email / leftover canonicals | 301 → hub; keep email |
| `the-networker-hub.vercel.app` | Deploy / preview host | Never submit to GSC as primary |

**Biggest risk:** `SITE_URL` / robots Sitemap / hard-coded co.uk canonicals pointing at different hosts. Align weeks before opening the gate, then submit one clean GSC property.

### Suggested order
1. Domain + `SITE_URL`
2. Align robots / llms / canonicals
3. GSC setup (GBP best-effort, no Magpas pin)
4. Redirect map ready
5. Gate off + sitemap submit

---

*Related: `PIPS-TODO.md` Tabs 6–7 · preview gate in `middleware.js` · redirect draft `docs/LEGACY-REDIRECT-MAP.md`*
