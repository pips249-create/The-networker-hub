#!/usr/bin/env node
/**
 * Site smoke test — fast “is the house still standing?” check.
 *
 * Checks (public / unlocked):
 *   1. Preview gate unlock (if SITE_ACCESS_PASSWORD is set)
 *   2. Key public HTML pages return 200 + look like real pages
 *   3. Auth shells (/login, /account/, /organiser/) load
 *   4. Core browse APIs return healthy JSON
 *   5. One live event + opportunity detail page when listings exist
 *
 * If the site gate is on and no password is available, runs a smaller
 * “gated” smoke: waitlist page + gated-API checks + discovery behaviour.
 *
 * Usage:
 *   node scripts/smoke-test-site.js
 *   node scripts/smoke-test-site.js http://localhost:3000
 *   node scripts/smoke-test-site.js https://www.thenetworkerhub.com
 *   SITE_ACCESS_PASSWORD='…' npm run check:live
 *
 * Optional env (local.env / .env.local / shell):
 *   SITE_ACCESS_PASSWORD — unlocks gated preview so full page smoke runs
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
for (const name of ['local.env', '.env.local', '.env']) {
  const p = path.join(root, name);
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false });
}

const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const PASSWORD = String(process.env.SITE_ACCESS_PASSWORD || '').trim();

/** Public marketing + browse surfaces visitors hit first. */
const PUBLIC_PAGES = [
  { path: '/', expect: /networker|hub/i },
  { path: '/events/', expect: /event/i },
  { path: '/opportunities/', expect: /opportunit/i },
  { path: '/faq', expect: /faq|question/i },
  { path: '/about', expect: /about|networker/i },
  { path: '/contact', expect: /contact|hubert/i },
  { path: '/for-organisers', expect: /organis/i },
  { path: '/guides', expect: /guide/i },
  { path: '/advertising', expect: /advertis|sponsor/i },
  { path: '/legal-policies', expect: /privacy|terms|legal/i },
  { path: '/help/pricing-fees', expect: /fee|pricing|ticket/i },
  { path: '/help/organiser-payouts', expect: /payout/i },
  { path: '/site-access', expect: /access|preview|waitlist|password/i },
];

/** Pages that should render an HTML shell even when logged out. */
const AUTH_SHELLS = [
  { path: '/login', expect: /log\s*in|sign\s*in|password/i },
  { path: '/register', expect: /register|sign\s*up|create/i },
  { path: '/forgot-password', expect: /password|reset|forgot/i },
  { path: '/account/', expect: /account|ticket|sign\s*in|log\s*in/i },
  { path: '/organiser/', expect: /organis|dashboard|sign\s*in|log\s*in/i },
];

const DISCOVERY = ['/robots.txt', '/llms.txt', '/agents.txt', '/sitemap.xml'];

let cookieHeader = '';
let failed = 0;
let warned = 0;

function parseSetCookie(res) {
  const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const list = raw.length ? raw : [res.headers.get('set-cookie')].filter(Boolean);
  const parts = [];
  for (const line of list) {
    const first = String(line).split(';')[0].trim();
    if (first) parts.push(first);
  }
  if (parts.length) cookieHeader = parts.join('; ');
}

async function fetchUrl(urlPath, opts) {
  const headers = Object.assign({}, (opts && opts.headers) || {});
  if (cookieHeader) headers.Cookie = cookieHeader;
  const res = await fetch(base + urlPath, {
    redirect: (opts && opts.redirect) || 'manual',
    cache: 'no-store',
    headers,
    method: (opts && opts.method) || 'GET',
    body: opts && opts.body,
  });
  parseSetCookie(res);
  return res;
}

function locationPath(res) {
  const loc = res.headers.get('location') || '';
  try {
    return new URL(loc, base).pathname;
  } catch {
    return loc;
  }
}

function isSiteAccessRedirect(res) {
  if (!(res.status >= 300 && res.status < 400)) return false;
  const dest = locationPath(res);
  return dest === '/site-access' || dest.startsWith('/site-access');
}

function printResult(ok, label, message, warn) {
  const tag = !ok ? 'FAIL' : warn ? 'WARN' : 'OK  ';
  console.log('  ' + tag + '  ' + label + ' — ' + message);
  if (!ok) failed += 1;
  else if (warn) warned += 1;
}

async function unlockPreviewIfNeeded() {
  if (!PASSWORD) {
    return { skipped: true, message: 'no SITE_ACCESS_PASSWORD in env — probing without unlock' };
  }

  const res = await fetchUrl('/api/auth/site-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
    redirect: 'manual',
  });
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    /* ignore */
  }

  if (res.status === 200 && data.ok) {
    return { ok: true, message: cookieHeader ? 'preview cookie set' : 'gate unlocked (no cookie returned)' };
  }
  if (res.status === 200 && /not enabled/i.test(String(data.message || ''))) {
    return { skipped: true, message: 'gate not enabled on this host' };
  }
  return {
    ok: false,
    message: 'HTTP ' + res.status + ' — ' + (data.message || data.error || text.slice(0, 120)),
  };
}

async function detectGated() {
  const res = await fetchUrl('/', { redirect: 'manual' });
  if (isSiteAccessRedirect(res)) return true;
  if (res.status === 403) return true;
  return false;
}

async function probeHtml(page) {
  const res = await fetchUrl(page.path, { redirect: 'manual' });

  if (isSiteAccessRedirect(res)) {
    return {
      ok: false,
      message: 'redirected to /site-access (set SITE_ACCESS_PASSWORD to unlock)',
    };
  }

  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location') || page.path;
    let nextPath;
    try {
      const u = new URL(loc, base);
      nextPath = u.pathname + u.search;
    } catch {
      nextPath = locationPath(res);
    }
    const res2 = await fetchUrl(nextPath, { redirect: 'follow' });
    const html2 = await res2.text();
    if (!res2.ok) return { ok: false, message: 'HTTP ' + res2.status + ' after redirect to ' + nextPath };
    if (!/<html[\s>]/i.test(html2)) return { ok: false, message: 'not HTML after redirect' };
    if (page.expect && !page.expect.test(html2)) {
      return { ok: false, message: 'HTML loaded but missing expected content' };
    }
    return { ok: true, message: 'HTTP ' + res2.status + ' (via redirect)' };
  }

  if (res.status === 403) {
    return { ok: false, message: 'HTTP 403 — site private / not unlocked' };
  }
  if (!res.ok) return { ok: false, message: 'HTTP ' + res.status };

  const html = await res.text();
  if (!/<html[\s>]/i.test(html)) return { ok: false, message: 'HTTP ' + res.status + ' — not HTML' };
  if (page.expect && !page.expect.test(html)) {
    return { ok: false, message: 'HTTP ' + res.status + ' — missing expected content' };
  }
  return { ok: true, message: 'HTTP ' + res.status };
}

async function probeDiscovery(urlPath, gatedMode) {
  const res = await fetchUrl(urlPath, { redirect: 'follow' });
  if (res.status === 403) {
    return gatedMode
      ? { ok: true, warn: true, message: 'HTTP 403 — expected while site gate is on' }
      : { ok: false, message: 'HTTP 403 — unexpected while unlocked' };
  }

  // /sitemap.xml rewrites to /api/sitemap — if the pretty URL fails after unlock,
  // try the API path so local vs prod rewrite quirks are obvious.
  if (urlPath === '/sitemap.xml' && !res.ok && !gatedMode) {
    const fallbacks = ['/api/sitemap', '/api/seo/sitemap', '/api/seo?route=sitemap'];
    for (const path of fallbacks) {
      const fallback = await fetchUrl(path, { redirect: 'follow' });
      const fbText = await fallback.text();
      if (fallback.ok && /<urlset[\s>]/i.test(fbText)) {
        return {
          ok: true,
          warn: true,
          message:
            'HTTP ' +
            res.status +
            ' on /sitemap.xml — ' +
            path +
            ' OK (restart `npm start` so vercel.json rewrite reloads)',
        };
      }
    }
    return {
      ok: false,
      message:
        'HTTP ' +
        res.status +
        ' — restart `npm start` after sitemap fixes (pretty URL rewrite only loads on boot)',
    };
  }

  // Gated mode: middleware should 403 discovery files. A bare 404 usually means
  // the rewrite never loaded (stale `vercel dev`) — point that out clearly.
  if (urlPath === '/sitemap.xml' && !res.ok && gatedMode) {
    return {
      ok: true,
      warn: true,
      message:
        'HTTP ' +
        res.status +
        ' — expected 403 while gated; restart `npm start` if this keeps failing after unlock',
    };
  }

  if (!res.ok) return { ok: false, message: 'HTTP ' + res.status };
  const text = await res.text();
  if (!String(text || '').trim()) return { ok: false, message: 'empty body' };
  if (urlPath === '/robots.txt' && gatedMode && !/Disallow:\s*\//i.test(text)) {
    return { ok: false, message: 'gated robots.txt should Disallow: /' };
  }
  if (urlPath === '/sitemap.xml' && !/<urlset[\s>]/i.test(text)) {
    return { ok: false, message: 'HTTP ' + res.status + ' — not a urlset sitemap' };
  }
  return { ok: true, message: 'HTTP ' + res.status };
}

async function probeEventsApi() {
  const res = await fetchUrl('/api/hub-listings', { redirect: 'follow' });
  const text = await res.text();
  if (res.status === 403) {
    return { ok: false, message: 'HTTP 403 — unlock preview to reach listings API' };
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, message: 'HTTP ' + res.status + ' — not JSON' };
  }
  if (!res.ok) return { ok: false, message: 'HTTP ' + res.status + ': ' + (data.message || data.error || '') };
  if (data.error) return { ok: false, message: data.message || data.error };
  if (data.configured === false) return { ok: false, message: 'API not configured' };
  const events = Array.isArray(data.events) ? data.events : [];
  return { ok: true, message: events.length + ' events', events };
}

async function probeOpportunitiesApi() {
  const res = await fetchUrl('/api/opportunities', { redirect: 'follow' });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, message: 'HTTP ' + res.status + ' — not JSON' };
  }
  if (!res.ok) return { ok: false, message: 'HTTP ' + res.status + ': ' + (data.message || data.error || '') };
  const list = Array.isArray(data.opportunities) ? data.opportunities : [];
  return { ok: true, message: list.length + ' opportunities', opportunities: list };
}

async function probeOpportunitiesGated() {
  const res = await fetchUrl('/api/opportunities', { redirect: 'manual' });
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    /* non-JSON body is fine as long as it is not a 200 listing */
  }
  if (res.status === 403 && data.error === 'site_private') {
    return { ok: true, message: 'correctly blocked (403 site_private) for anonymous callers' };
  }
  if (res.ok && Array.isArray(data.opportunities)) {
    return { ok: false, message: 'LEAK — returned ' + data.opportunities.length + ' opportunities without preview cookie or session' };
  }
  return { ok: false, message: 'HTTP ' + res.status + ' — expected 403 site_private' };
}

async function probeUnlockEndpointAlive() {
  const res = await fetchUrl('/api/auth/site-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ password: '__smoke_wrong_password__' }),
    redirect: 'manual',
  });
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, message: 'HTTP ' + res.status + ' — not JSON' };
  }
  // Gate on → 401 invalid; gate off → 200 not enabled. Either proves the route is up.
  if (res.status === 401 || (res.status === 200 && data.ok)) {
    return { ok: true, message: 'HTTP ' + res.status + ' — unlock endpoint reachable' };
  }
  return { ok: false, message: 'HTTP ' + res.status + ' — ' + (data.message || data.error || 'unexpected') };
}

function pickSlug(items, keys) {
  for (const item of items || []) {
    for (const key of keys) {
      const v = item && item[key];
      if (v && String(v).trim()) return String(v).trim();
    }
  }
  return null;
}

async function runGatedSmoke() {
  console.log('\nMode: gated (password gate is on; full page smoke needs SITE_ACCESS_PASSWORD)');

  console.log('\nGate surface');
  const siteAccess = await probeHtml({
    path: '/site-access',
    expect: /access|preview|waitlist|password/i,
  });
  printResult(siteAccess.ok, '/site-access', siteAccess.message);

  const home = await fetchUrl('/', { redirect: 'manual' });
  printResult(
    isSiteAccessRedirect(home),
    '/',
    isSiteAccessRedirect(home) ? 'correctly redirects to /site-access' : 'HTTP ' + home.status + ' — expected redirect to gate'
  );

  const unlockApi = await probeUnlockEndpointAlive();
  printResult(unlockApi.ok, '/api/auth/site-access', unlockApi.message);

  console.log('\nDiscovery files');
  for (const p of DISCOVERY) {
    const r = await probeDiscovery(p, true);
    printResult(r.ok, p, r.message, r.warn);
  }

  console.log('\nGated APIs (blocked for anonymous callers)');
  const oppsGated = await probeOpportunitiesGated();
  printResult(oppsGated.ok, '/api/opportunities', oppsGated.message);

  console.log('\nOrganiser early access (no preview password)');
  const organiserPaths = [
    { path: '/login', expect: /log\s*in|sign\s*in|password/i },
    { path: '/register', expect: /register|sign\s*up|create/i },
    { path: '/organiser/', expect: /organis|dashboard|sign\s*in|log\s*in/i },
    { path: '/guides/list-an-event', expect: /list|event|organis/i },
  ];
  for (const page of organiserPaths) {
    const r = await probeHtml(page);
    printResult(r.ok, page.path, r.message);
  }

  console.log('\nTip: export SITE_ACCESS_PASSWORD=… then re-run for the full unlocked smoke.');
}

async function runFullSmoke() {
  console.log('\nMode: full (unlocked / public)');

  console.log('\nPublic pages');
  for (const page of PUBLIC_PAGES) {
    const r = await probeHtml(page);
    printResult(r.ok, page.path, r.message);
  }

  console.log('\nAuth shells (logged out)');
  for (const page of AUTH_SHELLS) {
    const r = await probeHtml(page);
    printResult(r.ok, page.path, r.message);
  }

  console.log('\nDiscovery files');
  for (const p of DISCOVERY) {
    const r = await probeDiscovery(p, false);
    printResult(r.ok, p, r.message, r.warn);
  }

  console.log('\nBrowse APIs');
  const eventsApi = await probeEventsApi();
  printResult(eventsApi.ok, '/api/hub-listings', eventsApi.message);

  const oppsApi = await probeOpportunitiesApi();
  printResult(oppsApi.ok, '/api/opportunities', oppsApi.message);

  console.log('\nSample detail pages');
  const eventSlug = pickSlug(eventsApi.events, ['slug', 'publicSlug', 'eventSlug']);
  if (eventSlug) {
    const r = await probeHtml({ path: '/events/' + eventSlug, expect: /event|ticket|networker/i });
    printResult(r.ok, '/events/' + eventSlug, r.message);
  } else {
    printResult(true, 'event detail', 'skipped — no events in API', true);
  }

  const oppSlug = pickSlug(oppsApi.opportunities, ['slug', 'publicSlug', 'opportunitySlug']);
  if (oppSlug) {
    const r = await probeHtml({ path: '/opportunities/' + oppSlug, expect: /opportunit|enquire|networker/i });
    printResult(r.ok, '/opportunities/' + oppSlug, r.message);
  } else {
    printResult(true, 'opportunity detail', 'skipped — no opportunities in API', true);
  }
}

(async function main() {
  console.log('Smoke test →', base);

  console.log('\nPreview gate');
  const unlock = await unlockPreviewIfNeeded();
  if (unlock.ok === false) {
    printResult(false, 'unlock', unlock.message);
  } else {
    printResult(true, 'unlock', unlock.message || 'ok', unlock.skipped);
  }

  const gated = !(cookieHeader) && (await detectGated());
  if (gated) {
    await runGatedSmoke();
  } else {
    await runFullSmoke();
  }

  console.log('');
  if (failed) {
    console.log('Smoke failed: ' + failed + ' check(s) failed' + (warned ? ', ' + warned + ' warning(s)' : '') + '.');
    if (/localhost|127\.0\.0\.1/.test(base)) {
      console.log('See LOCAL-DEV.md — if npm itself errors with EAGAIN, run the node command directly.');
    }
    process.exit(1);
  }
  console.log('Smoke passed' + (warned ? ' with ' + warned + ' warning(s)' : '') + '.');
  process.exit(0);
})().catch(function (err) {
  console.error('Smoke crashed:', err && err.message ? err.message : err);
  if (/EAGAIN|fetch failed|ECONNREFUSED/i.test(String((err && err.message) || err))) {
    console.error('Tip: ensure `npm start` is Ready on this host, or run:');
    console.error('  node scripts/smoke-test-site.js http://localhost:3000');
  }
  process.exit(1);
});
