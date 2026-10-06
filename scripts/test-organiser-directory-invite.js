#!/usr/bin/env node
/**
 * New-group directory invitation: copy, links, and send flag.
 * Usage: node scripts/test-organiser-directory-invite.js
 */
const emailTplModule = require('../api/_lib/supabase-email-templates');

emailTplModule.getEmailTemplateBySlug = async function mockGetEmailTemplateBySlug() {
  return null;
};

const { buildEmailFromTemplate } = require('../api/_lib/send-template-email');
const { mergeEmailPreviewVariables } = require('../api/_lib/email-preview-variables');
const { organiserSlugCandidate } = require('../api/_lib/organiser-slug');
const {
  DIRECTORY_INVITE_SLUG,
  UNCLAIMED_FOLLOWUP_SLUG,
  shouldSendDirectoryInvite,
  directoryInviteVariables,
  directoryInviteCreateMessage,
} = require('../api/_lib/organiser-directory-invite');
const { staleUnclaimedReminderReason } = require('../api/_lib/organiser-unclaimed-reminders');

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

async function main() {
  assert(shouldSendDirectoryInvite({}) === true, 'invite sends by default');
  assert(shouldSendDirectoryInvite({ send_invite: true }) === true, 'explicit true sends');
  assert(shouldSendDirectoryInvite({ send_invite: false }) === false, 'false skips');
  assert(shouldSendDirectoryInvite({ send_invite: 'false' }) === false, 'string false skips');
  pass('send flag');

  assert(organiserSlugCandidate('Harbour City Hosts', 0) === 'harbour-city-hosts', 'base slug');
  assert(organiserSlugCandidate('Harbour City Hosts', 1) === 'harbour-city-hosts-2', 'collision slug');
  pass('slug candidates');

  const vars = directoryInviteVariables({
    host: 'https://www.thenetworkeruk.com',
    groupName: 'Harbour & City Hosts',
    organiser: { id: 'org-1', slug: 'harbour-city-hosts', name: 'Harbour & City Hosts' },
    claimUrl:
      'https://www.thenetworkeruk.com/organisers/harbour-city-hosts?email=hello%40example.com&intent=organiser-claim',
  });
  assert(vars.events_url === 'https://www.thenetworkeruk.com/events/', 'events directory url');
  assert(vars.page_url.indexOf('/organisers/harbour-city-hosts') !== -1, 'page url uses claim link');
  assert(vars.group_name === 'Harbour & City Hosts', 'group name kept');
  pass('invite variables');

  const preview = mergeEmailPreviewVariables(DIRECTORY_INVITE_SLUG, {}, 'https://www.thenetworkeruk.com');
  const built = await buildEmailFromTemplate(DIRECTORY_INVITE_SLUG, preview);
  const html = built.html;
  const subject = built.subject;
  assert(subject.indexOf('City Connectors') !== -1, 'subject names the group: ' + subject);
  assert(subject.indexOf("haven't heard of us") !== -1, 'subject says they may not know us: ' + subject);
  assert(html.indexOf("You haven't heard of us.") !== -1, 'headline says they may not know us');
  assert(html.indexOf("We've heard of you.") !== -1, 'headline says we have heard of them');
  assert(html.indexOf('17,000') !== -1, 'mentions last year audience');
  assert(/free/i.test(html), 'says listing is free');
  assert(html.indexOf('meetings and workshops') !== -1, 'mentions meetings and workshops');
  assert(html.indexOf('show you around') !== -1, 'offers a tour');
  assert(html.indexOf('reviews') !== -1, 'mentions reviews');
  assert(html.indexOf('first visits versus returning guests') !== -1, 'mentions visit tracking');
  assert(html.indexOf('booking system') !== -1, 'mentions the booking system');
  assert(html.indexOf('speaking with you soon') !== -1, 'looks forward to speaking');
  assert(html.indexOf('/organisers/city-connectors') !== -1, 'page link substituted');
  assert(html.indexOf('/events/') !== -1, 'events link substituted');
  assert(html.indexOf('{{') === -1, 'no unresolved placeholders');
  assert(html.indexOf('See your page') !== -1, 'page button');
  pass('template builds — ' + subject);

  const followPreview = mergeEmailPreviewVariables(UNCLAIMED_FOLLOWUP_SLUG, {}, 'https://www.thenetworkeruk.com');
  const followBuilt = await buildEmailFromTemplate(UNCLAIMED_FOLLOWUP_SLUG, followPreview);
  const followHtml = followBuilt.html;
  const followSubject = followBuilt.subject;
  assert(followSubject.indexOf('City Connectors') !== -1, 'follow-up subject names the group: ' + followSubject);
  assert(/unclaimed/i.test(followSubject), 'follow-up subject says unclaimed: ' + followSubject);
  assert(followHtml.indexOf('has not been claimed') !== -1, 'says the page has not been claimed');
  assert(followHtml.indexOf('17,000') !== -1, 'follow-up mentions last year audience');
  assert(followHtml.indexOf('reviews') !== -1, 'follow-up mentions reviews');
  assert(followHtml.indexOf('first visits versus returning guests') !== -1, 'follow-up mentions visit tracking');
  assert(followHtml.indexOf('booking system') !== -1, 'follow-up mentions the booking system');
  assert(followHtml.indexOf('Claim your page') !== -1, 'claim button');
  assert(followHtml.indexOf('/organisers/city-connectors') !== -1, 'follow-up page link substituted');
  assert(followHtml.indexOf('/events/') !== -1, 'follow-up events link substituted');
  assert(followHtml.indexOf('{{') === -1, 'follow-up has no unresolved placeholders');
  assert(followHtml.indexOf('we wrote') === -1, 'follow-up does not assume a previous email');
  pass('follow-up template builds — ' + followSubject);

  const sent = directoryInviteCreateMessage({
    sendInvite: true,
    invite: { sent: true },
    email: 'hello@example.com',
  });
  assert(sent.indexOf('hello@example.com') !== -1 && sent.indexOf('invitation emailed') !== -1, sent);
  const failed = directoryInviteCreateMessage({
    sendInvite: true,
    invite: { sent: false, error: 'resend_down' },
    email: 'hello@example.com',
  });
  assert(failed.indexOf('could not be sent') !== -1 && failed.indexOf('resend_down') !== -1, failed);
  const skipped = directoryInviteCreateMessage({
    sendInvite: false,
    provision: { email: 'hello@example.com', createdAuth: true },
  });
  assert(skipped.indexOf('no invitation sent') !== -1, skipped);
  pass('admin messages');

  const base = {
    id: 'org-1',
    name: 'City Connectors',
    email: 'hello@city.example',
    listing_status: 'published',
    ownership_claim_status: 'pending',
  };
  const recent = { at: new Date(Date.now() - 2 * 86400000).toISOString() };
  const old = { at: new Date(Date.now() - 10 * 86400000).toISOString() };
  assert(staleUnclaimedReminderReason(base, null) === '', 'never contacted is eligible');
  assert(staleUnclaimedReminderReason(base, old) === '', 'contact older than 7 days is eligible');
  assert(staleUnclaimedReminderReason(base, recent) === 'recent_contact', 'contact inside 7 days is skipped');
  assert(
    staleUnclaimedReminderReason({ ...base, ownership_claim_status: 'claimed' }, null) === 'already_claimed',
    'claimed is skipped'
  );
  assert(
    staleUnclaimedReminderReason({ ...base, ownership_claim_status: 'disputed' }, null) === 'disputed',
    'disputed is skipped'
  );
  assert(
    staleUnclaimedReminderReason({ ...base, listing_status: 'unpublished' }, null) === 'hidden',
    'hidden is skipped'
  );
  assert(
    staleUnclaimedReminderReason({ ...base, listing_status: 'draft' }, null) === 'not_on_browse',
    'draft off the browse page is skipped'
  );
  assert(
    staleUnclaimedReminderReason(
      { ...base, listing_status: 'draft', verification_status: 'Verified' },
      null
    ) === '',
    'verified page on browse is eligible'
  );
  assert(staleUnclaimedReminderReason({ ...base, email: '' }, null) === 'missing_email', 'missing email is skipped');
  assert(
    staleUnclaimedReminderReason({ ...base, email: 'hi@thenetworkeruk.com' }, null) === 'opted_out',
    'staff inbox is skipped'
  );
  pass('stale unclaimed audience');
}

main().catch(function (err) {
  fail(err && err.stack ? err.stack : err);
});
