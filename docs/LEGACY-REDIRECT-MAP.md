# Legacy redirect map — the-networker.co.uk → hub

**Status:** **EARLY FLIP IN PROGRESS (25 Aug 2026)** — see `docs/CO-UK-EARLY-FLIP-CHECKLIST.md` · browsing live · tickets **1 September 2026**  
**Target host:** `https://www.thenetworkeruk.com`  
**Keep on co.uk:** mailbox / MX for `@the-networker.co.uk` (do not point email at Vercel)  
**Hub code:** `middleware.js` + `vercel.json` redirect `the-networker.co.uk` / `www` → UK host once domains are attached in Vercel

Use this when configuring DNS + hosting 301s on the old site. Hub-internal tidy redirects already live in `vercel.json` (`.html` → clean paths) — this file is only for **legacy domain → hub**.

Related: `docs/SEO-AEO-LAUNCH-PLAN.md` · `PIPS-TODO.md` Tab 7 · `marketing/CO-UK-UPGRADE-BANNER.md`

---

## Soft launch vs hard flip

| Phase | Behaviour |
|-------|-----------|
| **Soft hold (optional)** | Soft banner on co.uk → Hub; old URLs keep working |
| **Early flip (preferred if banner blocked)** | Apex + www **301** to `www.thenetworkeruk.com` — checklist: `docs/CO-UK-EARLY-FLIP-CHECKLIST.md` |
| **Hard flip (~Nov 2026)** | Same as early flip if not done sooner; disable banner; watch Search Console 404s |

Prefer **301** once The Networker UK path is confirmed. Use **302** only while still testing redirects.

---

## Domain rules

| From | To | Notes |
|------|-----|--------|
| `http://the-networker.co.uk/*` | `https://www.thenetworkeruk.com/…` | Force HTTPS + www in one hop if possible |
| `https://the-networker.co.uk/*` | `https://www.thenetworkeruk.com/…` | |
| `http://www.the-networker.co.uk/*` | `https://www.thenetworkeruk.com/…` | |
| `https://www.the-networker.co.uk/*` | `https://www.thenetworkeruk.com/…` | |
| `http://thenetworkerhub.co.uk/*` | `https://www.thenetworkeruk.com/…` | UK variant — add domain in Vercel + DNS; `vercel.json` 301 ready |
| `https://thenetworkerhub.co.uk/*` | `https://www.thenetworkeruk.com/…` | |
| `http://www.thenetworkerhub.co.uk/*` | `https://www.thenetworkeruk.com/…` | |
| `https://www.thenetworkerhub.co.uk/*` | `https://www.thenetworkeruk.com/…` | |
| `www.thenetworkeruk.com` apex | `https://www.thenetworkeruk.com` | Hub apex → www (already planned) |

Never submit `the-networker-hub.vercel.app` as the primary Search Console property.

---

## Path map (confirmed hub destinations)

Fill **Old path** from analytics / Search Console / bookmarks before flip. Hub destinations below are live.

| Old path (co.uk) — confirm | Hub destination | Notes |
|----------------------------|-----------------|--------|
| `/` | `/` | Home |
| `/events` · `/events/` · `/browse` · `/networking` | `/events/` | Main browse |
| `/exhibitions` · `/conferences` | `/events/?type=exhibition` or `/events/?type=conference` | Prefer query that matches current filters; else `/events/` |
| `/opportunities` · `/business-opportunities` | `/opportunities/` | |
| `/organisers` · `/groups` · `/networking-groups` | Use organiser slug map below, else `/events/` | |
| `/organisers/{slug}` · `/group/{slug}` · `/profile/{slug}` | `/organisers/{slug}` | Only where slug still matches Supabase |
| `/event/{slug}` · `/events/{slug}` | `/events/{slug}` | Only where slug republished on hub |
| `/login` · `/signin` · `/sign-in` | `/login` | |
| `/register` · `/signup` · `/sign-up` | `/register` | |
| `/account` · `/my-account` · `/dashboard` | `/account/` | Attendee |
| `/organiser` · `/organiser-dashboard` | `/organiser/` | Organiser workspace |
| `/about` · `/about-us` | `/about` | |
| `/contact` · `/contact-us` | `/contact` | |
| `/faq` · `/help` | `/faq` | |
| `/pricing` · `/fees` | `/help/pricing-fees` | |
| `/payouts` · `/organiser-payouts` | `/help/organiser-payouts` | |
| `/advertising` · `/sponsor` · `/sponsorship` | `/advertising` | |
| `/legal` · `/privacy` · `/terms` | `/legal-policies` | |
| `/guides` · `/how-to` | `/guides` | |
| Unknown / deleted | `/` | Catch-all last |

### Slug unknowns (ops checklist)

Before hard flip, export:

1. Old co.uk organiser URLs that get traffic → match to Supabase `organisers.slug`
2. Old event URLs still indexed → match republished hub slugs, or redirect to `/events/` / organiser page
3. Add exceptions to the table above (do not 301 a dead slug to a wrong listing)

---

## Suggested hosting config sketch

Exact syntax depends on where co.uk is hosted (cPanel, Cloudflare, Netlify, etc.). Pattern:

```
# High confidence
/                → https://www.thenetworkeruk.com/                 301
/events*         → https://www.thenetworkeruk.com/events/          301
/opportunities*  → https://www.thenetworkeruk.com/opportunities/   301
/login*          → https://www.thenetworkeruk.com/login            301
/register*       → https://www.thenetworkeruk.com/register         301
/about*          → https://www.thenetworkeruk.com/about            301
/contact*        → https://www.thenetworkeruk.com/contact          301
/faq*            → https://www.thenetworkeruk.com/faq              301
/legal*          → https://www.thenetworkeruk.com/legal-policies   301
/privacy*        → https://www.thenetworkeruk.com/legal-policies   301
/terms*          → https://www.thenetworkeruk.com/legal-policies   301

# Catch-all (after specific rules)
/*               → https://www.thenetworkeruk.com/                 301
```

Organiser/event slug rules go **above** the catch-all once confirmed.

---

## Email & brand

| Keep | Change |
|------|--------|
| `@the-networker.co.uk` MX / inboxes | Canonical website → hub |
| Resend / SPF aligned to sending domain | Footer links on old emails → hub |
| Mentions of “The Networker” brand | Public URLs and OG tags → `www.thenetworkeruk.com` |

---

## Post-flip watchlist (week 1–2)

- [ ] Google Search Console → Page indexing / “Not found” for co.uk referring URLs
- [ ] Hub `/sitemap.xml` 200 and submitted
- [ ] Spot-check 10 old bookmarks (home, browse, 3 organisers, 3 events, login)
- [ ] If GBP exists (no Magpas pin): website field → `https://www.thenetworkeruk.com`
- [ ] Support inbox: “where did the old site go?” FAQ ready

---

## Owner actions still needed

1. Paste top landing pages from old Analytics / GSC into the path table  
2. Confirm hosting where **the-networker.co.uk** DNS is managed  
3. **thenetworkerhub.co.uk** — `vercel.json` 301s ready; NS already `ns1`/`ns2.vercel-dns.com`. **Add apex + www in Vercel → Domains** for this project if not listed (checked 6 Aug: only `.com` on project). Website-only; MX optional / keep separate if used for mail.  
4. Soft banner — **install now**; keep while co.uk runs for SEO (~3 months). Handoff: `marketing/CO-UK-BANNER-INSTALL-FOR-DEVS.md`  
5. Flip 301s after SEO hold (~Nov 2026) — checklist in `PIPS-TODO.md` (not on 1 Sep)
