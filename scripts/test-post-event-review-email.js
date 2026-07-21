#!/usr/bin/env node
/**
 * Test post-event review email template + cron eligibility.
 *
 * Usage:
 *   node scripts/test-post-event-review-email.js
 *   node scripts/test-post-event-review-email.js --dry-run
 *   node scripts/test-post-event-review-email.js --send you@example.com
 *
 * Requires local.env with Supabase + Resend for --send / --dry-run against live data.
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { buildEmailFromTemplate } = require('../api/_lib/send-template-email');
const { mergeEmailPreviewVariables } = require('../api/_lib/email-preview-variables');
const { sendDuePostEventReviewEmails } = require('../api/_lib/engagement-emails');
const { reviewUrlForEvent } = require('../api/_lib/lifecycle-emails');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { sendTemplatedEmail } = require('../api/_lib/send-template-email');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const sendIdx = args.indexOf('--send');
const sendTo =
  sendIdx >= 0 ? String(args[sendIdx + 1] || '').trim().toLowerCase() : '';

function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

function pass(msg) {
  console.log('OK:', msg);
}

async function testTemplateBuild() {
  const site = (process.env.SITE_URL || 'https://the-networker-hub.vercel.app').replace(/\/$/, '');
  const vars = mergeEmailPreviewVariables('post_event_review_request', {}, site);
  const built = await buildEmailFromTemplate('post_event_review_request', vars);

  if (!built.html || built.html.length < 500) fail('template HTML too short');
  if (!built.html.includes('Leave a review')) fail('missing CTA copy');
  if (!built.html.includes(vars.review_url)) fail('review_url not substituted in HTML');
  if (!vars.review_url.includes('#review/')) {
    fail('review_url should deep-link with #review/eventId hash');
  }
  if (!vars.review_url.includes('?review=')) fail('review_url should include ?review=eventId');

  pass('template builds with review deep link → ' + vars.review_url);
  return built;
}

async function testReviewUrlHelper() {
  const eventId = '00000000-0000-4000-8000-000000000099';
  const url = reviewUrlForEvent({ id: eventId }, 'https://example.com');
  if (!url.includes('?review=' + encodeURIComponent(eventId))) {
    fail('reviewUrlForEvent missing event id param');
  }
  if (!url.includes('#review/')) {
    fail('reviewUrlForEvent missing #review/eventId hash');
  }
  pass('reviewUrlForEvent → ' + url);
}

async function testCronEligibility() {
  if (!isSupabaseConfigured()) {
    console.log('SKIP: Supabase not configured — cron eligibility not tested');
    return;
  }

  const sb = getSupabaseAdmin();
  const result = await sendDuePostEventReviewEmails(sb, { dryRun: true });

  console.log('');
  console.log(
    'Cron eligibility: events ended 24h–14 days ago with unsent review request'
  );
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
      console.log('     ' + row.review_url);
    });
    if (result.candidates.length > 5) {
      console.log('  … and ' + (result.candidates.length - 5) + ' more');
    }
  } else {
    console.log(
      '  No eligible registrations. Need a past event (ended 24h+ ago) with a paid/free registration and post_event_review_sent_at null.'
    );
  }
  pass('dry-run cron completed');
}

async function testLiveSend() {
  if (!sendTo) return;
  const site = (process.env.SITE_URL || 'https://the-networker-hub.vercel.app').replace(/\/$/, '');
  const vars = mergeEmailPreviewVariables('post_event_review_request', {}, site);
  const result = await sendTemplatedEmail({
    slug: 'post_event_review_request',
    to: sendTo,
    variables: vars,
    skipEmailCheck: true,
  });
  pass('test email sent to ' + sendTo + ' (Resend id: ' + (result.id || 'n/a') + ')');
  console.log('  Open the review link from the email while signed in as that attendee.');
}

async function main() {
  console.log('Post-event review email test\n');
  await testTemplateBuild();
  await testReviewUrlHelper();
  if (dryRun || isSupabaseConfigured()) {
    await testCronEligibility();
  }
  await testLiveSend();
  console.log('\nAll checks passed.');
}

main().catch(function (e) {
  fail(e.message || String(e));
});
