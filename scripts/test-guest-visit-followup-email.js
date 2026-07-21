#!/usr/bin/env node
/**
 * Test guest visit follow-up email template + cron eligibility.
 *
 * Usage:
 *   node scripts/test-guest-visit-followup-email.js
 *   node scripts/test-guest-visit-followup-email.js --dry-run
 *   node scripts/test-guest-visit-followup-email.js --send you@example.com
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { buildEmailFromTemplate, sendTemplatedEmail } = require('../api/_lib/send-template-email');
const { mergeEmailPreviewVariables } = require('../api/_lib/email-preview-variables');
const { sendDueGuestVisitFollowupEmails } = require('../api/_lib/engagement-emails');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const sendIdx = args.indexOf('--send');
const sendTo = sendIdx >= 0 ? String(args[sendIdx + 1] || '').trim().toLowerCase() : '';

function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

function pass(msg) {
  console.log('OK:', msg);
}

async function testTemplateBuild() {
  const site = (process.env.SITE_URL || 'https://the-networker-hub.vercel.app').replace(/\/$/, '');
  const vars = mergeEmailPreviewVariables('guest_visit_followup', {}, site);
  const built = await buildEmailFromTemplate('guest_visit_followup', vars);

  if (!built.html || built.html.length < 500) fail('template HTML too short');
  if (!built.html.includes('Hope to see you again')) fail('missing hero copy');
  if (!built.html.includes('Next meeting')) fail('missing next event section');
  if (!built.html.includes(vars.cta_url)) fail('cta_url not substituted in HTML');

  pass('template builds with next-event CTA → ' + vars.cta_url);
}

async function testCronEligibility() {
  if (!isSupabaseConfigured()) {
    console.log('SKIP: Supabase not configured — cron eligibility not tested');
    return;
  }

  const sb = getSupabaseAdmin();
  const result = await sendDueGuestVisitFollowupEmails(sb, { dryRun: true });

  console.log('');
  console.log('Cron eligibility: guest visits for events ended 24h–14 days ago, unsent follow-up');
  console.log('Candidates:', result.candidates.length, '| Skipped:', result.skipped);
  if (result.candidates.length) {
    result.candidates.slice(0, 5).forEach(function (row, i) {
      console.log(
        '  ' +
          (i + 1) +
          '. ' +
          row.attendee_email +
          ' — "' +
          row.event_title +
          '"'
      );
      console.log('     ' + row.next_event_url);
    });
    if (result.candidates.length > 5) {
      console.log('  … and ' + (result.candidates.length - 5) + ' more');
    }
  } else {
    console.log(
      '  No eligible guest visit registrations. Need a past event (ended 24h+ ago) with a guest_visit registration and guest_visit_followup_sent_at null.'
    );
  }
  pass('dry-run cron completed');
}

async function testLiveSend() {
  if (!sendTo) return;
  const site = (process.env.SITE_URL || 'https://the-networker-hub.vercel.app').replace(/\/$/, '');
  const vars = mergeEmailPreviewVariables('guest_visit_followup', {}, site);
  const result = await sendTemplatedEmail({
    slug: 'guest_visit_followup',
    to: sendTo,
    variables: vars,
    skipEmailCheck: true,
  });
  pass('test email sent to ' + sendTo + ' (Resend id: ' + (result.id || 'n/a') + ')');
}

async function main() {
  console.log('Guest visit follow-up email test\n');
  await testTemplateBuild();
  if (dryRun || isSupabaseConfigured()) {
    await testCronEligibility();
  }
  await testLiveSend();
  console.log('\nAll checks passed.');
}

main().catch(function (e) {
  fail(e.message || String(e));
});
