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
5. Hard refresh if something looks stale: **Cmd+Shift+R**.

### Quick health check (optional)

With `npm start` running, in a **second** Terminal tab:

```bash
npm run check:local
```

You should see `OK — 20 events` (or similar).

---

## Before updating the live site

1. Confirm local works (`npm run check:local` or eyeball the events page).
2. Deploy:
   ```bash
   npm run deploy
   ```
3. After deploy finishes:
   ```bash
   npm run check:live
   ```
4. Open https://the-networker-hub.vercel.app/events/ and hard refresh.

**Rule:** If it works on localhost but not live, you probably forgot to deploy.

---

## Do not

| Avoid | Why |
|-------|-----|
| Multiple `npm start` tabs | Wrong port (3000 vs 3001), confusing errors |
| Opening HTML from Finder | API calls fail (`file://`) |
| `vercel env pull` without re-syncing | Can wipe Supabase keys from `.env.local` — run `npm run sync-env` after |
| Placeholder keys in `.env` | "Invalid API key" errors |

---

## If events fail to load

1. Is `npm start` running? Terminal must show `Ready!`.
2. Browser URL must be `http://localhost:3000/...` (not `file://`).
3. Try **http://localhost:3000/api/hub-listings** — should show JSON.
4. Disable ad blockers / Brave Shields for localhost.
5. Only one dev server — Ctrl+C extras, start fresh with `npm start`.

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

## Email test sends on localhost

The live site can send email because **Resend keys exist on Vercel**. Local `vercel dev` does **not** read Vercel env automatically — you must copy them into `local.env`:

1. Vercel → your project → **Settings** → **Environment Variables**
2. Copy **`RESEND_API_KEY`** and **`RESEND_FROM`** (same values as Production)
3. Add to **`local.env`** (in the project root):

   ```
   RESEND_API_KEY=re_xxxxxxxx
   RESEND_FROM=The Networker Hub <onboarding@resend.dev>
   ```

4. Sync and restart:

   ```bash
   npm run sync-env
   npm start
   ```

5. Hard refresh the admin page, then send a test email again.

**Preview still works** without Resend — only **Send test** needs these keys.

With `onboarding@resend.dev`, Resend usually only delivers to the email on your Resend account until your domain is verified.
