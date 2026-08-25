# Early flip checklist — the-networker.co.uk → The Networker UK

**Decision:** End the dual-site / banner hold early.  
**Canonical site:** `https://www.thenetworkeruk.com`  
**Do not touch:** MX / mail for `@the-networker.co.uk`  
**Related:** `docs/LEGACY-REDIRECT-MAP.md` · `docs/SEO-AEO-LAUNCH-PLAN.md`

This replaces “soft banner on WordPress for ~3 months.” Same SEO outcome as the November flip — just sooner.

---

## What “early flip” means

| Do | Don’t |
|----|--------|
| **301** apex + www co.uk → `www.thenetworkeruk.com` | Point MX at Vercel |
| Keep email DNS (MX, SPF, DKIM) exactly as today | Host the Hub *on* co.uk as a second live brand |
| Map important old paths → Hub paths | Catch-all everything to `/` only (loses deep-link SEO) |
| Turn off WP banner / park or retire WordPress after | Leave WordPress live in parallel “just in case” |

---

## Phase 0 — Before any DNS change (same day / day before)

### Hub ready
- [ ] `https://www.thenetworkeruk.com` loads (browse open)
- [ ] `SITE_URL` / `PUBLIC_SITE_URL` on Vercel Production = `https://www.thenetworkeruk.com`
- [ ] `/robots.txt` Allow, `/sitemap.xml` 200
- [ ] Google Search Console verified for `www.thenetworkeruk.com`; sitemap submitted

### Path map (minimum)
From Analytics / Search Console top landing pages, confirm at least:

| Old co.uk | Hub |
|-----------|-----|
| `/` | `/` |
| Browse / events / networking | `/events/` |
| Groups / organisers | `/events/?mode=organisers` or `/organisers/{slug}` |
| Opportunities | `/opportunities/` |
| Login / register | `/login` · `/register` |
| About / contact | `/about` · `/contact` |
| Privacy / terms | `/legal-policies` |
| Unknown | `/` (catch-all **last**) |

- [ ] Export top 20–50 co.uk URLs; mark any organiser/event slugs that must map 1:1 (see `LEGACY-REDIRECT-MAP.md`)

### People / ops
- [ ] Tell DoLocal / WP host: website flipping; **do not change MX**
- [ ] Short FAQ for hello@: “the-networker.co.uk now redirects to thenetworkeruk.com”
- [ ] Optional: pause Hub 2026 Custom CSS & JS snippets (banner no longer needed after flip)

---

## Phase 1 — Choose how redirects are served

Pick **one** primary method.

### Option A — Recommended if DNS is on Cloudflare (or similar)

Keep WordPress hosting for a week as fallback, but redirect at the edge:

1. Cloudflare (or DNS host) → Page Rule / Redirect Rule  
2. `the-networker.co.uk/*` and `www.the-networker.co.uk/*` → `https://www.thenetworkeruk.com/$1` · **301** · Preserve path  
3. Specific path overrides first (events, login, etc.), then catch-all  
4. **MX records unchanged**

**Pros:** Fast, no Vercel domain drama, email safe.  
**Cons:** Must configure path rules carefully on Cloudflare.

### Option B — Add co.uk to Vercel (Hub serves redirects)

1. Vercel → Project → **Domains** → add:
   - `the-networker.co.uk`
   - `www.the-networker.co.uk`
2. Add host redirects in `vercel.json` (same pattern as other brand hosts):

```json
{
  "source": "/:path*",
  "has": [{ "type": "host", "value": "the-networker.co.uk" }],
  "destination": "https://www.thenetworkeruk.com/:path*",
  "permanent": true
},
{
  "source": "/:path*",
  "has": [{ "type": "host", "value": "www.the-networker.co.uk" }],
  "destination": "https://www.thenetworkeruk.com/:path*",
  "permanent": true
}
```

3. At the DNS host for co.uk, set **only web records** as Vercel instructs (A / CNAME / `www`).  
4. **Leave MX alone.** If Vercel asks for nameserver change, **do not** switch NS unless you have migrated MX to that DNS first — prefer record-level web only.

**Pros:** Everything in one place.  
**Cons:** Easy to break email if someone changes NS carelessly; path-specific maps still need extra `vercel.json` rules or middleware.

### Option C — Redirects on WordPress only

`.htaccess` / Redirection plugin / server config on the current WP host.

**Pros:** No DNS change.  
**Cons:** WP must stay up forever as a redirect shell; NitroPack can interfere — least preferred long-term.

---

## Phase 2 — Flip day (order matters)

1. [ ] Deploy Hub changes (Vercel redirects if Option B)  
2. [ ] Apply Cloudflare / DNS / WP redirects (Option A/B/C)  
3. [ ] Spot-check in a **private window**:

```
https://the-networker.co.uk/          → 301 → https://www.thenetworkeruk.com/
https://www.the-networker.co.uk/      → 301 → https://www.thenetworkeruk.com/
https://the-networker.co.uk/events    → Hub /events/ (or mapped path)
https://the-networker.co.uk/login     → Hub /login
```

4. [ ] Confirm email still works: send to `hello@the-networker.co.uk` (or your usual inbox)  
5. [ ] Deactivate Hub 2026 banner snippets on WP (optional cleanup)  
6. [ ] Search Console: add/verify co.uk **domain** or URL-prefix if not already; use “Change of Address” tool if available (domain property → thenetworkeruk.com)

---

## Phase 3 — Week 1 after flip

- [ ] GSC → Page indexing / Not found for co.uk referrers; fix missing path maps  
- [ ] Analytics: traffic on Hub with referrer / previous domain  
- [ ] Spot-check 10 bookmarks (home, browse, 3 groups, 3 events, login, about)  
- [ ] Social / email footers: primary URL = `thenetworkeruk.com`  
- [ ] After 1–2 weeks stable: put WP in maintenance or cancel hosting (redirects must still run — Cloudflare or Vercel, not a dead WP box)

---

## Email DNS reminder (print this)

| Record | Action |
|--------|--------|
| **MX** | Do not change |
| **TXT SPF / DKIM / DMARC** for mail | Do not change |
| **A / CNAME** for website only | Point to redirect target (Cloudflare/Vercel/host) |
| **Nameservers** | Only change if mail is already on that DNS provider |

---

## Rollback

If something breaks:

1. Remove redirect rules / revert web A/CNAME to WordPress  
2. Purge Cloudflare / NitroPack cache  
3. Hub on thenetworkeruk.com stays up either way  

---

## Owner decisions still needed

1. **Option A, B, or C?** (Cloudflare edge vs Vercel vs WP)  
2. Who controls co.uk DNS today? (DoLocal / registrar / Cloudflare)  
3. Flip date (e.g. this week vs after 1 September ticket open)  

When you pick A/B/C and a date, we can add the exact `vercel.json` rules and a path list for your top URLs.
