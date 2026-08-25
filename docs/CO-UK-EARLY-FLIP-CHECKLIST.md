# Early flip checklist — the-networker.co.uk → The Networker UK

**Decision: GO (25 August 2026)** — end dual-site / banner hold; hard 301 to the Hub.  
**Canonical site:** `https://www.thenetworkeruk.com`  
**Do not touch:** MX / mail for `@the-networker.co.uk`  
**Hub code:** host redirects ready in `middleware.js` + `vercel.json` (deploy first)  
**Related:** `docs/LEGACY-REDIRECT-MAP.md` · `docs/SEO-AEO-LAUNCH-PLAN.md`

---

## Done in Hub repo

- [x] `the-networker.co.uk` + `www` → `www.thenetworkeruk.com` (308/301, path preserved)
- [x] Same pattern as other brand hosts in middleware

## Your flip steps (DNS / Vercel)

### 1. Deploy Hub
- [ ] Push/deploy so Production has the new redirects (this commit)

### 2. Attach domains in Vercel
Vercel → The Networker Hub project → **Domains** → Add:
- [ ] `the-networker.co.uk`
- [ ] `www.the-networker.co.uk`

Copy the **A / CNAME** values Vercel shows. Do **not** change nameservers unless mail already lives on that DNS.

### 3. DNS at co.uk registrar (web only — leave MX alone)

| Record | Action |
|--------|--------|
| **MX** | **Do not change** |
| **TXT SPF/DKIM/DMARC** (mail) | **Do not change** |
| **www** | CNAME (or as Vercel says) → Vercel target |
| **apex** `@` | A / ALIAS as Vercel says |

If DoLocal controls DNS, send them: *“Point website A/CNAME to Vercel for apex + www only. Do not touch MX.”*

### 4. After DNS propagates (often minutes–a few hours)

Private window checks:
- [ ] `https://the-networker.co.uk/` → `https://www.thenetworkeruk.com/`
- [ ] `https://www.the-networker.co.uk/` → same
- [ ] `/events` or a known browse path still lands on Hub browse
- [ ] Send a test to `hello@the-networker.co.uk` (or usual) — mail still works

### 5. Cleanup
- [ ] Deactivate Hub 2026 Custom CSS & JS / banner snippets on WordPress
- [ ] Search Console: Change of Address co.uk → thenetworkeruk.com if offered
- [ ] After 1–2 weeks stable: cancel or park WP hosting (redirects stay on Vercel)

### 6. Week 1 watch
- [ ] GSC 404s for old co.uk URLs → add path maps in `LEGACY-REDIRECT-MAP.md` / `vercel.json` as needed
- [ ] Spot-check 10 bookmarks

---

## Rollback

Revert co.uk **web** A/CNAME to WordPress. Leave Hub on thenetworkeruk.com. MX untouched either way.

---

## Path map (minimum — already partly in Hub)

| Old co.uk | Hub |
|-----------|-----|
| `/` | `/` |
| events / networking browse | `/events/` |
| groups / organisers | `/events/?mode=organisers` |
| login / register | `/login` · `/register` |
| about / contact | `/about` · `/contact` |
| privacy / terms | `/legal-policies` |

Unknown paths keep the same path on the Hub (may 404 until mapped). Prefer path preserve + fix 404s in week 1 over dumping everything to home.
