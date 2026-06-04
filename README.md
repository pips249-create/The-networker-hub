# The Networker Hub

Member and organiser platform for networking events, exhibitions, and the Academy (training).

**Live preview (after deploy):** https://the-networker-hub.vercel.app/

## What’s in this folder

| File / folder | Purpose |
|---------------|---------|
| `index.html` | Hub home — partner-facing sitemap |
| `events/index.html` | Events listing prototype (filters + featured) |
| `NETWORKER-HUB-ROADMAP.md` | Full build plan from your brief |
| `css/hub.css` | Shared purple/gold design tokens |

This is **Phase 0**: static HTML you can deploy today. Next step is Next.js + Airtable + Stripe per the roadmap.

## Push to GitHub

```bash
cd ~/Desktop/The-Networker-Hub
git init
git remote add origin https://github.com/pips249-create/The-networker-hub.git
git pull origin main --allow-unrelated-histories   # if README exists on GitHub
git add .
git commit -m "Add Hub Phase 0 prototype and roadmap"
git push -u origin main
```

## Deploy on Vercel

1. [vercel.com](https://vercel.com) → Import `pips249-create/The-networker-hub`
2. Framework: **Other** (static) or leave default for plain HTML
3. Root directory: `.`
4. Redeploy after each push

## You do not need to give anyone your GitHub password

Build locally, push from your Mac, or add collaborators under repo **Settings → Collaborators**.

## Node.js (for the full app later)

Install Node from [nodejs.org](https://nodejs.org), then we can scaffold Next.js in this repo.
