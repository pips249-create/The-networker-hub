#!/usr/bin/env node
/**
 * Claimed page with no event: timing and template.
 * Usage: node scripts/test-organiser-claimed-no-event.js
 */
const emailTplModule = require('../api/_lib/supabase-email-templates');

emailTplModule.getEmailTemplateBySlug = async function mockGetEmailTemplateBySlug() {
  return null;
};

const { buildEmailFromTemplate } = require('../api/_lib/send-template-email');
const { mergeEmailPreviewVariables } = require('../api/_lib/email-preview-variables');
const {
  CLAIMED_NO_EVENT_SLUG,
  claimedNoEventSkipReason,
} = require('../api/_lib/organiser-claimed-no-event');

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-10-16T12:00:00.000Z');

function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

function pass(msg) {
  console.log('OK:', msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function at(daysAgo) {
  return new Date(now - daysAgo * DAY).toISOString();
}

assert(claimedNoEventSkipReason({ claimedAt: at(2), claimStatus: 'claimed', now }) === 'too_soon', 'day 2 waits');
assert(claimedNoEventSkipReason({ claimedAt: at(3), claimStatus: 'claimed', now }) === '', 'day 3 is due');
assert(claimedNoEventSkipReason({ claimedAt: at(10), claimStatus: 'claimed', now }) === '', 'a missed day still qualifies');
assert(claimedNoEventSkipReason({ claimedAt: at(21), claimStatus: 'claimed', now }) === 'too_old', 'window closes at 21 days');
assert(
  claimedNoEventSkipReason({ claimedAt: at(4), claimStatus: 'claimed', alreadySent: true, now }) === 'already_sent',
  'one note only'
);
assert(
  claimedNoEventSkipReason({ claimedAt: at(4), claimStatus: 'pending', now }) === 'not_claimed',
  'unclaimed pages are skipped'
);
assert(
  claimedNoEventSkipReason({ claimedAt: at(4), claimStatus: 'claimed', hasEvents: true, now }) === 'has_events',
  'a page with an event is skipped'
);
assert(claimedNoEventSkipReason({ claimStatus: 'claimed', now }) === 'missing_claim', 'a claim needs a date');
pass('timing');

async function main() {
  const preview = mergeEmailPreviewVariables(CLAIMED_NO_EVENT_SLUG, {}, 'https://www.thenetworkeruk.com');
  const built = await buildEmailFromTemplate(CLAIMED_NO_EVENT_SLUG, preview);
  const html = built.html;
  assert(built.subject.indexOf('Add a meeting for City Connectors') !== -1, 'subject names the group: ' + built.subject);
  assert(html.indexOf('They still need a date') !== -1, 'headline asks for a date');
  assert(html.indexOf('Thanks for claiming') !== -1, 'thanks them for claiming');
  assert(html.indexOf('List a meeting') !== -1, 'one list-a-meeting button');
  assert(html.indexOf('/organiser/event-format') !== -1, 'button opens the event form');
  assert(html.indexOf('Send us the details') !== -1, 'offers to list the dates for them');
  assert(html.indexOf('/add-your-event') !== -1, 'links to the event form');
  assert(html.indexOf('Claim your free page') === -1, 'does not ask them to claim again');
  assert(html.indexOf('unclaimed') === -1, 'does not call the page unclaimed');
  assert(html.indexOf('{{') === -1, 'no unresolved placeholders');
  assert(html.indexOf('https://www.thenetworkeruk.com/unsubscribe') !== -1, 'has an unsubscribe link');
  assert(!/[\u2013\u2014]|&ndash;|&mdash;/.test(html), 'uses hyphens, not en dashes');
  pass('template builds — ' + built.subject);
}

main().catch(function (err) {
  fail(err && err.stack ? err.stack : err);
});
