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
  { path: '/about', expect: /about|networker/i },
  { path: '/legal-policies', expect: /privacy|terms|legal/i },
  { path: '/login', expect: /log\s*in|sign\s*in|password/i },
  { path: '/register', expect: /register|sign\s*up|create/i },
  { path: '/forgot-password', expect: /password|reset|forgot/i },
  { path: '/organiser/', expect: /organis|dashboard|sign\s*in|log\s*in/i },
];

const ANON_APIS = [{ path: '/api/auth/session', expectOkJson: true }];

/** Must stay gated for anonymous visitors (catalogue + deeper help). */
const MUST_STAY_GATED = [
  '/',
  '/events/',
  '/events/?mode=organisers',
  '/organisers/circle-networks',
  '/opportunities/',
  '/for-attendees',
  '/guides',
  '/guides/list-an-event',
  '/faq',
  '/advertising',
  '/help/pricing-fees',
];

const MUST_STAY_PRIVATE_APIS = [
  '/api/events?limit=1',
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

  console.log('\n4. Every internal link on /for-organisers must be early-access');
  const links = await extractForOrganisersLinks();
  if (!links.length) {
    printResult(false, '/for-organisers links', 'could not parse links');
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
    console.error('Failed: ' + failed + ' check(s). Deploy middleware early-access fixes before Email 1.');
    process.exit(1);
  }
  console.log('✅ Organiser Email 1 funnel open; public catalogue still gated.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
