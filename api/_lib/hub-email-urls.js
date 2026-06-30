function siteBase(siteUrl) {
  return String(siteUrl || process.env.SITE_URL || 'https://the-networker-hub.vercel.app').replace(
    /\/$/,
    ''
  );
}

function homeUrl(siteUrl) {
  return siteBase(siteUrl) + '/';
}

function browseEventsUrl(siteUrl) {
  return siteBase(siteUrl) + '/events/';
}

function hubAccountUrl(siteUrl) {
  return siteBase(siteUrl) + '/account/index.html';
}

function welcomeUrl(siteUrl) {
  return siteBase(siteUrl) + '/welcome.html';
}

function hubPaymentUrl(siteUrl, registrationId) {
  const base = hubAccountUrl(siteUrl);
  const id = String(registrationId || '').trim();
  if (!id) return base + '#payments';
  return base + '?booking=' + encodeURIComponent(id) + '#payments';
}

function legalPolicyUrl(siteUrl, section) {
  const key = String(section || 'overview').trim().replace(/^#/, '');
  const hash = key && key !== 'overview' ? '#' + key : '';
  return siteBase(siteUrl) + '/legal-policies.html' + hash;
}

function contactUrl(siteUrl) {
  return siteBase(siteUrl) + '/contact.html';
}

function eventPublicUrl(eventRow, siteUrl) {
  const site = siteBase(siteUrl);
  const slug = String(eventRow?.slug || '').trim();
  if (slug) return site + '/events/' + encodeURIComponent(slug);
  const id = String(eventRow?.id || '').trim();
  if (id) return site + '/events/event.html?id=' + encodeURIComponent(id);
  return browseEventsUrl(site);
}

function organiserPublicUrl(organiserRow, siteUrl) {
  const site = siteBase(siteUrl);
  const slug = String(organiserRow?.slug || '').trim();
  if (slug) return site + '/organisers/' + encodeURIComponent(slug);
  const id = String(organiserRow?.id || '').trim();
  if (id) return site + '/events/organiser.html?id=' + encodeURIComponent(id);
  return browseEventsUrl(site) + '#organisers';
}

function organiserDashboardUrl(siteUrl, options = {}) {
  const base = siteBase(siteUrl) + '/organiser/index.html';
  const panel = String(options.panel || '').trim();
  const eventId = String(options.eventId || '').trim();
  const applications = String(options.applications || '').trim();
  const params = new URLSearchParams();
  if (panel) params.set('panel', panel.replace(/^#/, ''));
  if (eventId) params.set('eventId', eventId);
  if (applications) params.set('applications', applications);
  const qs = params.toString();
  // Query params survive email clients better than hash-only routes.
  const hash = panel ? '#' + panel.replace(/^#/, '') : '';
  return base + (qs ? '?' + qs : '') + hash;
}

module.exports = {
  siteBase,
  homeUrl,
  browseEventsUrl,
  hubAccountUrl,
  welcomeUrl,
  hubPaymentUrl,
  legalPolicyUrl,
  contactUrl,
  eventPublicUrl,
  organiserPublicUrl,
  organiserDashboardUrl,
};
