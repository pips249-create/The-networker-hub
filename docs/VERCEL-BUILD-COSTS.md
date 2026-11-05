# Cut Vercel Build CPU costs

**Why this exists:** Weekly usage hit ~**414 Build CPU hours (~$87)** almost entirely from **Build & Deploy**. Runtime (Functions, CDN, Analytics) was only a few dollars.

**Root cause:** Cursor agent branches (`cursor/**`) push many commits per PR. Each commit was triggering a full Vercel preview build. ~100 PRs / ~240 commits in a week compounds fast.

## What we changed in the repo

1. **`vercel.json` → `git.deploymentEnabled`**
   - `"cursor/**": false` — no automatic preview deployments for agent branches.
   - Production still deploys on every merge to `main`.

2. **`scripts/vercel-ignore-build.js`** (Ignored Build Step)
   - Skips preview builds with no pull request.
   - Skips previews when only docs / marketing / ops / email templates / migrations / PDFs changed.
   - Always builds production.

## Dashboard settings (do these once — biggest remaining win)

In **Vercel → the-networker-hub → Settings → Build and Deployment**:

| Setting | Set to | Why |
|---------|--------|-----|
| **On-Demand Concurrent Builds** | **Run up to one build per branch** | When an agent pushes a burst of commits, only the latest queued deploy builds. Vercel’s own guidance for coding agents. |
| **Build Machine** | **Basic** (2 vCPU) or **Elastic** if already fine | Avoid Enhanced/Turbo unless builds OOM — more vCPUs × minutes = higher bill. |
| **Ignored Build Step** | Confirm it shows the repo `ignoreCommand` (or `node scripts/vercel-ignore-build.js`) | Must not be overridden to “Automatic” in the UI. |
| **System Environment Variables** | **Enabled** | Required for `VERCEL_TARGET_ENV` / `VERCEL_GIT_*` in the ignore script. |

Optional: **Deployments →** prune old failed/canceled previews; they don’t bill CPU after the fact but clutter the list.

## When you *need* a preview URL

Agent branches no longer auto-deploy. Options:

1. **Ship via `main`** — merge the PR; production updates in one build.
2. **Use a preview branch** — push the same commits to `preview/<short-name>` (not under `cursor/`). That pattern still deploys.
3. **Manual deploy** — `npx vercel` from a laptop with the Vercel CLI linked (creates a one-off preview).

To re-enable agent previews temporarily, remove or comment the `cursor/**` entry under `git.deploymentEnabled` in `vercel.json`.

## Sanity check after a quiet week

Usage → **Build CPU Minutes** should drop from hundreds of hours toward roughly **one production build per merged PR** (plus any intentional `preview/**` deploys). Runtime line items staying ~$5–10 is expected.
