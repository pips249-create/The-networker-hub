#!/usr/bin/env node
/**
 * Day-3 directory nudge: timing and template.
 * Usage: node scripts/test-organiser-directory-nudge.js
 */
const emailTplModule = require('../api/_lib/supabase-email-templates');

emailTplModule.getEmailTemplateBySlug = async function mockGetEmailTemplateBySlug() {
  return null;
};

const { buildEmailFromTemplate } = require('../api/_lib/send-template-email');
const { mergeEmailPreviewVariables } = require('../api/_lib/email-preview-variables');
const {
  DIRECTORY_NUDGE_SLUG,
  DIRECTORY_DAY7_SLUG,
  DIRECTORY_DAY21_SLUG,
  DIRECTORY_DAY35_SLUG,
  directoryNudgeSkipReason,
  directoryDay7SkipReason,
  directoryDay21SkipReason,
  directoryDay35SkipReason,
  hostsLine,
  latestActivityByOrganiser,
} = require('../api/_lib/organiser-directory-nudge');
const { DIRECTORY_INVITE_SLUG } = require('../api/_lib/organiser-directory-invite');

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-10-15T12:00:00.000Z');

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

assert(directoryNudgeSkipReason({ inviteAt: at(2), now }) === 'too_soon', 'day 2 waits');
assert(directoryNudgeSkipReason({ inviteAt: at(3), now }) === '', 'day 3 is due');
assert(directoryNudgeSkipReason({ inviteAt: at(6), now }) === '', 'day 6 still gets the preview note');
assert(directoryNudgeSkipReason({ inviteAt: at(7), now }) === 'too_old', 'day 7 belongs to the next email');
assert(directoryDay7SkipReason({ inviteAt: at(6), now }) === 'too_soon', 'day 6 waits for the value note');
assert(directoryDay7SkipReason({ inviteAt: at(7), now }) === '', 'day 7 is due');
assert(directoryDay7SkipReason({ inviteAt: at(10), now }) === '', 'a missed day 7 still qualifies');
assert(directoryDay7SkipReason({ inviteAt: at(15), now }) === 'too_old', 'older than two weeks is left');
assert(directoryDay21SkipReason({ inviteAt: at(20), now }) === 'too_soon', 'day 20 waits');
assert(directoryDay21SkipReason({ inviteAt: at(21), now }) === '', 'day 21 is due');
assert(directoryDay21SkipReason({ inviteAt: at(28), now }) === '', 'a missed day 21 still qualifies');
assert(directoryDay21SkipReason({ inviteAt: at(35), now }) === 'too_old', 'day 21 window closes');
assert(directoryDay35SkipReason({ inviteAt: at(34), now }) === 'too_soon', 'day 34 waits for the close');
assert(directoryDay35SkipReason({ inviteAt: at(35), now }) === '', 'day 35 is due');
assert(directoryDay35SkipReason({ inviteAt: at(42), now }) === '', 'a missed day 35 still qualifies');
assert(directoryDay35SkipReason({ inviteAt: at(49), now }) === 'too_old', 'day 35 window closes');
assert(
  directoryDay35SkipReason({ inviteAt: at(36), alreadySent: true, now }) === 'already_sent',
  'one day-35 note only'
);
assert(
  directoryDay35SkipReason({ inviteAt: at(36), claimStatus: 'claimed', now }) === 'already_claimed',
  'claimed pages skip day 35'
);
assert(
  directoryDay21SkipReason({ inviteAt: at(22), alreadySent: true, now }) === 'already_sent',
  'one day-21 note only'
);
assert(hostsLine(['Top Clubs', 'Harbour & City Hosts']).indexOf('Top Clubs and Harbour & City Hosts') !== -1, 'names two hosts');
assert(hostsLine([]).indexOf('including groups like') === -1, 'falls back when no hosts are named');
assert(
  directoryDay7SkipReason({ inviteAt: at(8), alreadySent: true, now }) === 'already_sent',
  'one day-7 note only'
);
assert(
  directoryDay7SkipReason({ inviteAt: at(8), claimStatus: 'claimed', now }) === 'already_claimed',
  'claimed pages skip day 7'
);
assert(
  directoryNudgeSkipReason({ inviteAt: at(4), alreadyNudged: true, now }) === 'already_nudged',
  'one nudge only'
);
assert(
  directoryNudgeSkipReason({ inviteAt: at(4), claimStatus: 'claimed', now }) === 'already_claimed',
  'claimed pages are skipped'
);
pass('timing');

const rows = [
  { organiser_id: 'a', created_at: at(1), metadata: { slug: DIRECTORY_INVITE_SLUG } },
  { organiser_id: 'a', created_at: at(6), metadata: { slug: DIRECTORY_INVITE_SLUG } },
  { organiser_id: 'b', created_at: at(4), metadata: { slug: DIRECTORY_NUDGE_SLUG } },
];
const latest = latestActivityByOrganiser(rows, DIRECTORY_INVITE_SLUG);
assert(latest.size === 1 && latest.get('a').created_at === at(1), 'keeps the newest invite');
pass('latest invite');

async function main() {
  const preview = mergeEmailPreviewVariables(DIRECTORY_NUDGE_SLUG, {}, 'https://www.thenetworkeruk.com');
  const built = await buildEmailFromTemplate(DIRECTORY_NUDGE_SLUG, preview);
  const html = built.html;
  assert(built.subject.indexOf('City Connectors') !== -1, 'subject names the group: ' + built.subject);
  assert(built.subject.indexOf('still here') !== -1, 'subject is a check-in: ' + built.subject);
  assert(html.indexOf('Your page is still here') !== -1, 'headline is the check-in');
  assert(html.indexOf('three days ago') !== -1, 'says when the page was built');
  assert(html.indexOf('draft page ready') !== -1, 'frames the page as ready to preview');
  assert(html.indexOf('under a minute') !== -1, 'says the look takes under a minute');
  assert(html.indexOf('unclaimed') === -1, 'does not call the page unclaimed');
  assert(html.indexOf('See your page') !== -1, 'one page button');
  assert(html.indexOf('Browse the events directory') === -1, 'no second button');
  assert(html.indexOf('background:#d4a853') !== -1, 'gold page button');
  assert(html.indexOf('/organisers/city-connectors') !== -1, 'page link substituted');
  assert(html.indexOf('{{') === -1, 'no unresolved placeholders');
  assert(html.indexOf('https://www.thenetworkeruk.com/unsubscribe') !== -1, 'day 3 has an unsubscribe link');
  assert(!/[\u2013\u2014]|&ndash;|&mdash;/.test(html), 'day 3 uses hyphens, not en dashes');
  pass('template builds — ' + built.subject);

  const day7 = await buildEmailFromTemplate(
    DIRECTORY_DAY7_SLUG,
    mergeEmailPreviewVariables(DIRECTORY_DAY7_SLUG, {}, 'https://www.thenetworkeruk.com')
  );
  const day7Html = day7.html;
  assert(day7.subject.indexOf('Re: We love what you\'re doing at City Connectors') !== -1, 'day 7 replies to the invite: ' + day7.subject);
  assert(day7Html.indexOf('Your next guests are already looking') !== -1, 'day 7 headline');
  assert(day7Html.indexOf('17,000') !== -1, 'day 7 uses the directory audience');
  assert(day7Html.indexOf('first-time guests') !== -1, 'day 7 mentions first-time guests');
  assert(day7Html.indexOf('no hidden fees') !== -1, 'day 7 says listing is free');
  assert(day7Html.indexOf('Claim your free page') !== -1, 'day 7 has one claim button');
  assert(day7Html.indexOf('unclaimed') === -1, 'day 7 does not call the page unclaimed');
  assert(day7Html.indexOf('{{') === -1, 'day 7 has no unresolved placeholders');
  assert(day7Html.indexOf('https://www.thenetworkeruk.com/unsubscribe') !== -1, 'day 7 has an unsubscribe link');
  assert(!/[\u2013\u2014]|&ndash;|&mdash;/.test(day7Html), 'day 7 uses hyphens, not en dashes');
  pass('day 7 template builds — ' + day7.subject);

  const day21 = await buildEmailFromTemplate(
    DIRECTORY_DAY21_SLUG,
    mergeEmailPreviewVariables(DIRECTORY_DAY21_SLUG, {}, 'https://www.thenetworkeruk.com')
  );
  const day21Html = day21.html;
  assert(day21.subject.indexOf('A quick update for City Connectors') !== -1, 'day 21 subject: ' + day21.subject);
  assert(day21Html.indexOf('Hope you\'re having a great week') !== -1, 'day 21 opens with the week');
  assert(day21Html.indexOf('Top Clubs and Harbour &amp; City Hosts') !== -1, 'day 21 names two hosts');
  assert(day21Html.indexOf('Zero extra cost') !== -1, 'day 21 mentions keeping ticket sales');
  assert(day21Html.indexOf('draft page for') !== -1, 'day 21 says the draft is saved');
  assert(day21Html.indexOf('See your page') !== -1, 'day 21 has one page button');
  assert(day21Html.indexOf('unclaimed') === -1, 'day 21 does not call the page unclaimed');
  assert(day21Html.indexOf('{{') === -1, 'day 21 has no unresolved placeholders');
  assert(day21Html.indexOf('https://www.thenetworkeruk.com/unsubscribe') !== -1, 'day 21 has an unsubscribe link');
  assert(!/[\u2013\u2014]|&ndash;|&mdash;/.test(day21Html), 'day 21 uses hyphens, not en dashes');
  pass('day 21 template builds — ' + day21.subject);

  const day35 = await buildEmailFromTemplate(
    DIRECTORY_DAY35_SLUG,
    mergeEmailPreviewVariables(DIRECTORY_DAY35_SLUG, {}, 'https://www.thenetworkeruk.com')
  );
  const day35Html = day35.html;
  assert(day35.subject.indexOf('Should we keep this page open for City Connectors?') !== -1, 'day 35 subject: ' + day35.subject);
  assert(day35Html.indexOf('stop clogging up your inbox') !== -1, 'day 35 is the last note');
  assert(day35Html.indexOf('co-organisers') !== -1, 'day 35 uses British spelling');
  assert(day35Html.indexOf('Take a look at your page') !== -1, 'day 35 has one page button');
  assert(day35Html.indexOf('unclaimed') === -1, 'day 35 does not call the page unclaimed');
  assert(day35Html.indexOf('{{') === -1, 'day 35 has no unresolved placeholders');
  assert(day35Html.indexOf('https://www.thenetworkeruk.com/unsubscribe') !== -1, 'day 35 has an unsubscribe link');
  assert(!/[\u2013\u2014]|&ndash;|&mdash;/.test(day35Html), 'day 35 uses hyphens, not en dashes');
  pass('day 35 template builds — ' + day35.subject);
}

main().catch(function (err) {
  fail(err && err.stack ? err.stack : err);
});
