#!/usr/bin/env node
/**
 * Smoke test series pass + bundle checkout helpers and (when configured) live data.
 *
 * Usage:
 *   node scripts/smoke-test-series-checkout.js
 *   node scripts/smoke-test-series-checkout.js http://localhost:3000
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
for (const name of ['local.env', '.env.local', '.env']) {
  const p = path.join(root, name);
  if (fs.existsSync(p)) dotenv.config({ path: p });
}

const base = String(process.argv[2] || process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(
  /\/$/,
  ''
);
const siteAccessPassword = String(process.env.SITE_ACCESS_PASSWORD || '').trim();

let cookieJar = '';

const {
  isSeriesPassTicket,
  bundleMetadataFromItems,
  parseBundleMetadata,
  newBookingGroupId,
  resolveSeriesBundleItems,
  resolveSeriesPassItems,
} = require('../api/_lib/series-bundle-checkout');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');

let failed = 0;
let warned = 0;

function ok(label, message) {
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

function assert(label, condition, message) {
  if (condition) ok(label, message || 'passed');
  else fail(label, message || 'assertion failed');
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
  const headers = Object.assign({ Accept: 'application/json' }, opts.headers || {});
  if (cookieJar) headers.Cookie = cookieJar;
  if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + pathname, {
    method: opts.method || 'GET',
    headers,
    body: opts.body,
    redirect: 'manual',
    cache: 'no-store',
  });
  parseSetCookie(res);
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { res, data, status: res.status };
}

async function unlockPreviewIfNeeded() {
  if (!siteAccessPassword) {
    warn('preview-gate', 'no SITE_ACCESS_PASSWORD — API may return 403 on gated hosts');
    return;
  }
  const { status, data } = await apiFetch('/api/auth/site-access', {
    method: 'POST',
    body: JSON.stringify({ password: siteAccessPassword }),
  });
  if (status === 200 && data.ok) {
    ok('preview-gate', 'unlocked');
    return;
  }
  if (status === 200 && /not enabled/i.test(String(data.message || ''))) {
    ok('preview-gate', 'not enabled on this host');
    return;
  }
  fail('preview-gate', 'HTTP ' + status + ': ' + (data.message || data.error || 'unlock failed'));
}

function runUnitTests() {
  console.log('\nUnit helpers');

  assert(
    'isSeriesPassTicket',
    isSeriesPassTicket({ series_scope: 'series_pass' }) &&
      !isSeriesPassTicket({ series_scope: 'date' }),
    'detects series_pass scope'
  );

  const items = [
    { eventId: 'e1', ticketId: 't1' },
    { eventId: 'e2', ticketId: 't2' },
    { eventId: 'e3', ticketId: 't3' },
  ];
  const meta = bundleMetadataFromItems(items);
  assert(
    'bundleMetadataFromItems',
    meta.bundle_event_ids === 'e1,e2,e3' && meta.bundle_ticket_ids === 't1,t2,t3',
    'comma-separated ids'
  );

  const parsed = parseBundleMetadata(meta);
  assert(
    'parseBundleMetadata',
    parsed.length === 3 &&
      parsed[0].eventId === 'e1' &&
      parsed[2].ticketId === 't3',
    'round-trip metadata'
  );
  assert('parseBundleMetadata empty', parseBundleMetadata({}).length === 0, 'empty metadata');

  const groupId = newBookingGroupId();
  assert(
    'newBookingGroupId',
    /^[0-9a-f-]{36}$/i.test(groupId),
    groupId.slice(0, 8) + '…'
  );
}

async function checkSchema(sb) {
  console.log('\nDatabase schema');

  const regRes = await sb
    .from('registrations')
    .select('booking_group_id, registration_kind')
    .limit(1);
  if (regRes.error && /booking_group_id|registration_kind/i.test(regRes.error.message)) {
    fail('migration-173', 'Run supabase/migrations/173_series_bundle_registrations.sql');
  } else if (regRes.error) {
    fail('registrations-select', regRes.error.message);
  } else {
    ok('migration-173', 'booking_group_id + registration_kind readable');
  }

  const ticketRes = await sb.from('tickets').select('series_scope').limit(1);
  if (ticketRes.error && /series_scope/i.test(ticketRes.error.message)) {
    fail('migration-174', 'Run supabase/migrations/174_series_pass_tickets.sql');
  } else if (ticketRes.error) {
    fail('tickets-select', ticketRes.error.message);
  } else {
    ok('migration-174', 'series_scope readable');
  }
}

async function findMultiDateSeries(sb) {
  const { data, error } = await sb
    .from('events')
    .select('id, title, series_group_id, status, approval_status, starts_at')
    .not('series_group_id', 'is', null)
    .ilike('status', 'published')
    .eq('approval_status', 'Approved')
    .order('starts_at', { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);

  const byGroup = new Map();
  (data || []).forEach((row) => {
    const key = row.series_group_id;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(row);
  });

  for (const [, peers] of byGroup) {
    if (peers.length >= 2) return peers;
  }
  return null;
}

async function findPassTicket(sb, peerIds) {
  const { data, error } = await sb
    .from('tickets')
    .select('id, event_id, name, series_scope, status')
    .in('event_id', peerIds)
    .eq('series_scope', 'series_pass')
    .limit(20);
  if (error) {
    if (/series_scope/i.test(error.message)) return null;
    throw new Error(error.message);
  }
  return (data || []).find((t) => String(t.status || 'Active').toLowerCase() !== 'paused') || null;
}

async function findBundleTicket(sb, peerIds) {
  let data;
  let error;
  ({ data, error } = await sb
    .from('tickets')
    .select('id, event_id, name, price, series_scope, ticket_type, visibility, status')
    .in('event_id', peerIds)
    .limit(100));
  if (error && /series_scope/i.test(error.message)) {
    ({ data, error } = await sb
      .from('tickets')
      .select('id, event_id, name, price, ticket_type, visibility, status')
      .in('event_id', peerIds)
      .limit(100));
  }
  if (error) throw new Error(error.message);

  const byNamePrice = new Map();
  (data || []).forEach((ticket) => {
    if (String(ticket.series_scope || 'date').trim() === 'series_pass') return;
    if (String(ticket.status || 'Active').toLowerCase() === 'paused') return;
    const key =
      String(ticket.name || '')
        .trim()
        .toLowerCase() +
      '|' +
      String(ticket.price || '').trim();
    if (!byNamePrice.has(key)) byNamePrice.set(key, []);
    byNamePrice.get(key).push(ticket);
  });

  for (const [, tickets] of byNamePrice) {
    const eventIds = new Set(tickets.map((t) => t.event_id));
    if (eventIds.size >= 2) {
      return tickets.find((t) => peerIds.includes(t.event_id)) || tickets[0];
    }
  }
  return null;
}

async function runSupabaseResolutionTests(sb) {
  console.log('\nSeries resolution (live data)');

  const peers = await findMultiDateSeries(sb);
  if (!peers) {
    warn('multi-date-series', 'no published multi-date series in database — skipping resolution');
    return;
  }

  const peerIds = peers.map((p) => p.id);
  ok('multi-date-series', peers.length + ' dates — "' + (peers[0].title || 'Event').slice(0, 40) + '"');

  const bundleTicket = await findBundleTicket(sb, peerIds);
  if (bundleTicket) {
    try {
      const bundle = await resolveSeriesBundleItems(sb, {
        eventId: bundleTicket.event_id,
        ticketId: bundleTicket.id,
        email: 'series-smoke+' + Date.now() + '@example.com',
        userId: null,
      });
      assert(
        'resolveSeriesBundleItems',
        bundle.items.length >= 2 &&
          bundle.checkoutQty === bundle.items.length &&
          bundle.pricingMode === 'per_date',
        bundle.items.length + ' dates, checkoutQty=' + bundle.checkoutQty
      );
    } catch (e) {
      fail('resolveSeriesBundleItems', e.message || String(e));
    }
  } else {
    warn('bundle-ticket', 'no matching per-date tier across series — skipping bundle resolution');
  }

  const passTicket = await findPassTicket(sb, peerIds);
  if (passTicket) {
    try {
      const pass = await resolveSeriesPassItems(sb, {
        eventId: passTicket.event_id,
        ticketId: passTicket.id,
        email: 'series-smoke+' + Date.now() + '@example.com',
        userId: null,
      });
      assert(
        'resolveSeriesPassItems',
        pass.items.length >= 2 &&
          pass.checkoutQty === 1 &&
          pass.pricingMode === 'series_pass',
        pass.items.length + ' dates, one checkout @ £' + pass.unitPrice
      );
    } catch (e) {
      fail('resolveSeriesPassItems', e.message || String(e));
    }
  } else {
    warn(
      'series-pass-tier',
      'no series_pass ticket on this series — tick Full series pass on a tier to test pass checkout'
    );
  }
}

async function runApiChecks() {
  console.log('\nHTTP / API');

  await unlockPreviewIfNeeded();

  try {
    const { status, data } = await apiFetch('/api/hub-listings');
    if (status !== 200 || data.error) {
      fail('hub-listings', 'HTTP ' + status + ' — ' + (data.message || data.error || 'error'));
    } else if (!data.configured) {
      fail('hub-listings', 'API not configured');
    } else {
      ok('hub-listings', (data.events || []).length + ' events');
    }
  } catch (e) {
    fail('hub-listings', e.message || 'fetch failed — is the dev server running?');
  }

  if (!isSupabaseConfigured()) return;

  const sb = getSupabaseAdmin();
  const peers = await findMultiDateSeries(sb);
  if (!peers || !peers[0]) return;

  try {
    const { status, data: listing } = await apiFetch(
      '/api/hub-listings?id=' + encodeURIComponent(peers[0].id)
    );
    const seriesCount = (listing.seriesDates || []).length;
    assert(
      'hub-listings-series',
      status === 200 && seriesCount >= 2,
      seriesCount + ' seriesDates for anchor event'
    );

    const tiers = (listing.event && listing.event.tickets) || [];
    const hasPassFlag = tiers.some((t) => t.isSeriesPass);
    const passTicket = await findPassTicket(sb, peers.map((p) => p.id));
    if (passTicket && !hasPassFlag) {
      fail('listing-isSeriesPass', 'pass tier in DB but isSeriesPass missing from API');
    } else if (hasPassFlag) {
      ok('listing-isSeriesPass', 'pass tier exposed on public listing');
    } else if (!passTicket) {
      ok('listing-isSeriesPass', 'no pass tier on this series (expected until migration 174 + tier setup)');
    }
  } catch (e) {
    fail('hub-listings-series', e.message || 'fetch failed');
  }
}

function runStaticChecks() {
  console.log('\nStatic assets');

  const eventDetail = fs.readFileSync(path.join(root, 'js/event-detail.js'), 'utf8');
  assert(
    'event-detail-series-pass',
    eventDetail.includes('data-series-pass') &&
      eventDetail.includes('seriesCheckoutOptions') &&
      eventDetail.includes('bookSeriesPass'),
    'pass + bundle checkout wiring'
  );

  const attendeeDash = fs.readFileSync(path.join(root, 'js/attendee-dashboard.js'), 'utf8');
  assert(
    'attendee-dashboard-grouping',
    attendeeDash.includes('groupSeriesRegistrations') &&
      attendeeDash.includes('seriesDateLabel'),
    'series grouping in My Hub'
  );

  const bookingSuccess = fs.readFileSync(path.join(root, 'js/booking-success.js'), 'utf8');
  assert(
    'booking-success-copy',
    bookingSuccess.includes('buildConfirmationMessage') &&
      bookingSuccess.includes('bookSeriesPass'),
    'pass/bundle confirmation messaging'
  );
}

(async function main() {
  console.log('Series checkout smoke → ' + base);

  runUnitTests();
  runStaticChecks();
  await runApiChecks();

  if (isSupabaseConfigured()) {
    try {
      const sb = getSupabaseAdmin();
      await checkSchema(sb);
      await runSupabaseResolutionTests(sb);
    } catch (e) {
      fail('supabase', e.message || String(e));
    }
  } else {
    warn('supabase', 'SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY not set — skipping DB checks');
  }

  console.log('');
  if (failed) {
    console.error('Series checkout smoke failed: ' + failed + ' failure(s)' + (warned ? ', ' + warned + ' warning(s)' : '') + '.');
    process.exit(1);
  }
  console.log(
    'Series checkout smoke passed' +
      (warned ? ' (' + warned + ' warning(s) — see above)' : '') +
      '.'
  );
})();
