#!/usr/bin/env node
/**
 * Smoke opportunities browse/compare UI assets + listing subscription pricing/checkout gates.
 *
 * Usage:
 *   node scripts/smoke-test-opportunities.js
 *   node scripts/smoke-test-opportunities.js http://localhost:3002
 *   node scripts/smoke-test-opportunities.js https://www.thenetworkeruk.com
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
for (const name of ['local.env', '.env.local', '.env']) {
  const p = path.join(root, name);
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false });
}

const base = (process.argv[2] || 'http://localhost:3002').replace(/\/$/, '');
const PASSWORD = String(process.env.SITE_ACCESS_PASSWORD || '').trim();

let cookieHeader = '';
let failed = 0;
let passed = 0;

function ok(label, detail) {
  passed += 1;
  console.log('  OK   ' + label + (detail ? ' — ' + detail : ''));
}

function fail(label, detail) {
  failed += 1;
  console.log('  FAIL ' + label + (detail ? ' — ' + detail : ''));
}

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

async function getText(urlPath) {
  const res = await fetchUrl(urlPath);
  const text = await res.text();
  return { status: res.status, text, headers: res.headers };
}

async function postJson(urlPath, body) {
  const res = await fetchUrl(urlPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = { raw: text.slice(0, 240) };
  }
  return { status: res.status, data };
}

async function unlockGate() {
  if (!PASSWORD) return false;
  const res = await fetchUrl('/api/site-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  });
  return res.status === 200 || res.status === 204;
}

async function main() {
  console.log('Opportunities smoke →', base);

  // --- Unit: listing subscription pricing (no server) ---
  const pricing = require('../api/_lib/opportunity-listing-pricing');
  const totals = pricing.calculateOpportunityListingTotals(1);
  if (totals.billingMode === 'subscription' && totals.monthlyExVatPence === 2500 && totals.totalPence === 3000) {
    ok('listing pricing', '£25 + VAT = £30 / month');
  } else {
    fail('listing pricing', JSON.stringify(totals));
  }

  const subs = require('../api/_lib/opportunity-listing-subscriptions');
  if (typeof subs.handleOpportunityListingCheckoutCompleted === 'function') {
    ok('listing subscription handlers exported');
  } else {
    fail('listing subscription handlers exported');
  }

  // --- Optional gate unlock ---
  if (PASSWORD) {
    const unlocked = await unlockGate();
    if (unlocked) ok('site gate unlock');
    else fail('site gate unlock');
  } else {
    console.log('  skip site gate unlock (no SITE_ACCESS_PASSWORD)');
  }

  // --- Browse page shell ---
  const browse = await getText('/opportunities/');
  if (browse.status === 200 && /opportunit/i.test(browse.text)) ok('GET /opportunities/', 'HTTP 200');
  else fail('GET /opportunities/', 'HTTP ' + browse.status);

  const requiredScripts = [
    'opportunity-compare.js',
    'opportunities-page.js',
    'opportunities-saves.js',
    'opportunities-catalog.js',
  ];
  for (const script of requiredScripts) {
    if (browse.text.includes(script)) ok('browse includes ' + script);
    else fail('browse includes ' + script);
  }

  if (/bo-opp-compare|HubOpportunityCompare|data-opp-compare-id|Compare/.test(browse.text) || browse.text.includes('opportunity-compare.js')) {
    ok('browse wired for compare assets');
  } else {
    fail('browse wired for compare assets');
  }

  // Quick look should be gone from browse JS
  const pageJs = await getText('/js/opportunities-page.js');
  if (pageJs.status === 200) {
    ok('GET /js/opportunities-page.js');
    if (/Quick look|bo-opp-preview-drawer|bo-opp-expand-btn/.test(pageJs.text)) {
      fail('Quick look removed from opportunities-page.js', 'still found expand/preview markers');
    } else {
      ok('Quick look removed from opportunities-page.js');
    }
    if (/bo-opp-compare-btn|bindCompareControls|bo-opp-compare-tray/.test(pageJs.text)) {
      ok('browse compare tray/controls present in JS');
    } else {
      fail('browse compare tray/controls present in JS');
    }
  } else {
    fail('GET /js/opportunities-page.js', 'HTTP ' + pageJs.status);
  }

  const compareJs = await getText('/js/opportunity-compare.js');
  if (compareJs.status === 200 && /openModal|HubOpportunityCompare/.test(compareJs.text)) {
    ok('GET /js/opportunity-compare.js');
  } else {
    fail('GET /js/opportunity-compare.js', 'HTTP ' + compareJs.status);
  }

  // --- Public opportunities API ---
  const api = await getText('/api/opportunities');
  let oppData = null;
  try {
    oppData = JSON.parse(api.text);
  } catch (_) {
    oppData = null;
  }
  if (api.status === 200 && oppData && oppData.ok && Array.isArray(oppData.opportunities)) {
    ok('GET /api/opportunities', oppData.opportunities.length + ' listings');
    const sample = oppData.opportunities[0];
    if (sample && sample.id && sample.title) ok('opportunity payload has id/title');
    else fail('opportunity payload has id/title');
  } else if (api.status === 403 || api.status === 401) {
    fail('GET /api/opportunities', 'HTTP ' + api.status + ' (gate/auth blocked)');
  } else {
    fail('GET /api/opportunities', 'HTTP ' + api.status);
  }

  // --- Listing subscription checkout gate (no session → auth error) ---
  const checkout = await postJson('/api/organiser/opportunity-listing-checkout', {
    opportunityId: '00000000-0000-4000-8000-000000000000',
  });
  if (checkout.status === 401 || checkout.status === 403) {
    ok('listing checkout requires session', 'HTTP ' + checkout.status + ' ' + (checkout.data && checkout.data.error));
  } else if (checkout.status === 503 && checkout.data && /stripe/i.test(String(checkout.data.error || ''))) {
    ok('listing checkout reaches Stripe config check', String(checkout.data.error));
  } else {
    fail(
      'listing checkout requires session',
      'HTTP ' + checkout.status + ' ' + JSON.stringify(checkout.data || {}).slice(0, 160)
    );
  }

  const complete = await postJson('/api/organiser/opportunity-listing-complete', {
    session_id: 'cs_test_smoke',
  });
  if (complete.status === 401 || complete.status === 403) {
    ok('listing complete requires session', 'HTTP ' + complete.status);
  } else if (complete.status === 400 || complete.status === 404) {
    ok('listing complete rejects bad session without auth crash', 'HTTP ' + complete.status);
  } else {
    fail('listing complete requires session', 'HTTP ' + complete.status + ' ' + JSON.stringify(complete.data || {}).slice(0, 160));
  }

  // --- Organiser list / success shells ---
  for (const p of ['/opportunities/list', '/organiser/opportunity-edit', '/organiser/opportunity-listing-success']) {
    const page = await getText(p);
    if (page.status === 200 || page.status === 302 || page.status === 307) {
      ok('page ' + p, 'HTTP ' + page.status);
    } else {
      fail('page ' + p, 'HTTP ' + page.status);
    }
  }

  console.log('');
  console.log(failed ? 'FAILED ' + failed + ' check(s), passed ' + passed : 'All ' + passed + ' opportunity smoke checks passed.');
  process.exit(failed ? 1 : 0);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
