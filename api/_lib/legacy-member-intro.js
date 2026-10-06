/**
 * One-off reintroduction for people imported from the-networker.co.uk.
 * Member-facing: create an account, browse events, groups, offers, opportunities.
 */
const { campaignSiteVars } = require('./organiser-campaign-defaults');

const LEGACY_MEMBER_INTRO_SLUG = 'legacy_site_reintroduction';
const LEGACY_EVENT_COUNT_LABEL = '6,500';

function firstName(personName) {
  const raw = String(personName || '').trim();
  if (!raw) return 'there';
  const first = raw.split(/\s+/)[0].replace(/[^A-Za-z'’-]/g, '');
  if (!first || first.length < 2) return 'there';
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function legacyMemberIntroVars(host, personName, options) {
  const site = String(host || 'https://www.thenetworkeruk.com').replace(/\/$/, '');
  const hasAccount = Boolean(options && options.hasAccount);
  const memberOffersNext = encodeURIComponent('/account/#member-offers');
  return {
    ...campaignSiteVars(site),
    user_name: firstName(personName),
    event_count: LEGACY_EVENT_COUNT_LABEL,
    register_url: site + '/register',
    groups_url: site + '/events/?mode=organisers',
    browse_events_url: site + '/events/',
    opportunities_url: site + '/opportunities/',
    member_offers_url: hasAccount
      ? site + '/account/#member-offers'
      : site + '/register?next=' + memberOffersNext,
    cta_url: hasAccount ? site + '/account/' : site + '/register',
    cta_label: hasAccount ? 'Open your account' : 'Create your account now',
    account_prompt: hasAccount
      ? 'Open your account and you can:'
      : 'Create your free account and you can:',
    preheader: hasAccount
      ? LEGACY_EVENT_COUNT_LABEL +
        ' events are already listed on The Networker UK, with more added every day. Open your account to follow groups, browse member offers, and see new events and business opportunities.'
      : LEGACY_EVENT_COUNT_LABEL +
        ' events are already listed on The Networker UK. Create your free account to follow groups, browse member offers, and see new events and business opportunities.',
  };
}

function isLegacyMemberIntroSlug(slug) {
  return String(slug || '').trim() === LEGACY_MEMBER_INTRO_SLUG;
}

module.exports = {
  LEGACY_MEMBER_INTRO_SLUG,
  LEGACY_EVENT_COUNT_LABEL,
  firstName,
  legacyMemberIntroVars,
  isLegacyMemberIntroSlug,
};
