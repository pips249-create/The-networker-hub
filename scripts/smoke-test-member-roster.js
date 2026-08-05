#!/usr/bin/env node
/**
 * Smoke-test member list APIs against a running local/live server.
 *
 * Usage:
 *   node scripts/smoke-test-member-roster.js
 *   node scripts/smoke-test-member-roster.js http://localhost:3000
 *   node scripts/smoke-test-member-roster.js https://www.thenetworkerhub.com
 *
 * Credentials (local.env / shell):
 *   SMOKE_ORGANISER_EMAIL + SMOKE_ORGANISER_PASSWORD
 *     — or ADMIN_EMAIL + ADMIN_INITIAL_PASSWORD
 *   SMOKE_ATTENDEE_EMAIL + SMOKE_ATTENDEE_PASSWORD  (optional eligibility login)
 *   SITE_ACCESS_PASSWORD                            (when preview gate is on)
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY        (direct helper checks)
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

const organiserEmail = String(
  process.env.SMOKE_ORGANISER_EMAIL || process.env.ADMIN_EMAIL || ''
)
  .trim()
  .toLowerCase();
const organiserPassword = String(
  process.env.SMOKE_ORGANISER_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD || ''
).trim();
const attendeeEmail = String(process.env.SMOKE_ATTENDEE_EMAIL || '').trim().toLowerCase();
const attendeePassword = String(process.env.SMOKE_ATTENDEE_PASSWORD || '').trim();
const siteAccessPassword = String(process.env.SITE_ACCESS_PASSWORD || '').trim();

let cookieJar = '';
let failed = 0;
let warned = 0;
const created = {
  memberId: null,
  organiserId: null,
  eventId: null,
  ticketId: null,
};

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

async function api(pathname, options) {
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
    warn('preview-gate', 'no SITE_ACCESS_PASSWORD — continuing without unlock');
    return;
  }
  const { status, data } = await api('/api/auth/site-access', {
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

async function login(email, password, label) {
  cookieJar = cookieJar
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('hub_session='))
    .join('; ');
  const { status, data } = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, rememberMe: false }),
  });
  if (status === 200 && data.ok && cookieJar.includes('hub_session=')) {
    ok(label, 'signed in as ' + email);
    return true;
  }
  fail(label, 'HTTP ' + status + ': ' + (data.message || data.error || 'login failed'));
  return false;
}

function testHelpers() {
  console.log('\nHelper checks');
  const {
    rosterRowIsActive,
    normalizeRosterEmail,
    sanitizeRosterName,
    isValidRosterEmail,
    parseRosterCsv,
    assertRosterCsvTextSafe,
    ROSTER_CSV_MAX_ROWS,
  } = require('../api/_lib/organiser-member-roster');
  const { isMembersOnlyTicket, normalizeTicketVisibility } = require('../api/_lib/ticket-visibility');

  try {
    if (normalizeRosterEmail('  USER@Example.COM ') !== 'user@example.com') {
      throw new Error('normalizeRosterEmail failed');
    }
    if (sanitizeRosterName('  Jane\u0000 Smith\t  ') !== 'Jane Smith') {
      throw new Error('sanitizeRosterName failed');
    }
    if (isValidRosterEmail('not-an-email') || !isValidRosterEmail('ok@example.com')) {
      throw new Error('isValidRosterEmail failed');
    }
    if (!rosterRowIsActive({ status: 'active', expires_at: null })) {
      throw new Error('active null expiry should pass');
    }
    if (rosterRowIsActive({ status: 'active', expires_at: '2020-01-01' })) {
      throw new Error('expired membership should fail');
    }
    if (rosterRowIsActive({ status: 'removed', expires_at: null })) {
      throw new Error('removed membership should fail');
    }
    if (!isMembersOnlyTicket({ visibility: 'members_only' })) {
      throw new Error('members_only detection failed');
    }
    if (normalizeTicketVisibility('hidden') !== 'public') {
      throw new Error('hidden visibility should normalize to public');
    }
    const rows = parseRosterCsv('email,name,expires\nsmoke@example.com,Smoke Tester,2026-12-31');
    if (!rows.length || rows[0].email !== 'smoke@example.com') {
      throw new Error('parseRosterCsv failed');
    }
    let rejectedBinary = false;
    try {
      assertRosterCsvTextSafe('email\n' + '\u0001'.repeat(80));
    } catch (e) {
      rejectedBinary = /plain CSV|binary|csv_binary/i.test(String(e.message || e.code || ''));
    }
    if (!rejectedBinary) throw new Error('assertRosterCsvTextSafe should reject binary-looking input');

    let rejectedTooMany = false;
    try {
      const huge =
        'email\n' +
        Array.from({ length: ROSTER_CSV_MAX_ROWS + 2 }, function (_, i) {
          return 'user' + i + '@example.com';
        }).join('\n');
      parseRosterCsv(huge);
    } catch (e) {
      rejectedTooMany = /too many rows|csv_too_many/i.test(String(e.message || e.code || ''));
    }
    if (!rejectedTooMany) throw new Error('parseRosterCsv should reject oversized row counts');

    ok('helpers', 'email normalize, sanitise, expiry, visibility, CSV parse + limits');
  } catch (e) {
    fail('helpers', e.message);
  }
}

async function resolveOrganiserGroup() {
  const { status, data } = await api('/api/organiser/groups');
  if (status !== 200) {
    fail('organiser-groups', 'HTTP ' + status + ': ' + (data.message || data.error || 'failed'));
    return null;
  }
  const groups = data.groups || data.items || [];
  if (!groups.length) {
    fail('organiser-groups', 'no organiser groups for this account');
    return null;
  }
  const group = groups[0];
  created.organiserId = group.id;
  ok('organiser-groups', 'using "' + (group.name || group.id) + '"');
  return group;
}

async function rosterUrl(extra) {
  return (
    '/api/organiser/roster?organiserId=' +
    encodeURIComponent(created.organiserId) +
    (extra || '')
  );
}

async function testRosterCrud() {
  console.log('\nOrganiser roster API');
  if (!created.organiserId) return;

  const smokeEmail = 'roster-smoke+' + Date.now() + '@example.com';
  const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const add = await api(await rosterUrl(), {
    method: 'POST',
    body: JSON.stringify({
      organiserId: created.organiserId,
      name: 'Roster Smoke Tester',
      email: smokeEmail,
      expiresAt: expires,
      sendInvite: false,
    }),
  });
  if (add.status === 200 && add.data.ok && add.data.member?.id) {
    created.memberId = add.data.member.id;
    ok('roster-add', smokeEmail + ' (invite skipped)');
  } else {
    fail('roster-add', 'HTTP ' + add.status + ': ' + (add.data.message || add.data.error || 'failed'));
    return;
  }

  const list = await api(await rosterUrl());
  if (list.status === 200 && Array.isArray(list.data.members)) {
    const found = list.data.members.some((m) => m.id === created.memberId);
    if (found) ok('roster-list', list.data.members.length + ' member(s), smoke row present');
    else fail('roster-list', 'smoke member missing from list');
  } else {
    fail('roster-list', 'HTTP ' + list.status + ': ' + (list.data.message || list.data.error || 'failed'));
  }

  const reports = await api(await rosterUrl('&action=reports'));
  if (reports.status === 200 && reports.data.reports?.rosterHealth) {
    const h = reports.data.reports.rosterHealth;
    ok(
      'roster-reports',
      h.totalActive + ' active · ' + h.claimed + ' signed up · ' + h.expiringSoon + ' expiring soon'
    );
  } else {
    fail(
      'roster-reports',
      'HTTP ' + reports.status + ': ' + (reports.data.message || reports.data.error || 'failed')
    );
  }

  const csv = await api(await rosterUrl(), {
    method: 'POST',
    body: JSON.stringify({
      organiserId: created.organiserId,
      csv: 'email,name,expires\n' + smokeEmail + ',Roster Smoke CSV,' + expires + '\n',
      sendInvites: false,
    }),
  });
  if (csv.status === 200 && csv.data.ok) {
    ok('roster-csv', 'imported ' + csv.data.ok + ' of ' + csv.data.total + ' (upsert)');
  } else {
    fail('roster-csv', 'HTTP ' + csv.status + ': ' + (csv.data.message || csv.data.error || 'failed'));
  }
}

async function findOrCreateMembersOnlyTicket() {
  const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
  if (!isSupabaseConfigured()) {
    warn('members-only-ticket', 'Supabase not configured — skipping ticket setup');
    return null;
  }
  const sb = getSupabaseAdmin();
  const existing = await sb
    .from('tickets')
    .select('id, event_id, name, visibility, price')
    .eq('visibility', 'members_only')
    .limit(1)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.id) {
    created.ticketId = existing.data.id;
    created.eventId = existing.data.event_id;
    ok('members-only-ticket', 'using existing ticket ' + existing.data.id);
    return existing.data;
  }

  if (!created.organiserId) return null;
  // Prefer an upcoming published event; fall back to any published event for this organiser.
  let ev = await sb
    .from('events')
    .select('id, title, status, approval_status, starts_at')
    .eq('organiser_id', created.organiserId)
    .eq('status', 'published')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (ev.error) throw new Error(ev.error.message);
  if (!ev.data?.id) {
    ev = await sb
      .from('events')
      .select('id, title, status, approval_status, starts_at')
      .eq('organiser_id', created.organiserId)
      .eq('status', 'published')
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ev.error) throw new Error(ev.error.message);
  }
  if (!ev.data?.id) {
    warn('members-only-ticket', 'no published event for this organiser — skipping checkout checks');
    return null;
  }

  const ins = await sb
    .from('tickets')
    .insert({
      event_id: ev.data.id,
      name: 'Roster smoke member ticket',
      price: 0,
      visibility: 'members_only',
      ticket_type: 'Standard',
      quantity: 10,
    })
    .select('id, event_id, name, visibility, price')
    .single();
  if (ins.error) {
    warn('members-only-ticket', 'could not create temp ticket: ' + ins.error.message);
    return null;
  }
  created.ticketId = ins.data.id;
  created.eventId = ins.data.event_id;
  created._createdTicket = true;
  ok('members-only-ticket', 'created temp free members_only ticket');
  return ins.data;
}

async function testPublicEventHidesMemberTiers() {
  console.log('\nPublic event payload');
  if (!created.eventId) {
    warn('public-event', 'no event id — skipped');
    return;
  }
  const { getSupabaseAdmin } = require('../api/_lib/supabase');
  const sb = getSupabaseAdmin();
  const ev = await sb.from('events').select('id, slug').eq('id', created.eventId).maybeSingle();
  const slug = String(ev.data?.slug || '').trim();
  const path = slug
    ? '/api/events?slug=' + encodeURIComponent(slug)
    : '/api/events?id=' + encodeURIComponent(created.eventId);
  const { status, data } = await api(path);
  if (status !== 200 || !data.event) {
    // Some deployments use /api/events/:id — try alternate
    const alt = await api('/api/events/' + encodeURIComponent(created.eventId));
    if (alt.status === 200 && alt.data.event) {
      return assertNoMemberTiers(alt.data.event);
    }
    warn('public-event', 'HTTP ' + status + ' — could not load event payload');
    return;
  }
  assertNoMemberTiers(data.event);
}

function assertNoMemberTiers(event) {
  const tiers = event.tickets || [];
  const leaked = tiers.filter(
    (t) => String(t.visibility || '').toLowerCase() === 'members_only' || t.isMembersOnly
  );
  if (leaked.length) {
    fail('public-event', leaked.length + ' members_only tier(s) leaked in public payload');
  } else {
    ok(
      'public-event',
      'no members_only tiers in public tickets' +
        (event.hasMembersOnlyTiers ? ' (flag hasMembersOnlyTiers=true)' : '')
    );
  }
}

async function testAnonymousCheckoutRejected() {
  console.log('\nCheckout authz');
  if (!created.eventId || !created.ticketId) {
    warn('checkout-anon', 'no members_only ticket — skipped');
    return;
  }
  // Drop hub session for anonymous probe; keep preview cookie if present.
  const saved = cookieJar;
  cookieJar = cookieJar
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('hub_session='))
    .join('; ');

  const { status, data } = await api('/api/auth/create-checkout', {
    method: 'POST',
    body: JSON.stringify({
      eventId: created.eventId,
      ticketId: created.ticketId,
      email: 'spoofed-member@example.com',
      name: 'Spoof Test',
      qty: 1,
    }),
  });
  cookieJar = saved;

  if (status === 401 && data.error === 'not_authenticated') {
    ok('checkout-anon', 'anonymous members_only booking rejected');
  } else if (status === 403 && /members_only|not_eligible|mismatch/i.test(String(data.error || ''))) {
    ok('checkout-anon', 'rejected with ' + data.error);
  } else {
    fail(
      'checkout-anon',
      'expected 401 not_authenticated, got HTTP ' + status + ' ' + (data.error || data.message || '')
    );
  }
}

async function testAttendeeEligibility() {
  console.log('\nAttendee eligibility');
  if (!created.eventId) {
    warn('roster-eligibility', 'no event id — skipped');
    return;
  }
  if (!attendeeEmail || !attendeePassword) {
    warn(
      'roster-eligibility',
      'set SMOKE_ATTENDEE_EMAIL + SMOKE_ATTENDEE_PASSWORD to test signed-in eligibility'
    );
    return;
  }
  if (!(await login(attendeeEmail, attendeePassword, 'attendee-login'))) return;

  const { status, data } = await api(
    '/api/auth/roster-eligibility?eventId=' + encodeURIComponent(created.eventId)
  );
  if (status !== 200 || !data.ok) {
    fail(
      'roster-eligibility',
      'HTTP ' + status + ': ' + (data.message || data.error || 'failed')
    );
    return;
  }
  ok(
    'roster-eligibility',
    'isMember=' +
      Boolean(data.isMember) +
      ', memberTickets=' +
      (Array.isArray(data.memberTickets) ? data.memberTickets.length : 0)
  );

  const dash = await api('/api/auth/attendee-dashboard');
  if (dash.status === 200 && dash.data.ok && Array.isArray(dash.data.myGroups)) {
    ok('my-groups', dash.data.myGroups.length + ' group(s) in dashboard payload');
  } else if (dash.status === 200 && dash.data.ok) {
    fail('my-groups', 'myGroups missing from attendee-dashboard response');
  } else {
    fail('my-groups', 'HTTP ' + dash.status + ': ' + (dash.data.message || dash.data.error || 'failed'));
  }
}

async function cleanup() {
  console.log('\nCleanup');
  if (organiserEmail && organiserPassword) {
    await login(organiserEmail, organiserPassword, 're-login-cleanup');
  }
  if (created.organiserId) {
    const list = await api(await rosterUrl());
    const smokeRows = (list.data.members || []).filter((m) =>
      /^roster-smoke\+/i.test(String(m.email || ''))
    );
    for (const row of smokeRows) {
      const del = await api(
        '/api/organiser/roster?organiserId=' +
          encodeURIComponent(created.organiserId) +
          '&id=' +
          encodeURIComponent(row.id),
        { method: 'DELETE' }
      );
      if (del.status === 200 && del.data.ok) ok('cleanup-roster', 'removed ' + row.email);
      else warn('cleanup-roster', 'HTTP ' + del.status + ': ' + (del.data.message || del.data.error || ''));
    }
    if (!smokeRows.length && created.memberId) {
      warn('cleanup-roster', 'no smoke rows left to remove');
    }
  }
  if (created._createdTicket && created.ticketId) {
    try {
      const { getSupabaseAdmin } = require('../api/_lib/supabase');
      const sb = getSupabaseAdmin();
      const del = await sb.from('tickets').delete().eq('id', created.ticketId);
      if (del.error) warn('cleanup-ticket', del.error.message);
      else ok('cleanup-ticket', 'removed temp members_only ticket');
    } catch (e) {
      warn('cleanup-ticket', e.message);
    }
  }
}

async function main() {
  console.log('Member list smoke → ' + base);
  if (!organiserEmail || !organiserPassword) {
    console.error(
      '\nMissing organiser credentials. Set SMOKE_ORGANISER_EMAIL + SMOKE_ORGANISER_PASSWORD\n' +
        '(or ADMIN_EMAIL + ADMIN_INITIAL_PASSWORD) in local.env.\n'
    );
    process.exit(1);
  }

  testHelpers();

  console.log('\nAuth');
  await unlockPreviewIfNeeded();
  if (!(await login(organiserEmail, organiserPassword, 'organiser-login'))) {
    process.exit(1);
  }

  const group = await resolveOrganiserGroup();
  if (!group) process.exit(1);

  await testRosterCrud();

  try {
    await findOrCreateMembersOnlyTicket();
  } catch (e) {
    warn('members-only-ticket', e.message);
  }

  await testPublicEventHidesMemberTiers();
  await testAnonymousCheckoutRejected();
  await testAttendeeEligibility();
  await cleanup();

  console.log('');
  if (failed) {
    console.log('Smoke failed: ' + failed + ' failure(s)' + (warned ? ', ' + warned + ' warning(s)' : ''));
    process.exit(1);
  }
  console.log('Smoke passed' + (warned ? ' with ' + warned + ' warning(s)' : '') + '.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
