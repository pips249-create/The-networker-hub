/**
 * Invitation sent when an admin adds a networking group:
 * look at The Networker UK, their new page, and the events directory.
 */
const DIRECTORY_INVITE_SLUG = 'organiser_directory_invite';
const UNCLAIMED_FOLLOWUP_SLUG = 'organiser_unclaimed_followup';

function shouldSendDirectoryInvite(body) {
  if (!body || typeof body !== 'object') return true;
  const flag = body.send_invite;
  if (flag === false || flag === 0 || flag === '0' || flag === 'false') return false;
  return true;
}

function directoryInviteVariables({ host, groupName, organiser, claimUrl }) {
  const { campaignSiteVars } = require('./organiser-campaign-defaults');
  const { organiserPublicUrl, browseEventsUrl, contactUrl } = require('./hub-email-urls');
  const site = String(host || '').replace(/\/$/, '');
  const name = String(groupName || (organiser && organiser.name) || 'your group').trim() || 'your group';
  const organiserUrl = organiserPublicUrl(organiser || { name }, site);
  const claim = String(claimUrl || '').trim();
  const pageUrl = claim.indexOf('/organisers/') !== -1 ? claim : organiserUrl;
  return {
    ...campaignSiteVars(site),
    group_name: name,
    organiser_name: name,
    organiser_url: organiserUrl,
    events_url: browseEventsUrl(site),
    claim_url: claim || organiserUrl,
    page_url: pageUrl,
    contact_url: contactUrl(site),
  };
}

function directoryInviteCreateMessage({ sendInvite, invite, provision, email }) {
  const to = String(email || (provision && provision.email) || '').trim();
  if (sendInvite) {
    if (invite && invite.sent) {
      return 'Group created and an invitation emailed to ' + (to || 'the contact') + '. Their page is live.';
    }
    const why = invite && invite.error ? ' (' + String(invite.error).slice(0, 180) + ')' : '';
    return (
      'Group created and the page is live, but the invitation email could not be sent' +
      why +
      '. Use Copy claim link on the row.'
    );
  }
  if (provision && provision.email) {
    return provision.createdAuth
      ? 'Group created as a draft and login added for ' + provision.email + ' (no invitation sent).'
      : 'Group created as a draft and linked to existing login for ' + provision.email + ' (no invitation sent).';
  }
  return 'Networking group created as a draft (no invitation sent).';
}

async function sendOutreachEmail({ slug, to, host, organiser, claimUrl, actorEmail, source, campaign, idempotencyKey }) {
  const email = String(to || '')
    .trim()
    .toLowerCase();
  const name = String((organiser && organiser.name) || 'your group').trim() || 'your group';
  if (!email) return { sent: false, error: 'missing_email' };
  const variables = directoryInviteVariables({
    host,
    groupName: name,
    organiser,
    claimUrl,
  });
  try {
    const { sendTemplatedEmail } = require('./send-template-email');
    const { supportEmail } = require('./hub-email-urls');
    const organiserId = organiser && organiser.id ? String(organiser.id) : '';
    await sendTemplatedEmail({
      slug,
      to: email,
      variables,
      skipEmailCheck: true,
      replyTo: supportEmail(),
      idempotencyKey: idempotencyKey || undefined,
    });
    try {
      const { logClaimInviteSent } = require('./organiser-claim-invite-log');
      await logClaimInviteSent({
        email,
        organiserId: organiserId || null,
        organiserName: name,
        slug,
        source: source || 'admin',
        campaign: campaign || slug,
        actorEmail: actorEmail || undefined,
      });
    } catch {
      /* outreach logging must not fail the send */
    }
    return { sent: true, to: email, name };
  } catch (e) {
    console.error('[organiser-directory-invite]', e && e.message ? e.message : e);
    return { sent: false, to: email, name, error: (e && e.message) || 'send_failed' };
  }
}

async function sendOrganiserDirectoryInvite({ to, host, organiser, claimUrl, actorEmail }) {
  const organiserId = organiser && organiser.id ? String(organiser.id) : '';
  return sendOutreachEmail({
    slug: DIRECTORY_INVITE_SLUG,
    to,
    host,
    organiser,
    claimUrl,
    actorEmail,
    source: 'admin_create_group',
    campaign: 'directory_invite',
    idempotencyKey: organiserId ? 'dir-invite-' + organiserId : undefined,
  });
}

async function sendOrganiserUnclaimedFollowup({ to, host, organiser, claimUrl, actorEmail }) {
  const organiserId = organiser && organiser.id ? String(organiser.id) : '';
  const day = new Date().toISOString().slice(0, 10);
  return sendOutreachEmail({
    slug: UNCLAIMED_FOLLOWUP_SLUG,
    to,
    host,
    organiser,
    claimUrl,
    actorEmail,
    source: 'admin_unclaimed_followup',
    campaign: 'unclaimed_followup',
    idempotencyKey: organiserId ? 'unclaimed-followup-' + organiserId + '-' + day : undefined,
  });
}

module.exports = {
  DIRECTORY_INVITE_SLUG,
  UNCLAIMED_FOLLOWUP_SLUG,
  shouldSendDirectoryInvite,
  directoryInviteVariables,
  directoryInviteCreateMessage,
  sendOrganiserDirectoryInvite,
  sendOrganiserUnclaimedFollowup,
};
