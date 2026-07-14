# Local dev & deploy — quick reference

Use this so local and live stay in sync and events keep loading.

## Every day (local work)

1. **Edit secrets in `local.env` only** — not in `.env` by hand.
2. **One Terminal tab:**
   ```bash
   cd ~/Desktop/The-networker-hub
   npm start
   ```
3. Wait for `Ready! Available at http://localhost:3000`.
4. Open **http://localhost:3000/events/** in the browser (not a file from Finder).
5. If the preview gate is on, unlock via `/site-access` (password = `SITE_ACCESS_PASSWORD` in `local.env`).
6. Hard refresh if something looks stale: **Cmd+Shift+R**.

### Quick health check (optional)

With `npm start` running, in a **second** Terminal tab:

```bash
node scripts/smoke-test-site.js http://localhost:3000
```

Or `npm run check:local` (same script). You should see `Smoke passed` (warnings OK for gated discovery files).

**If npm prints `EAGAIN` / `spawn sh`:** your Mac is out of process slots — skip npm and run the `node scripts/…` line above. Quit spare Terminal tabs / old `vercel` processes, or restart the Mac.

**Do not paste comments** like `# vercel…` after commands — zsh can throw `unknown file attribute`.

---

## Before updating the live site

1. Confirm local works (`node scripts/smoke-test-site.js http://localhost:3000` or eyeball the events page).
2. Deploy:
   ```bash
   npm run deploy
   ```
3. After deploy finishes (needs `SITE_ACCESS_PASSWORD` in the shell or `local.env` to unlock):
   ```bash
   node scripts/smoke-test-site.js https://www.thenetworkerhub.com
   ```
4. Or open https://the-networker-hub.vercel.app/events/ and hard refresh (unlock if gated).

**Rule:** If it works on localhost but not live, you probably forgot to deploy.

**Note:** `npm run check:live` will fail with HTTP 403 while the preview gate is on **unless** `SITE_ACCESS_PASSWORD` is available to the smoke script (it reads `local.env`).

---

## Do not

| Avoid | Why |
|-------|-----|
| Multiple `npm start` tabs | Wrong port (3000 vs 3001), confusing errors |
| Opening HTML from Finder | API calls fail (`file://`) |
| `vercel env pull` without re-syncing | Can wipe Supabase keys from `.env.local` — run `npm run sync-env` after |
| Placeholder keys in `.env` | "Invalid API key" errors |
| Running `check:local` before `Ready!` | `fetch failed` — nothing is listening on :3000 |

---

## If events fail to load

1. Is `npm start` running? Terminal must show `Ready!`.
2. Browser URL must be `http://localhost:3000/...` (not `file://`).
3. Try **http://localhost:3000/api/hub-listings** — should show JSON (after unlock if gated).
4. Disable ad blockers / Brave Shields for localhost.
5. Only one dev server — Ctrl+C extras, start fresh with `npm start`.

### Sitemap locally

`/sitemap.xml` rewrites to `/api/sitemap` (XML). **`vercel.json` rewrites only load when `npm start` boots** — after sitemap fixes, Ctrl+C and run `npm start` again.

Direct checks (after unlock if gated):

```bash
curl -s "http://localhost:3000/api/sitemap" | head
curl -s "http://localhost:3000/sitemap.xml" | head
```

`agents.txt` / `llms.txt` / `robots.txt` are static files (always work). Sitemap is generated — a 404 almost always means the rewrite was not loaded (stale `vercel dev`).

---

## Local vs live (simple model)

```
Edit code on your Mac → npm start → test on localhost → npm run deploy → public site updates
```

- **Local** = your workshop (private).
- **Live** = what visitors see (needs deploy after changes).
- **Supabase** = shared database (same events on both, once API works).

Secrets for local: `local.env` (synced automatically by `npm start`).  
Secrets for live: Vercel → Settings → Environment Variables (already set).

---

## Related

- Launch checklist: `PIPS-TODO.md`
- SEO / gate-off: `docs/SEO-AEO-LAUNCH-PLAN.md`
- Legacy domain flip: `docs/LEGACY-REDIRECT-MAP.md`
