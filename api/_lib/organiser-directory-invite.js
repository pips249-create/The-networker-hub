/**
 * Invitation sent when an admin adds a networking group:
 * look at The Networker UK, their new page, and the events directory.
 */
const DIRECTORY_INVITE_SLUG = 'organiser_directory_invite';
const DIRECTORY_NUDGE_SLUG = 'organiser_directory_invite_nudge';
const DIRECTORY_DAY7_SLUG = 'organiser_directory_invite_day7';
const DIRECTORY_DAY21_SLUG = 'organiser_directory_invite_day21';
const DIRECTORY_DAY35_SLUG = 'organiser_directory_invite_day35';
const UNCLAIMED_FOLLOWUP_SLUG = 'organiser_unclaimed_followup';

function shouldSendDirectoryInvite(body) {
  if (!body || typeof body !== 'object') return true;
  const flag = body.send_invite;
  if (flag === false || flag === 0 || flag === '0' || flag === 'false') return false;
  return true;
}

function groupedGroupName(names) {
  const clean = [];
  const seen = new Set();
  (names || []).forEach((name) => {
    const text = String(name || '').trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) return;
    seen.add(key);
    clean.push(text);
  });
  if (!clean.length) return 'your group';
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return clean[0] + ' and ' + clean[1];
  return clean[0] + ', ' + clean[1] + ' and ' + (clean.length - 2) + ' more';
}

function directoryGroupsHtml(items) {
  const list = [];
  const seen = new Set();
  (items || []).forEach((item) => {
    const name = String((item && item.name) || '').trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return;
    seen.add(key);
    list.push({ name, url: String((item && item.url) || '').trim() });
  });
  if (list.length < 2) return '';
  const { escapeHtml } = require('./event-refund-policy');
  const rows = list
    .map((item) => {
      const name = escapeHtml(item.name);
      const url = /^https?:\/\//i.test(item.url) ? escapeHtml(item.url) : '';
      const label = url
        ? '<a href="' + url + '" style="color:#452d5c;font-weight:700;text-decoration:none;">' + name + '</a>'
        : name;
      return (
        '<tr><td style="padding:0 0 8px;font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;line-height:1.5;color:#1c2040;">' +
        label +
        '</td></tr>'
      );
    })
    .join('');
  return (
    '<tr><td class="mobile-pad" style="padding:8px 40px 4px;text-align:left;">' +
    '<p class="body-copy" style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;line-height:1.7;color:#635c5e;margin:0 0 10px;">These pages are ready:</p>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">' +
    rows +
    '</table></td></tr>'
  );
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
    groups_html: '',
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

function outreachLogTargets(organiser, siblingOrganisers) {
  const targets = [];
  const seen = new Set();
  const primaryId = organiser && organiser.id ? String(organiser.id) : '';
  const primaryName = String((organiser && organiser.name) || 'your group').trim() || 'your group';
  if (primaryId) {
    seen.add(primaryId);
    targets.push({ id: primaryId, name: primaryName });
  }
  (siblingOrganisers || []).forEach((row) => {
    const id = row && row.id ? String(row.id) : '';
    if (!id || seen.has(id)) return;
    seen.add(id);
    targets.push({
      id,
      name: String((row && row.name) || primaryName).trim() || primaryName,
    });
  });
  return targets;
}

async function sendOutreachEmail({
  slug,
  to,
  host,
  organiser,
  claimUrl,
  actorEmail,
  source,
  campaign,
  idempotencyKey,
  extraVariables,
  siblingOrganisers,
}) {
  const email = String(to || '')
    .trim()
    .toLowerCase();
  const name = String((extraVariables && extraVariables.group_name) || (organiser && organiser.name) || 'your group').trim() || 'your group';
  if (!email) return { sent: false, error: 'missing_email' };
  const variables = {
    ...directoryInviteVariables({
      host,
      groupName: (organiser && organiser.name) || name,
      organiser,
      claimUrl,
    }),
    ...(extraVariables || {}),
  };
  try {
    const { sendTemplatedEmail } = require('./send-template-email');
    const { supportEmail } = require('./hub-email-urls');
    const organiserId = organiser && organiser.id ? String(organiser.id) : '';
    await sendTemplatedEmail({
      slug,
      to: email,
      variables,
      skipEmailCheck: false,
      replyTo: supportEmail(),
      idempotencyKey: idempotencyKey || undefined,
    });
    try {
      const { logClaimInviteSent } = require('./organiser-claim-invite-log');
      const targets = outreachLogTargets(organiser, siblingOrganisers);
      const logged = targets.length ? targets : [{ id: organiserId, name }];
      for (const target of logged) {
        if (!target.id) continue;
        await logClaimInviteSent({
          email,
          organiserId: target.id,
          organiserName: target.name,
          slug,
          source: source || 'admin',
          campaign: campaign || slug,
          actorEmail: actorEmail || undefined,
        });
      }
    } catch {
      /* outreach logging must not fail the send */
    }
    return { sent: true, to: email, name, organisers: outreachLogTargets(organiser, siblingOrganisers).length || 1 };
  } catch (e) {
    console.error('[organiser-directory-invite]', e && e.message ? e.message : e);
    return { sent: false, to: email, name, error: (e && e.message) || 'send_failed' };
  }
}

async function sendOrganiserDirectoryInvite({ to, host, organiser, claimUrl, actorEmail, extraVariables, siblingOrganisers }) {
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
    extraVariables,
    siblingOrganisers,
  });
}

async function sendOrganiserDirectoryNudge({ to, host, organiser, claimUrl, actorEmail, extraVariables, siblingOrganisers }) {
  const organiserId = organiser && organiser.id ? String(organiser.id) : '';
  return sendOutreachEmail({
    slug: DIRECTORY_NUDGE_SLUG,
    to,
    host,
    organiser,
    claimUrl,
    actorEmail,
    source: 'directory_invite_nudge',
    campaign: 'directory_invite_nudge',
    idempotencyKey: organiserId ? 'dir-nudge-' + organiserId : undefined,
    extraVariables,
    siblingOrganisers,
  });
}

async function sendOrganiserDirectoryDay7({ to, host, organiser, claimUrl, actorEmail, extraVariables, siblingOrganisers }) {
  const organiserId = organiser && organiser.id ? String(organiser.id) : '';
  return sendOutreachEmail({
    slug: DIRECTORY_DAY7_SLUG,
    to,
    host,
    organiser,
    claimUrl,
    actorEmail,
    source: 'directory_invite_day7',
    campaign: 'directory_invite_day7',
    idempotencyKey: organiserId ? 'dir-day7-' + organiserId : undefined,
    extraVariables,
    siblingOrganisers,
  });
}

async function sendOrganiserDirectoryDay21({ to, host, organiser, claimUrl, actorEmail, extraVariables, siblingOrganisers }) {
  const organiserId = organiser && organiser.id ? String(organiser.id) : '';
  return sendOutreachEmail({
    slug: DIRECTORY_DAY21_SLUG,
    to,
    host,
    organiser,
    claimUrl,
    actorEmail,
    source: 'directory_invite_day21',
    campaign: 'directory_invite_day21',
    idempotencyKey: organiserId ? 'dir-day21-' + organiserId : undefined,
    extraVariables,
    siblingOrganisers,
  });
}

async function sendOrganiserDirectoryDay35({ to, host, organiser, claimUrl, actorEmail, extraVariables, siblingOrganisers }) {
  const organiserId = organiser && organiser.id ? String(organiser.id) : '';
  return sendOutreachEmail({
    slug: DIRECTORY_DAY35_SLUG,
    to,
    host,
    organiser,
    claimUrl,
    actorEmail,
    source: 'directory_invite_day35',
    campaign: 'directory_invite_day35',
    idempotencyKey: organiserId ? 'dir-day35-' + organiserId : undefined,
    extraVariables,
    siblingOrganisers,
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
  DIRECTORY_NUDGE_SLUG,
  DIRECTORY_DAY7_SLUG,
  DIRECTORY_DAY21_SLUG,
  DIRECTORY_DAY35_SLUG,
  UNCLAIMED_FOLLOWUP_SLUG,
  shouldSendDirectoryInvite,
  groupedGroupName,
  directoryGroupsHtml,
  directoryInviteVariables,
  directoryInviteCreateMessage,
  sendOrganiserDirectoryInvite,
  sendOrganiserDirectoryNudge,
  sendOrganiserDirectoryDay7,
  sendOrganiserDirectoryDay21,
  sendOrganiserDirectoryDay35,
  sendOrganiserUnclaimedFollowup,
};
