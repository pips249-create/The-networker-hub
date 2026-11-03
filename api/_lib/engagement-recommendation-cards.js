/**
 * Navy recommendation cards for nurture / Hubert event-pick emails.
 * Kept free of Supabase/send deps so unit tests can load it alone.
 */
const { escapeHtml } = require('./event-refund-policy');
const { formatEventDateTime } = require('./event-timezone');
const { eventPublicUrl, toPublicAssetUrl } = require('./hub-email-urls');

/**
 * Lightweight photo URL check for email cards (no Supabase client load).
 * Full resolvePhotoUrl lives in supabase-organisers-browse for browse pages.
 */
function resolveOrganiserPhotoForEmail(raw) {
  const url = String(raw || '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const path = parsed.pathname.toLowerCase();
      if (
        /(^|\.)(linkedin|facebook|instagram|twitter|x)\.com$/i.test(host) &&
        !/\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(path)
      ) {
        return '';
      }
      if (/(^|\.)(drive|docs)\.google\.com$/i.test(host)) return '';
    } catch {
      return '';
    }
    return url;
  }
  if (url.startsWith('/')) return url;
  return '';
}

function eventOrganiserLogoUrl(organiserRow, siteUrl) {
  const raw = resolveOrganiserPhotoForEmail(organiserRow?.photo_url);
  if (!raw) return '';
  return toPublicAssetUrl(raw, siteUrl);
}

function recommendationCard(title, subtitle, url, options = {}) {
  const logoUrl = String(options.logoUrl || '').trim();
  const logoAlt = escapeHtml(String(options.logoAlt || 'Organiser').trim() || 'Organiser');
  const safeTitle = escapeHtml(String(title || '').trim());
  const safeSubtitle = escapeHtml(String(subtitle || '').trim());
  const safeUrl = String(url || '').trim();

  const logoCell = logoUrl
    ? '<td style="width:56px;vertical-align:top;padding:0 0 0 14px;">' +
      '<img src="' +
      escapeHtml(logoUrl) +
      '" alt="' +
      logoAlt +
      '" width="48" height="48" style="display:block;width:48px;height:48px;object-fit:contain;border:0;border-radius:10px;background:#ffffff;padding:4px;box-sizing:border-box;" />' +
      '</td>'
    : '';

  return (
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#1c2040;border-radius:14px;margin:0 0 12px;">' +
    '<tr><td style="padding:18px 20px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>' +
    '<td style="vertical-align:top;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0 0 6px;line-height:1.35;">' +
    safeTitle +
    '</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;color:rgba(255,255,255,0.7);margin:0 0 12px;line-height:1.5;">' +
    safeSubtitle +
    '</p>' +
    '<a href="' +
    escapeHtml(safeUrl) +
    '" style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#4aa8f0;text-decoration:none;">View &rarr;</a>' +
    '</td>' +
    logoCell +
    '</tr></table>' +
    '</td></tr></table>'
  );
}

function eventRecommendationSubtitle(ev) {
  const { event_date, event_time } = formatEventDateTime(ev.starts_at);
  const loc = String(ev.location_label || ev.venue || ev.city || '').trim() || 'See event page';
  const orgName = String(ev.organisers?.name || 'Organiser').trim();
  return (
    orgName +
    ' · ' +
    event_date +
    (event_time ? ' · ' + event_time : '') +
    ' · ' +
    loc
  );
}

function eventRecommendationLogoOptions(ev, siteUrl) {
  const org = ev?.organisers || null;
  const logoUrl = eventOrganiserLogoUrl(org, siteUrl);
  if (!logoUrl) return {};
  return {
    logoUrl,
    logoAlt: String(org?.name || 'Organiser').trim() || 'Organiser',
  };
}

function eventRecommendationCard(ev, siteUrl) {
  return recommendationCard(
    String(ev.title || 'Event').trim(),
    eventRecommendationSubtitle(ev),
    eventPublicUrl(ev, siteUrl),
    eventRecommendationLogoOptions(ev, siteUrl)
  );
}

module.exports = {
  recommendationCard,
  eventRecommendationSubtitle,
  eventRecommendationLogoOptions,
  eventRecommendationCard,
  eventOrganiserLogoUrl,
};
