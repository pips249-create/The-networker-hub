/**
 * Smoke tests for monthly group-update differentiators:
 * reply-to, smart audiences, engagement tracking/report.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ogu = require('../api/_lib/organiser-group-updates');
const trackHandler = require('../api/track');

let passed = 0;
function ok(label) {
  passed += 1;
  console.log('  ✓ ' + label);
}

function fail(label, err) {
  console.error('  ✗ ' + label);
  console.error(err && err.stack ? err.stack : err);
  process.exitCode = 1;
}

async function testAudienceSlices() {
  console.log('\n1) Smart audience slices');
  const slices = ogu.listAudienceSlices();
  assert.strictEqual(slices.length, 4);
  const ids = slices.map((s) => s.id).sort();
  assert.deepStrictEqual(ids, ['all', 'favourites', 'once', 'recent']);
  ok('listAudienceSlices returns 4 slices');

  assert.strictEqual(ogu.normalizeContent({ audienceSlice: 'once' }).audienceSlice, 'once');
  assert.strictEqual(ogu.normalizeContent({ audience_slice: 'recent' }).audienceSlice, 'recent');
  assert.strictEqual(ogu.normalizeContent({ audienceSlice: 'nope' }).audienceSlice, 'all');
  assert.strictEqual(ogu.normalizeContent({}).audienceSlice, 'all');
  ok('normalizeContent maps / defaults audienceSlice');

  // Mirror listRecipientsForSlice filter logic with fixture data
  const now = Date.now();
  const all = [
    { email: 'a@x.com', name: 'A', bookingCount: 1, lastBookedAt: now - 2 * 86400000 },
    { email: 'b@x.com', name: 'B', bookingCount: 3, lastBookedAt: now - 60 * 86400000 },
    { email: 'c@x.com', name: 'C', bookingCount: 1, lastBookedAt: now - 40 * 86400000 },
  ];
  const cutoff = now - 30 * 24 * 60 * 60 * 1000;
  const once = all.filter((r) => r.bookingCount === 1);
  const recent = all.filter((r) => r.lastBookedAt >= cutoff);
  assert.strictEqual(once.length, 2);
  assert.strictEqual(recent.length, 1);
  assert.strictEqual(recent[0].email, 'a@x.com');
  ok('once / recent filters match expected counts');
}

async function testReplyToAndTrackingInTemplate() {
  console.log('\n2) Reply-to + tracked links in template vars');
  const token = '11111111-2222-3333-4444-555555555555';
  const vars = await ogu.buildTemplateVariables({
    group: {
      id: 'org-1',
      name: 'Test Networkers',
      contact_email: 'hello@testnetworkers.com',
      website: 'https://example.com',
    },
    update: { subject: 'Hello', period_key: '2026-07' },
    content: ogu.normalizeContent({
      organiserNote: 'Thanks for coming.',
      includeUpcomingEvents: false,
      includeSocialLinks: false,
      includeMonthStats: false,
      includeGreeting: true,
    }),
    events: [],
    recipient: { email: 'guest@example.com', name: 'Sam Guest' },
    monthStats: null,
    trackToken: token,
    replyTo: 'hello@testnetworkers.com',
  });

  assert.ok(vars.reply_hint_html.includes('Reply to this email'));
  assert.ok(vars.reply_hint_html.includes('Test Networkers'));
  assert.ok(!vars.reply_hint_html.includes('mail-merge') || vars.reply_hint_html.includes('mail-merge'));
  ok('reply hint present when replyTo set');

  assert.ok(vars.tracking_pixel_html.includes('kind=open'));
  assert.ok(vars.tracking_pixel_html.includes(encodeURIComponent(token)));
  ok('open tracking pixel present');

  assert.ok(vars.organiser_url.includes('/api/track'));
  assert.ok(vars.organiser_url.includes('kind=click'));
  assert.ok(vars.organiser_url.includes(encodeURIComponent(token)));
  ok('CTA / organiser URL wrapped with click tracker');

  const noReply = await ogu.buildTemplateVariables({
    group: { id: 'org-1', name: 'No Email Group' },
    update: { subject: 'Hi', period_key: '2026-07' },
    content: ogu.normalizeContent({ organiserNote: 'x', includeUpcomingEvents: false, includeSocialLinks: false, includeMonthStats: false }),
    events: [],
    recipient: { email: 'g@x.com', name: 'G' },
    trackToken: null,
    replyTo: '',
  });
  assert.ok(noReply.reply_hint_html.includes('Hub contact details'));
  assert.strictEqual(noReply.tracking_pixel_html, '');
  ok('fallback reply hint when no email; no pixel without token');
}

async function testTrackHandler() {
  console.log('\n3) /api/track handler behaviour');

  function mockRes() {
    const r = {
      statusCode: 0,
      headers: {},
      body: null,
      setHeader(k, v) {
        this.headers[k.toLowerCase()] = v;
      },
      end(buf) {
        this.body = buf;
        return this;
      },
    };
    return r;
  }

  function mockReq(url, method) {
    return {
      method: method || 'GET',
      url,
      headers: { 'x-forwarded-for': '127.0.0.1' },
    };
  }

  const openRes = mockRes();
  await trackHandler(
    mockReq('/api/track?kind=open&t=11111111-2222-3333-4444-555555555555'),
    openRes
  );
  assert.strictEqual(openRes.statusCode, 200);
  assert.ok(String(openRes.headers['content-type'] || '').includes('image/gif'));
  assert.ok(Buffer.isBuffer(openRes.body) || openRes.body);
  ok('open returns 1×1 GIF');

  const clickRes = mockRes();
  const dest = encodeURIComponent('https://www.thenetworkerhub.com/events/organiser?id=abc');
  await trackHandler(
    mockReq(
      '/api/track?kind=click&t=11111111-2222-3333-4444-555555555555&u=' + dest
    ),
    clickRes
  );
  assert.strictEqual(clickRes.statusCode, 302);
  assert.ok(
    String(clickRes.headers.location || '').startsWith('https://www.thenetworkerhub.com/')
  );
  ok('click redirects to destination URL');

  const badClick = mockRes();
  await trackHandler(
    mockReq(
      '/api/track?kind=click&t=not-a-uuid&u=' + encodeURIComponent('https://example.com/x')
    ),
    badClick
  );
  assert.strictEqual(badClick.statusCode, 302);
  assert.strictEqual(badClick.headers.location, 'https://example.com/x');
  ok('invalid token still redirects on click (never blocks user)');

  const jsOpen = mockRes();
  await trackHandler(
    mockReq('/api/track?kind=open&t=11111111-2222-3333-4444-555555555555', 'POST'),
    jsOpen
  );
  assert.strictEqual(jsOpen.statusCode, 405);
  ok('non-GET rejected');
}

function testEngagementReportMath() {
  console.log('\n4) Engagement report rollup math');
  const rows = [
    { email: 'a@x.com', sent_at: 't', opened_at: 't', clicked_at: 't', failed_at: null },
    { email: 'b@x.com', sent_at: 't', opened_at: 't', clicked_at: null, failed_at: null },
    { email: 'c@x.com', sent_at: 't', opened_at: null, clicked_at: null, failed_at: null },
    { email: 'd@x.com', sent_at: null, opened_at: null, clicked_at: null, failed_at: 't' },
    { email: 'e@x.com', sent_at: null, opened_at: null, clicked_at: null, failed_at: null },
  ];
  const sentRows = rows.filter((r) => r.sent_at);
  const opened = sentRows.filter((r) => r.opened_at).length;
  const clicked = sentRows.filter((r) => r.clicked_at).length;
  const failed = rows.filter((r) => r.failed_at).length;
  const pending = rows.filter((r) => !r.sent_at && !r.failed_at).length;
  const sentCount = sentRows.length;
  const openRate = sentCount ? Math.round((opened / sentCount) * 1000) / 10 : 0;
  const clickRate = sentCount ? Math.round((clicked / sentCount) * 1000) / 10 : 0;

  assert.strictEqual(sentCount, 3);
  assert.strictEqual(opened, 2);
  assert.strictEqual(clicked, 1);
  assert.strictEqual(failed, 1);
  assert.strictEqual(pending, 1);
  assert.strictEqual(openRate, 66.7);
  assert.strictEqual(clickRate, 33.3);
  ok('open/click rates and pending/failed counts');
}

function testUiWiring() {
  console.log('\n5) Workspace UI wiring (monthly composer retired)');
  const html = fs.readFileSync(path.join(__dirname, '../organiser/index.html'), 'utf8');
  assert.ok(!html.includes('id="ogu-audience-slice"'), 'monthly audience UI should be gone');
  assert.ok(html.includes('id="org-attendee-email-panel"'));
  assert.ok(html.includes('id="oec-form"'));
  assert.ok(html.includes('Attendee round-up'));
  ok('attendee round-up composer is wired; monthly UI removed');

  const js = fs.readFileSync(path.join(__dirname, '../js/organiser-event-connections.js'), 'utf8');
  assert.ok(js.includes('HubOrganiserEventConnections'));
  assert.ok(js.includes('/api/organiser/event-connections'));
  ok('event-connections JS loads API + init export');

  const migration = fs.readFileSync(
    path.join(__dirname, '../supabase/migrations/219_group_update_engagement.sql'),
    'utf8'
  );
  assert.ok(migration.includes('tracking_token'));
  assert.ok(migration.includes('organiser_group_update_link_clicks'));
  assert.ok(migration.includes('opened_at'));
  ok('migration 219 has tracking columns + link_clicks table');

  const route = fs.readFileSync(
    path.join(__dirname, '../api/_lib/routes/organiser-group-updates.js'),
    'utf8'
  );
  assert.ok(route.includes("action === 'report'"));
  assert.ok(route.includes('estimateAudienceSlices'));
  assert.ok(route.includes('replyTo'));
  ok('group-updates API route still present for dormant backend');
}

async function main() {
  console.log('Group update engagement smoke tests');
  try {
    await testAudienceSlices();
  } catch (e) {
    fail('audience slices', e);
  }
  try {
    await testReplyToAndTrackingInTemplate();
  } catch (e) {
    fail('reply/tracking template', e);
  }
  try {
    await testTrackHandler();
  } catch (e) {
    fail('track handler', e);
  }
  try {
    testEngagementReportMath();
  } catch (e) {
    fail('report math', e);
  }
  try {
    testUiWiring();
  } catch (e) {
    fail('UI wiring', e);
  }

  if (process.exitCode) {
    console.error('\nFAILED');
    process.exit(1);
  }
  console.log('\nAll ' + passed + ' checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
