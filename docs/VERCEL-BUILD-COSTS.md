# Cut Vercel Build CPU costs

**Why this exists:** Weekly usage hit ~**414 Build CPU hours (~$87)** almost entirely from **Build & Deploy**. Runtime (Functions, CDN, Analytics) was only a few dollars.

**Root cause:** Every push to every branch (especially Cursor agent `cursor/**` PRs) triggered a full Vercel preview build.

## Rule: only `main` deploys

| Branch | Auto-deploy to Vercel? |
|--------|-------------------------|
| `main` | Yes → **production** (`www.thenetworkeruk.com`) |
| Everything else (`cursor/**`, feature branches, PR branches) | **No** |

Configured in `vercel.json`:

```json
"git": {
  "deploymentEnabled": {
    "**": false,
    "main": true
  }
}
```

`scripts/vercel-ignore-build.js` skips any leftover preview builds as a safety net.

## Everyday workflow

You can still use as many branches and Cloud Agents as you like. **Nothing goes live until it lands on `main`.**

1. Agent / you work on a branch (e.g. `cursor/fix-thing-abcd`).
2. Open a PR → review the **diff** (and any local/agent screenshots). No Vercel preview URL.
3. **Merge the PR into `main`** → that merge triggers **one** production build.
4. Check the live site.

You do **not** need to “push the branch to main first” as a separate step — **merging the PR is the push to main**.

```text
branch work  →  PR review  →  merge to main  →  one Vercel production deploy
```

### If you need a one-off preview before merge

Rare. Options:

1. Merge to `main` behind a feature flag / unfinished UI (prefer this when safe).
2. Manual CLI: `npx vercel` from your machine (one-off preview; not every commit).
3. Temporarily set `"preview-temp": true` under `git.deploymentEnabled` and push that branch name — then remove it.

## Dashboard (do once)

**Vercel → the-networker-hub → Settings → Build and Deployment:**

| Setting | Set to |
|---------|--------|
| **Ignored Build Step** | Repo command (`node scripts/vercel-ignore-build.js`) — don’t override to Automatic |
| **On-Demand Concurrent Builds** | **Run up to one build per branch** (belt and braces) |
| **Build Machine** | **Basic** or **Elastic** — avoid Enhanced/Turbo unless builds OOM |
| **System Environment Variables** | **Enabled** |

Optional UI shortcut with the same intent: Ignored Build Step → **Only build production**.

## Sanity check

After a normal week of agent PRs, Build CPU should track **merged PRs to main** (one build each), not every agent commit. Runtime staying ~$5–10 is expected.
