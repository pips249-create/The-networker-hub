/**
 * Weekly Hubert Event Concierge helpers (cadence + alternating co-founder promos).
 * Kept free of Supabase/send deps so scripts and previews can load it alone.
 */
const { siteBase, rosiePhotoUrl, catherinePhotoUrl } = require('./hub-email-urls');

/** One digest per member about every 7 days (daily cron drains a batch each morning). */
const HUBERT_CONCIERGE_INTERVAL_DAYS = 7;

/**
 * Hide both co-founder event promos after the November 2026 shows wrap (UTC).
 * MarTech Summit: 10–11 Nov · Business Show London: 11–12 Nov.
 */
const COFOUNDER_EVENT_PROMO_UNTIL_MS = Date.UTC(2026, 10, 13, 23, 59, 59);

const MARTECH_SUMMIT_EVENT_PATH = '/events/the-martech-summit-london-2026';
const BUSINESS_SHOW_LONDON_EVENT_PATH = '/events/the-business-show-london';

/** @deprecated use COFOUNDER_EVENT_PROMO_UNTIL_MS */
const MEET_ROSIE_MARTECH_PROMO_UNTIL_MS = COFOUNDER_EVENT_PROMO_UNTIL_MS;

function isDueForHubertConcierge(sentAt, now = new Date()) {
  if (!sentAt) return true;
  const sent = new Date(sentAt);
  if (Number.isNaN(sent.getTime())) return true;
  const elapsedMs = now.getTime() - sent.getTime();
  return elapsedMs >= HUBERT_CONCIERGE_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
}

function mondayOfUtcWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + mondayOffset);
  return d;
}

function hubertConciergeWeekLabel(date = new Date()) {
  return mondayOfUtcWeek(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * ISO week number (UTC Monday week) — used to alternate Rosie / Catherine promos.
 */
function utcIsoWeekNumber(date = new Date()) {
  const monday = mondayOfUtcWeek(date);
  const yearStart = new Date(Date.UTC(monday.getUTCFullYear(), 0, 1));
  return Math.floor((monday - yearStart) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

/**
 * Even ISO weeks → Rosie @ MarTech Summit; odd weeks → Catherine @ Business Show.
 * After both events, returns null so the digest has no promo block.
 */
function pickCofounderPromo(now = new Date()) {
  if (now.getTime() > COFOUNDER_EVENT_PROMO_UNTIL_MS) return null;
  const week = utcIsoWeekNumber(now);
  if (week % 2 === 0) {
    return {
      id: 'rosie_martech',
      name: 'Rosie',
      roleLabel: 'the co-founder',
      photoAlt: 'Rosie, co-founder of The Networker UK',
      photoUrlFn: rosiePhotoUrl,
      headline: 'Meet Rosie (the co-founder) at The MarTech Summit',
      body:
        'Rosie will be at The MarTech Summit London — 10 &amp; 11 November 2026. Come say hello if you are there.',
      ctaLabel: 'View The MarTech Summit',
      eventPath: MARTECH_SUMMIT_EVENT_PATH,
    };
  }
  return {
    id: 'catherine_business_show',
    name: 'Catherine',
    roleLabel: 'from The Networker UK',
    photoAlt: 'Catherine from The Networker UK',
    photoUrlFn: catherinePhotoUrl,
    headline: 'Meet Catherine at The Business Show London',
    body:
      'Catherine from The Networker UK will be at The Business Show London — 11 &amp; 12 November 2026 at ExCeL. Come say hello if you are there.',
    ctaLabel: 'View The Business Show London',
    eventPath: BUSINESS_SHOW_LONDON_EVENT_PATH,
  };
}

function buildCofounderPromoSectionHtml(promo, siteUrl) {
  if (!promo) return '';
  const site = String(siteUrl || siteBase()).replace(/\/$/, '');
  const eventUrl = site + promo.eventPath;
  const photoUrl = promo.photoUrlFn(site);
  return (
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7f4fb;border:1px solid rgba(69,45,92,0.14);border-radius:14px;margin:8px 0 20px;">' +
    '<tr><td style="padding:22px 20px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">' +
    '<tr>' +
    '<td style="width:72px;vertical-align:top;padding:0 14px 0 0;">' +
    '<img src="' +
    photoUrl +
    '" alt="' +
    promo.photoAlt +
    '" width="72" height="72" style="width:72px;height:72px;border-radius:50%;display:block;border:0;object-fit:cover;">' +
    '</td>' +
    '<td style="vertical-align:top;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:0.6px;margin:0 0 6px;">Meet the team</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:18px;font-weight:700;color:#1c2040;margin:0 0 8px;line-height:1.3;">' +
    promo.headline +
    '</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;line-height:1.6;color:#635c5e;margin:0 0 14px;">' +
    promo.body +
    '</p>' +
    '<a href="' +
    eventUrl +
    '" style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:700;color:#5b2f99;text-decoration:none;">' +
    promo.ctaLabel +
    ' &rarr;</a>' +
    '</td>' +
    '</tr>' +
    '</table>' +
    '</td></tr></table>'
  );
}

/**
 * Alternating weekly Meet Rosie / Meet Catherine promo.
 * Even weeks: Rosie @ MarTech Summit. Odd weeks: Catherine @ Business Show London.
 */
function buildMeetTeamSectionHtml(siteUrl, now = new Date()) {
  return buildCofounderPromoSectionHtml(pickCofounderPromo(now), siteUrl);
}

/** @deprecated use buildMeetTeamSectionHtml — kept for older call sites / previews */
function buildMeetRosieSectionHtml(siteUrl, now = new Date()) {
  return buildMeetTeamSectionHtml(siteUrl, now);
}

module.exports = {
  HUBERT_CONCIERGE_INTERVAL_DAYS,
  COFOUNDER_EVENT_PROMO_UNTIL_MS,
  MEET_ROSIE_MARTECH_PROMO_UNTIL_MS,
  MARTECH_SUMMIT_EVENT_PATH,
  BUSINESS_SHOW_LONDON_EVENT_PATH,
  isDueForHubertConcierge,
  hubertConciergeWeekLabel,
  utcIsoWeekNumber,
  pickCofounderPromo,
  buildMeetTeamSectionHtml,
  buildMeetRosieSectionHtml,
};
