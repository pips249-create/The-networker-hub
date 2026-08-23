/**
 * Shared defaults for organiser bulk campaigns (Email 1 rebrand + Email 2 confirm).
 */
const LEGACY_SITE_URL = 'https://the-networker.co.uk';
const LEGACY_REPLY_EMAIL = 'hello@the-networker.co.uk';
const DEFAULT_LEGACY_FROM = 'Rosie @ The Networker <hello@the-networker.co.uk>';

function campaignSiteVars(host) {
  const site = String(host || '').replace(/\/$/, '');
  return {
    site_url: site,
    legacy_site_url: LEGACY_SITE_URL,
    legacy_logo_url: site + '/assets/logo-networker-legacy.png',
    logo_footer_url: site + '/assets/logo-email-footer.png',
    for_organisers_url: site + '/for-organisers',
    add_event_url: site + '/add-your-event',
    company_name: 'The Networker Group Ltd',
    company_number: '15252227',
    legacy_email: LEGACY_REPLY_EMAIL,
  };
}

function legacyCampaignFrom() {
  return (
    String(process.env.RESEND_FROM_LEGACY || '').trim() ||
    String(process.env.RESEND_FROM_THE_NETWORKER || '').trim() ||
    DEFAULT_LEGACY_FROM
  );
}

function isRebrandCampaignSlug(slug) {
  return String(slug || '').trim() === 'organiser_rebrand_announcement';
}

function launchInviteGroupName(vars) {
  return (
    String((vars && (vars.group_name || vars.organiser_name)) || 'your group').trim() || 'your group'
  );
}

/** Default Email 2 copy (already-notified groups confirming their page). */
function applyOrganiserLaunchInviteCopy(vars) {
  const next = vars && typeof vars === 'object' ? vars : {};
  const group = launchInviteGroupName(next);
  if (!next.group_name) next.group_name = group;
  if (!next.organiser_name) next.organiser_name = group;
  next.preheader =
    next.preheader ||
    'Your free page is ready — claim before 1 September for Founding Organiser extras.';
  next.hero_kicker = next.hero_kicker || 'Early invite · organisers only';
  next.hero_title = next.hero_title || 'Congratulations: ' + group + ' is ready';
  if (!next.intro_html) {
    next.intro_html =
      'Hi there. We&rsquo;re delighted to say your free organiser page is ready on <strong style="color:#1c2040;">The Networker UK</strong>' +
      String(next.other_groups_note || '') +
      '.';
  }
  return next;
}

/** Command Centre “Email their claim link” — we found the group and set the page up. */
function foundOrganiserLaunchInviteCopy(groupName) {
  const { escapeHtml } = require('./event-refund-policy');
  const group = String(groupName || 'your group').trim() || 'your group';
  return {
    group_name: group,
    organiser_name: group,
    preheader:
      'We found your networking group and have set up a free page for you on The Networker UK.',
    hero_kicker: 'An invitation from The Networker UK',
    hero_title: "There's a page with your name on it",
    intro_html:
      'Hi there. We came across your networking group and wanted to invite you onto <strong style="color:#1c2040;">The Networker UK</strong> &mdash; a free directory and workspace for UK networking groups. We&rsquo;ve already set up a page for <strong style="color:#1c2040;">' +
      escapeHtml(group) +
      '</strong>, so you can claim it, add your details, and list events when you&rsquo;re ready.',
  };
}

module.exports = {
  LEGACY_SITE_URL,
  LEGACY_REPLY_EMAIL,
  DEFAULT_LEGACY_FROM,
  campaignSiteVars,
  legacyCampaignFrom,
  isRebrandCampaignSlug,
  applyOrganiserLaunchInviteCopy,
  foundOrganiserLaunchInviteCopy,
};
