/**
 * Weekly Hubert Event Concierge helpers (cadence + Meet Rosie promo).
 * Kept free of Supabase/send deps so scripts and previews can load it alone.
 */
const { siteBase, rosiePhotoUrl } = require('./hub-email-urls');

/** One digest per member about every 7 days (daily cron drains a batch each morning). */
const HUBERT_CONCIERGE_INTERVAL_DAYS = 7;

/** Hide Meet Rosie / MarTech Summit block after the summit weekend (UTC). */
const MEET_ROSIE_MARTECH_PROMO_UNTIL_MS = Date.UTC(2026, 10, 12, 23, 59, 59);
const MARTECH_SUMMIT_EVENT_PATH = '/events/the-martech-summit-london-2026';

function isDueForHubertConcierge(sentAt, now = new Date()) {
  if (!sentAt) return true;
  const sent = new Date(sentAt);
  if (Number.isNaN(sent.getTime())) return true;
  const elapsedMs = now.getTime() - sent.getTime();
  return elapsedMs >= HUBERT_CONCIERGE_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
}

function hubertConciergeWeekLabel(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + mondayOffset);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Time-boxed Meet Rosie promo for The MarTech Summit London 2026.
 * Returns empty string after the summit so the weekly digest stays clean.
 */
function buildMeetRosieSectionHtml(siteUrl, now = new Date()) {
  if (now.getTime() > MEET_ROSIE_MARTECH_PROMO_UNTIL_MS) return '';
  const site = String(siteUrl || siteBase()).replace(/\/$/, '');
  const eventUrl = site + MARTECH_SUMMIT_EVENT_PATH;
  const photoUrl = rosiePhotoUrl(site);
  return (
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7f4fb;border:1px solid rgba(69,45,92,0.14);border-radius:14px;margin:8px 0 20px;">' +
    '<tr><td style="padding:22px 20px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">' +
    '<tr>' +
    '<td style="width:72px;vertical-align:top;padding:0 14px 0 0;">' +
    '<img src="' +
    photoUrl +
    '" alt="Rosie, co-founder of The Networker UK" width="72" height="72" style="width:72px;height:72px;border-radius:50%;display:block;border:0;object-fit:cover;">' +
    '</td>' +
    '<td style="vertical-align:top;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:0.6px;margin:0 0 6px;">Meet the team</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:18px;font-weight:700;color:#1c2040;margin:0 0 8px;line-height:1.3;">Meet Rosie (the co-founder) at The MarTech Summit</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;line-height:1.6;color:#635c5e;margin:0 0 14px;">Rosie will be at The MarTech Summit London — 10 &amp; 11 November 2026. Come say hello if you are there.</p>' +
    '<a href="' +
    eventUrl +
    '" style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:700;color:#5b2f99;text-decoration:none;">View The MarTech Summit &rarr;</a>' +
    '</td>' +
    '</tr>' +
    '</table>' +
    '</td></tr></table>'
  );
}

module.exports = {
  HUBERT_CONCIERGE_INTERVAL_DAYS,
  MEET_ROSIE_MARTECH_PROMO_UNTIL_MS,
  MARTECH_SUMMIT_EVENT_PATH,
  isDueForHubertConcierge,
  hubertConciergeWeekLabel,
  buildMeetRosieSectionHtml,
};
