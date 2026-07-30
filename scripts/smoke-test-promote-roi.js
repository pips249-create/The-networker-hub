#!/usr/bin/env node
/**
 * Smoke test first-party Promote ROI logging.
 *
 * Usage:
 *   node scripts/smoke-test-promote-roi.js
 *   node scripts/smoke-test-promote-roi.js https://www.thenetworkerhub.com
 *
 * Needs local.env with SITE_ACCESS_PASSWORD + Supabase service role.
 * Optional: ORGANISER_SMOKE_EMAIL + ORGANISER_SMOKE_PASSWORD (or ADMIN_EMAIL + ADMIN_INITIAL_PASSWORD)
 * to exercise authenticated /api/organiser/promote-action.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
for (const name of ['local.env', '.env.local', '.env']) {
  const p = path.join(root, name);
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false });
}

const base = String(process.argv[2] || process.env.SMOKE_BASE_URL || 'https://www.thenetworkerhub.com').replace(
  /\/$/,
  ''
);
const siteAccessPassword = String(process.env.SITE_ACCESS_PASSWORD || '').trim();
const loginEmail = String(
  process.env.ORGANISER_SMOKE_EMAIL || process.env.ADMIN_EMAIL || ''
).trim();
const loginPassword = String(
  process.env.ORGANISER_SMOKE_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD || ''
).trim();

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { getPromoteActionStats, recordPromoteAction } = require('../api/_lib/organiser-promote-log');

let cookieJar = '';
let failed = 0;
let warned = 0;
let passed = 0;

function ok(label, message) {
  passed += 1;
  console.log('  OK    ' + label + ' — ' + message);
}

function warn(label, message) {
  warned += 1;
  console.log('  WARN  ' + label + ' — ' + message);
}

function fail(label, message) {
  failed += 1;
  console.log('  FAIL  ' + label + ' — ' + message);
}

function parseSetCookie(res) {
  const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const list = raw.length ? raw : [res.headers.get('set-cookie')].filter(Boolean);
  const parts = [];
  for (const line of list) {
    const first = String(line).split(';')[0].trim();
    if (first) parts.push(first);
  }
  if (!parts.length) return;
  const map = {};
  String(cookieJar || '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const i = pair.indexOf('=');
      if (i > 0) map[pair.slice(0, i)] = pair.slice(i + 1);
    });
  parts.forEach((pair) => {
    const i = pair.indexOf('=');
    if (i > 0) map[pair.slice(0, i)] = pair.slice(i + 1);
  });
  cookieJar = Object.keys(map)
    .map((k) => k + '=' + map[k])
    .join('; ');
}

async function apiFetch(pathname, options) {
  const opts = options || {};
  const headers = Object.assign({}, opts.headers || {});
  if (cookieJar) headers.Cookie = cookieJar;
  if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + pathname, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined,
    redirect: 'manual',
  });
  parseSetCookie(res);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 200) };
  }
  return { status: res.status, data, headers: res.headers };
}

function assertSourceWiring() {
  console.log('\n1) Source wiring');
  const checks = [
    ['api/organiser.js', /promote-action/],
    ['api/promote-analytics.js', /recordPromoteAction/],
    ['api/_lib/organiser-promote-log.js', /getPromoteActionStats/],
    ['api/_lib/admin-insights.js', /promoteRoi/],
    ['js/organiser-linkedin-post-builder.js', /\/api\/organiser\/promote-action/],
    ['js/organiser-event-published.js', /\/api\/organiser\/promote-action/],
    ['js/event-detail.js', /\/api\/promote-analytics/],
    ['js/admin-app.js', /insights-promote/],
    ['supabase/migrations/221_organiser_promote_actions.sql', /organiser_promote_actions/],
  ];
  for (const [rel, re] of checks) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) {
      fail('source:' + rel, 'missing file');
      continue;
    }
    const text = fs.readFileSync(full, 'utf8');
    if (re.test(text)) ok('source:' + rel, 'wired');
    else fail('source:' + rel, 'pattern not found: ' + re);
  }
}

async function unlockPreview() {
  console.log('\n2) Preview gate');
  if (!siteAccessPassword) {
    warn('preview-gate', 'no SITE_ACCESS_PASSWORD — APIs may return site_private');
    return;
  }
  const { status, data } = await apiFetch('/api/auth/site-access', {
    method: 'POST',
    body: { password: siteAccessPassword },
  });
  if (status >= 200 && status < 300 && data && data.ok !== false) {
    ok('preview-gate', 'unlocked (HTTP ' + status + ')');
  } else {
    fail('preview-gate', 'HTTP ' + status + ' ' + JSON.stringify(data));
  }
}

async function checkTable() {
  console.log('\n3) Migration / table');
  if (!isSupabaseConfigured()) {
    fail('supabase', 'not configured in local.env');
    return false;
  }
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('organiser_promote_actions').select('id').limit(1);
  if (error) {
    if (/does not exist|schema cache|organiser_promote_actions/i.test(String(error.message || ''))) {
      fail(
        'migration-221',
        'table missing — apply supabase/migrations/221_organiser_promote_actions.sql in Supabase SQL Editor'
      );
      return false;
    }
    fail('migration-221', error.message);
    return false;
  }
  ok('migration-221', 'organiser_promote_actions readable');
  return true;
}

async function testLandingEndpoint(tableReady) {
  console.log('\n4) Public landing beacon');
  const marker = 'smoke_' + Date.now();
  const { status, data } = await apiFetch('/api/promote-analytics', {
    method: 'POST',
    body: {
      utmCampaign: 'organiser_share',
      utmSource: 'linkedin',
      utmMedium: 'organic',
      utmContent: marker,
      source: 'smoke_test',
      path: '/events/smoke-promote-roi',
    },
  });

  if (status === 403 && data && data.error === 'site_private') {
    fail('landing-api', 'still gated (site_private)');
    return;
  }
  if (status !== 200) {
    fail('landing-api', 'HTTP ' + status + ' ' + JSON.stringify(data));
    return;
  }
  if (data && data.error === 'table_missing') {
    fail('landing-api', 'table_missing — run migration 221');
    return;
  }
  if (data && data.skipped) {
    warn('landing-api', 'skipped: ' + (data.reason || JSON.stringify(data)));
    return;
  }
  if (data && data.ok) {
    ok('landing-api', 'accepted landing beacon');
  } else {
    fail('landing-api', JSON.stringify(data));
    return;
  }

  if (!tableReady) return;
  const sb = getSupabaseAdmin();
  const { data: rows, error } = await sb
    .from('organiser_promote_actions')
    .select('id, action, template_id, source, created_at')
    .eq('action', 'landing')
    .eq('template_id', marker)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    fail('landing-row', error.message);
    return;
  }
  if (rows && rows.length) ok('landing-row', 'persisted template_id=' + marker);
  else fail('landing-row', 'no row found for smoke marker');
}

async function testAuthEndpoint(tableReady) {
  console.log('\n5) Authenticated promote-action');
  const unauth = await apiFetch('/api/organiser/promote-action', {
    method: 'POST',
    body: { action: 'download', source: 'smoke_test' },
  });
  if (unauth.status === 401 || (unauth.data && unauth.data.error === 'not_authenticated')) {
    ok('promote-action-auth', 'rejects unauthenticated (expected)');
  } else if (unauth.status === 403 && unauth.data && unauth.data.error === 'site_private') {
    fail('promote-action-auth', 'site still private');
  } else {
    warn('promote-action-auth', 'unexpected HTTP ' + unauth.status + ' ' + JSON.stringify(unauth.data));
  }

  if (!loginEmail || !loginPassword) {
    warn('promote-action-login', 'no ORGANISER_SMOKE_* / ADMIN_* credentials — skipping authenticated write');
    return;
  }

  const login = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: { email: loginEmail, password: loginPassword },
  });
  if (!(login.status >= 200 && login.status < 300 && login.data && (login.data.ok !== false))) {
    // Some auth routes return user without ok flag
    if (!(login.status >= 200 && login.status < 300 && (login.data?.user || login.data?.session))) {
      fail('login', 'HTTP ' + login.status + ' ' + JSON.stringify(login.data));
      return;
    }
  }
  ok('login', 'signed in as ' + loginEmail);

  const marker = 'smoke_dl_' + Date.now();
  const write = await apiFetch('/api/organiser/promote-action', {
    method: 'POST',
    body: {
      action: 'download',
      source: 'smoke_test',
      templateId: marker,
      templateGroup: 'events',
    },
  });
  if (write.status !== 200 || !(write.data && write.data.ok)) {
    if (write.data && write.data.error === 'table_missing') {
      fail('promote-action-write', 'table_missing — run migration 221');
      return;
    }
    fail('promote-action-write', 'HTTP ' + write.status + ' ' + JSON.stringify(write.data));
    return;
  }
  ok('promote-action-write', 'download logged');

  if (!tableReady) return;
  const sb = getSupabaseAdmin();
  const { data: rows, error } = await sb
    .from('organiser_promote_actions')
    .select('id, action, template_id, actor_email')
    .eq('action', 'download')
    .eq('template_id', marker)
    .limit(1);
  if (error) {
    fail('promote-action-row', error.message);
    return;
  }
  if (rows && rows.length) ok('promote-action-row', 'persisted for ' + (rows[0].actor_email || 'actor'));
  else fail('promote-action-row', 'row not found');
}

async function testStats(tableReady) {
  console.log('\n6) Admin stats helper');
  if (!tableReady) {
    warn('stats', 'skipped — table not ready');
    return;
  }
  const direct = await recordPromoteAction({
    action: 'copy_caption',
    source: 'smoke_test',
    templateId: 'smoke_stats_' + Date.now(),
    actorEmail: 'smoke@thenetworkerhub.test',
  });
  if (!direct.ok) {
    fail('stats-seed', JSON.stringify(direct));
    return;
  }
  const stats = await getPromoteActionStats('7d');
  if (!stats.configured) {
    fail('stats', stats.message || 'not configured');
    return;
  }
  if ((stats.toolUses || 0) < 1 && (stats.landings || 0) < 1) {
    warn('stats', 'configured but zero activity in 7d sample');
  } else {
    ok(
      'stats',
      'toolUses=' +
        stats.toolUses +
        ' landings=' +
        stats.landings +
        ' organisers=' +
        stats.uniqueOrganisers
    );
  }
}

async function testDeployedAssets() {
  console.log('\n7) Deployed client assets');
  const assets = [
    ['/js/organiser-linkedin-post-builder.js?v=20260729roi1', /\/api\/organiser\/promote-action/],
    ['/js/event-detail.js?v=20260729roi1', /\/api\/promote-analytics/],
    ['/js/admin-app.js?v=20260729roi1', /Promote ROI/],
    ['/js/organiser-event-published.js?v=20260729roi1', /\/api\/organiser\/promote-action/],
  ];
  for (const [urlPath, re] of assets) {
    const res = await fetch(base + urlPath, {
      headers: cookieJar ? { Cookie: cookieJar } : {},
      redirect: 'follow',
    });
    const text = await res.text();
    if (!res.ok) {
      fail('asset:' + urlPath, 'HTTP ' + res.status);
      continue;
    }
    if (re.test(text)) ok('asset:' + urlPath.split('?')[0], 'contains ROI wiring');
    else fail('asset:' + urlPath.split('?')[0], 'ROI wiring missing from deployed file');
  }
}

(async function main() {
  console.log('Promote ROI smoke — ' + base);
  assertSourceWiring();
  await unlockPreview();
  const tableReady = await checkTable();
  await testLandingEndpoint(tableReady);
  await testAuthEndpoint(tableReady);
  await testStats(tableReady);
  await testDeployedAssets();

  console.log('\nSummary: ' + passed + ' ok, ' + warned + ' warn, ' + failed + ' fail');
  if (failed) {
    console.log('\nIf migration-221 failed: open Supabase → SQL Editor → paste 221_organiser_promote_actions.sql → Run.');
    process.exit(1);
  }
  console.log('\nSmoke passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
