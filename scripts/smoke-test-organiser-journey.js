#!/usr/bin/env node
/**
 * Organiser Email 1 / early-access journey smoke test.
 *
 * Runs WITHOUT the preview password — the same way real organisers hit the site
 * from Email 1 (for-organisers) and Email 2 (login → claim → dashboard).
 *
 * Usage:
 *   node scripts/smoke-test-organiser-journey.js
 *   node scripts/smoke-test-organiser-journey.js https://www.thenetworkerhub.com
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
for (const name of ['local.env', '.env.local', '.env']) {
  const p = path.join(root, name);
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false });
}

const base = (process.argv[2] || process.env.SITE_URL || 'https://www.thenetworkerhub.com').replace(
  /\/$/,
  ''
);

/** Must open anonymously (no site-access redirect) before Email 1. */
const ANON_PAGES = [
  { path: '/for-organisers', expect: /organis|what.?s included|contact|september/i },
  { path: '/contact', expect: /contact|hubert|hello/i },
  { path: '/peek', expect: /sneak peek|networker/i },
  { path: '/peek/about-us', expect: /about|networker|september/i },
  { path: '/peek/for-organisers', expect: /organis|september/i },
  { path: '/peek/for-networkers', expect: /networker|september|hub/i },
  { path: '/legal-policies', expect: /privacy|terms|legal/i },
  { path: '/login', expect: /log\s*in|sign\s*in|password/i },
  { path: '/register', expect: /register|sign\s*up|create/i },
  { path: '/forgot-password', expect: /password|reset|forgot/i },
  { path: '/organiser/', expect: /organis|dashboard|sign\s*in|log\s*in/i },
  { path: '/guides/claim-your-organiser-page', expect: /claim|organiser/i },
  { path: '/guides/list-an-event', expect: /list|event|ticket/i },
  { path: '/guides/list-a-conference-or-exhibition', expect: /conference|exhibition|event/i },
  { path: '/guides/list-a-business-opportunity', expect: /business|opportunit/i },
  { path: '/guides/invite-your-team', expect: /team|invite/i },
  { path: '/account/', expect: /account|sign\s*in|log\s*in|my hub/i },
  { path: '/advertising', expect: /advertis|sponsor|partner/i },
  { path: '/help/pricing-fees', expect: /fee|pricing|booking/i },
  { path: '/help/organiser-payouts', expect: /payout|stripe|connect/i },
  { path: '/add-your-event', expect: /event|list|send|details|intake/i },
];

const ANON_APIS = [{ path: '/api/auth/session', expectOkJson: true }];

/** Must stay gated for anonymous visitors (public catalogue + attendee marketing). */
const MUST_STAY_GATED = [
  '/',
  '/events/',
  '/events/?mode=organisers',
  '/opportunities/',
  '/guides',
  '/faq',
];

/** Legacy soft-launch URLs should land in the closed /peek mini-site. */
const PEEK_REDIRECTS = [
  { path: '/about', expect: '/peek/about-us' },
  { path: '/for-networkers', expect: '/peek/for-networkers' },
  { path: '/for-attendees', expect: '/peek/for-networkers' },
];

const MUST_STAY_PRIVATE_APIS = [
  '/api/events?limit=1',
  '/api/events?probe=1',
  '/api/organisers?limit=1',
  '/api/opportunities?limit=1',
];

let failed = 0;

function printResult(ok, label, message) {
  console.log('  ' + (ok ? 'OK  ' : 'FAIL') + '  ' + label + ' — ' + message);
  if (!ok) failed += 1;
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

async function fetchUrl(urlPath) {
  return fetch(base + urlPath, {
    redirect: 'manual',
    cache: 'no-store',
    headers: { Accept: 'text/html,application/json' },
  });
}

async function checkPage(item) {
  const res = await fetchUrl(item.path);
  if (isSiteAccessRedirect(res)) {
    printResult(false, item.path, 'redirects to site-access gate (organiser early-access missing)');
    return;
  }
  if (res.status !== 200) {
    printResult(false, item.path, 'HTTP ' + res.status);
    return;
  }
  const html = await res.text();
  if (/Join the preview list|Preview password/i.test(html) && /site-access/i.test(html)) {
    printResult(false, item.path, 'returned site-access waitlist HTML');
    return;
  }
  if (item.expect && !item.expect.test(html)) {
    printResult(false, item.path, '200 but body did not match expected content');
    return;
  }
  printResult(true, item.path, 'open anonymously (' + html.length + ' bytes)');
}

async function checkApi(item) {
  const res = await fetchUrl(item.path);
  if (res.status === 403) {
    const body = await res.text();
    printResult(false, item.path, '403 site_private — browse/API early-access missing');
    return;
  }
  if (isSiteAccessRedirect(res)) {
    printResult(false, item.path, 'redirects to site-access');
    return;
  }
  if (res.status < 200 || res.status >= 500) {
    printResult(false, item.path, 'HTTP ' + res.status);
    return;
  }
  if (item.expectOkJson) {
    try {
      const data = await res.json();
      printResult(true, item.path, 'HTTP ' + res.status + ' json keys: ' + Object.keys(data).slice(0, 6).join(','));
      return;
    } catch {
      printResult(false, item.path, 'not JSON');
      return;
    }
  }
  printResult(true, item.path, 'HTTP ' + res.status);
}

async function checkStaysGated(urlPath) {
  const res = await fetchUrl(urlPath);
  if (isSiteAccessRedirect(res)) {
    printResult(true, urlPath, 'still gated (expected)');
    return;
  }
  if (res.status === 403) {
    printResult(true, urlPath, '403 site_private (expected)');
    return;
  }
  if (res.status === 200) {
    const body = await res.text();
    if (/Preview password|Join the preview/i.test(body)) {
      printResult(true, urlPath, 'still gated for cold traffic (expected)');
      return;
    }
    printResult(false, urlPath, 'open anonymously — catalogue should stay behind the waitlist');
    return;
  }
  printResult(true, urlPath, 'HTTP ' + res.status + ' (not anonymously open)');
}

async function checkPrivateApi(urlPath) {
  const res = await fetchUrl(urlPath);
  if (res.status === 403) {
    printResult(true, urlPath, '403 site_private (catalogue locked)');
    return;
  }
  if (isSiteAccessRedirect(res)) {
    printResult(true, urlPath, 'gated');
    return;
  }
  printResult(false, urlPath, 'HTTP ' + res.status + ' — catalogue API should be private anonymously');
}

async function extractForOrganisersLinks() {
  const res = await fetchUrl('/for-organisers');
  if (res.status !== 200) return [];
  const html = await res.text();
  const hrefs = new Set();
  const re = /href="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    if (href.startsWith('/css') || href.startsWith('/js') || href.startsWith('/assets') || href.startsWith('/favicon'))
      continue;
    hrefs.add(href.split('#')[0].split('?')[0] || '/');
  }
  return [...hrefs];
}

async function checkPeekRedirect(item) {
  let path = item.path;
  let dest = path;
  let hops = 0;
  let lastStatus = 0;
  // Follow rename + soft-launch hops (e.g. /for-attendees → /for-networkers → /peek/…).
  while (hops < 5) {
    const res = await fetchUrl(path);
    lastStatus = res.status;
    if (res.status < 300 || res.status >= 400) break;
    dest = locationPath(res);
    if (!dest || dest === path) break;
    hops += 1;
    path = dest;
    if (dest === item.expect || dest.startsWith(item.expect + '?')) {
      printResult(true, item.path, '→ ' + dest + (hops > 1 ? ' (' + hops + ' hops)' : ''));
      return;
    }
  }
  if (dest === item.expect || dest.startsWith(item.expect + '?')) {
    printResult(true, item.path, '→ ' + dest);
    return;
  }
  if (lastStatus < 300 || lastStatus >= 400) {
    printResult(false, item.path, 'expected redirect to ' + item.expect + ', got HTTP ' + lastStatus);
    return;
  }
  printResult(false, item.path, 'expected ' + item.expect + ', got ' + dest);
}

async function main() {
  console.log('Organiser journey smoke (anonymous / no preview password)');
  console.log('Base: ' + base + '\n');

  console.log('1. Email 1 + claim path pages (open)');
  for (const page of ANON_PAGES) {
    await checkPage(page);
  }

  console.log('\n2. Auth API (open)');
  for (const api of ANON_APIS) {
    await checkApi(api);
  }

  console.log('\n3. Public catalogue must stay gated');
  for (const p of MUST_STAY_GATED) {
    await checkStaysGated(p);
  }
  for (const api of MUST_STAY_PRIVATE_APIS) {
    await checkPrivateApi(api);
  }

  console.log('\n4. Legacy soft-launch URLs redirect into /peek');
  for (const item of PEEK_REDIRECTS) {
    await checkPeekRedirect(item);
  }

  console.log('\n5. Every internal link on /for-organisers must be early-access');
  const links = await extractForOrganisersLinks();
  if (!links.length) {
    // Email 1 soft-trust page is intentionally link-light (nav injected by JS; CTAs are mailto/#).
    printResult(true, '/for-organisers links', 'no static catalogue links (Email 1 soft-trust OK)');
  } else {
    for (const href of links.sort()) {
      if (href === '/' || href === '') continue;
      const res = await fetchUrl(href);
      if (isSiteAccessRedirect(res)) {
        printResult(false, 'link ' + href, 'gated — fix middleware early-access or remove link');
      } else if (res.status >= 400) {
        printResult(false, 'link ' + href, 'HTTP ' + res.status);
      } else {
        printResult(true, 'link ' + href, 'HTTP ' + res.status);
      }
    }
  }

  console.log('');
  if (failed) {
    console.error('Failed: ' + failed + ' check(s). Deploy middleware early-access fixes before Email 2.');
    process.exit(1);
  }
  console.log('✅ Organiser Email 1 funnel open; public catalogue still gated for anonymous visitors.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
