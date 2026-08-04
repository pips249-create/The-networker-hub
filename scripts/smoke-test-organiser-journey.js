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
  { path: '/for-organisers', expect: /organis|list your|claim/i },
  { path: '/guides', expect: /guide/i },
  { path: '/guides/list-an-event', expect: /event|list/i },
  { path: '/guides/claim-your-organiser-page', expect: /claim/i },
  { path: '/guides/list-a-conference-or-exhibition', expect: /conference|exhibition/i },
  { path: '/guides/list-a-business-opportunity', expect: /opportunit/i },
  { path: '/guides/invite-your-team', expect: /team|invite/i },
  { path: '/guides/export-attendees-and-visits', expect: /attendee|visit/i },
  { path: '/help/pricing-fees', expect: /fee|pricing/i },
  { path: '/help/organiser-payouts', expect: /payout/i },
  { path: '/faq', expect: /faq|question|guest visit/i },
  { path: '/advertising', expect: /advertis|sponsor/i },
  { path: '/contact', expect: /contact|hubert|hello/i },
  { path: '/about', expect: /about|networker/i },
  { path: '/legal-policies', expect: /privacy|terms|legal/i },
  { path: '/login', expect: /log\s*in|sign\s*in|password/i },
  { path: '/register', expect: /register|sign\s*up|create/i },
  { path: '/forgot-password', expect: /password|reset|forgot/i },
  { path: '/organiser/', expect: /organis|dashboard|sign\s*in|log\s*in/i },
  { path: '/events/', expect: /event/i },
  { path: '/events/?mode=organisers', expect: /organis|event/i },
  { path: '/organisers/circle-networks', expect: /circle|organis|network/i },
  { path: '/opportunities/', expect: /opportunit/i },
  { path: '/for-attendees', expect: /attendee|My Hub|network/i },
];

const ANON_APIS = [
  { path: '/api/auth/session', expectOkJson: true },
  { path: '/api/events?limit=1', expectOkJson: true },
  { path: '/api/organisers?limit=1', expectOkJson: true },
  { path: '/api/opportunities?limit=1', expectOkJson: true },
];

/** Must stay gated for anonymous visitors (cold traffic waitlist). */
const MUST_STAY_GATED = ['/'];

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
  if (isSiteAccessRedirect(res) || (res.status === 200 && /Preview password|Join the preview/i.test(await res.clone().text()))) {
    printResult(true, urlPath, 'still gated for cold traffic (expected)');
    return;
  }
  if (res.status === 200) {
    printResult(false, urlPath, 'homepage is open anonymously — waitlist gate ineffective');
    return;
  }
  printResult(true, urlPath, 'HTTP ' + res.status + ' (not a plain open homepage)');
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

  console.log('1. Email 1 + claim path pages');
  for (const page of ANON_PAGES) {
    await checkPage(page);
  }

  console.log('\n2. Browse APIs used by organiser discovery');
  for (const api of ANON_APIS) {
    await checkApi(api);
  }

  console.log('\n3. Cold-traffic homepage should stay gated');
  for (const p of MUST_STAY_GATED) {
    await checkStaysGated(p);
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
  console.log('✅ Organiser journey pages are open for Email 1 / claim traffic.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
