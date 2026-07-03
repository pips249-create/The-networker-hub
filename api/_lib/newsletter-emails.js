/**
 * Hub newsletter edition → template variables.
 */
const { isEventPublishedForSale, resolveTicketSalesEnabled, isTicketOnSale, groupTicketsByEventId } = require('./ticket-sales');
const { formatEventDateTime } = require('./favourite-sales-emails');
const { computeLiveRankingIndex, currentPeriodLabel } = require('./organiser-ranking-snapshot');
const { listingPaymentCurrent } = require('./opportunity-listing-pricing');
const {
  siteBase,
  browseEventsUrl,
  hubAccountUrl,
  legalPolicyUrl,
  contactUrl,
  logoNavUrl,
  logoFooterUrl,
  eventPublicUrl,
  organiserPublicUrl,
  opportunityPublicUrl,
} = require('./hub-email-urls');

const NEWSLETTER_SLUG = 'hub_newsletter';

/** Hub newsletter palette — purple-led, less navy/blue. */
const NL = {
  dark: '#452d5c',
  primary: '#5b2f99',
  accent: '#9a7aa8',
  linkOnDark: '#d9c4e0',
  light: '#f3ecfa',
  lightBorder: '#e8dce8',
  cream: '#f5f0e8',
  text: '#4a4446',
  textMuted: '#635c5e',
  outerBg: '#ebe8f2',
};

const {
  NEWSLETTER_LAYOUTS,
  normalizeNewsletterLayout,
  getNewsletterLayoutConfig,
} = require('./newsletter-layouts');
const { fetchNearbyEvents } = require('./nearby-events');

function isEditionUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '').trim()
  );
}

function parseEditionUuidList(raw) {
  const ids = Array.isArray(raw)
    ? raw.map((id) => String(id || '').trim()).filter(Boolean)
    : String(raw || '')
        .split(/[\s,]+/)
        .map((id) => id.trim())
        .filter(Boolean);
  return ids.filter(isEditionUuid);
}

function editionBoolean(value, defaultTrue) {
  if (value === true || value === false) return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return defaultTrue !== false;
}

function articleImageUrl(edition) {
  return String(edition.articleImageUrl || edition.article_image_url || '').trim();
}

function articleThumbHtml(imageUrl, options) {
  const url = String(imageUrl || '').trim();
  if (!url) return '';
  const width = Number(options?.width) || 96;
  const height = Number(options?.height) || 72;
  const radius = Number(options?.radius) || 10;
  const alt = escapeHtml(options?.alt || 'Editorial');
  return (
    '<img src="' +
    escapeHtml(url) +
    '" alt="' +
    alt +
    '" width="' +
    width +
    '" height="' +
    height +
    '" style="width:' +
    width +
    'px;max-width:100%;height:' +
    height +
    'px;object-fit:cover;border-radius:' +
    radius +
    'px;display:block;">'
  );
}

function articleHeroImageHtml(edition, layout) {
  const url = articleImageUrl(edition);
  if (!url || layout !== 'editorial') return '';
  return (
    '<tr><td class="mobile-pad" style="padding:8px 44px 0;text-align:left;">' +
    '<img src="' +
    escapeHtml(url) +
    '" alt="" width="512" style="width:100%;max-width:512px;height:auto;border-radius:16px;display:block;">' +
    '</td></tr>'
  );
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paragraphsHtml(text) {
  const blocks = String(text || '')
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!blocks.length) return '';
  return blocks
    .map(function (block) {
      const lines = block
        .split(/\n/)
        .map((line) => escapeHtml(line.trim()))
        .filter(Boolean)
        .join('<br>');
      return (
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;line-height:1.7;color:#635c5e;margin:0 0 12px;">' +
        lines +
        '</p>'
      );
    })
    .join('');
}

function sectionWrap(kicker, title, innerRows) {
  const body = String(innerRows || '').trim();
  if (!body) return '';
  const kickerHtml = String(kicker || '').trim()
    ? '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">' +
      escapeHtml(kicker) +
      '</p>'
    : '';
  const titleHtml = String(title || '').trim()
    ? '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:18px;font-weight:600;color:' +
      NL.dark +
      ';margin:0 0 14px;line-height:1.3;">' +
      escapeHtml(title) +
      '</p>'
    : '';
  return (
    '<tr><td class="mobile-pad" style="padding:20px 40px 4px;text-align:left;">' +
    kickerHtml +
    titleHtml +
    '</td></tr>' +
    body
  );
}

function accentCard(content) {
  return (
    '<tr><td class="mobile-pad" style="padding:0 40px 16px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:' +
    NL.dark +
    ';border-radius:14px;">' +
    '<tr><td style="padding:20px 22px;">' +
    content +
    '</td></tr></table></td></tr>'
  );
}

function ticketIsApplication(row) {
  const ticketType = String(row?.ticket_type || '').trim();
  const name = String(row?.name || '').toLowerCase();
  return ticketType.includes('application') || /application to attend/.test(name);
}

function eventOrganiserName(eventRow) {
  if (eventRow?.organisers && typeof eventRow.organisers === 'object') {
    return String(eventRow.organisers.name || '').trim();
  }
  return String(eventRow?.organiser_name || '').trim();
}

function eventCtaLabel(eventRow, tickets) {
  const list = Array.isArray(tickets) ? tickets : [];
  const onSale = list.filter((ticket) => isTicketOnSale(ticket));
  const salesOpen = resolveTicketSalesEnabled(eventRow, list);

  if (salesOpen) {
    const standardOnSale = onSale.some((ticket) => !ticketIsApplication(ticket));
    const applicationOnSale = onSale.some((ticket) => ticketIsApplication(ticket));
    if (standardOnSale && applicationOnSale) return 'View event & book →';
    if (applicationOnSale) return 'Apply to attend →';
    return 'Book tickets →';
  }

  if (onSale.length) return 'View event →';
  return 'Find out more →';
}

function eventListingCard(eventRow, site, tickets) {
  const url = eventPublicUrl(eventRow, site);
  const title = String(eventRow.title || 'Event').trim();
  const organiserName = eventOrganiserName(eventRow);
  const { event_date, event_time } = formatEventDateTime(eventRow.starts_at);
  const loc =
    String(eventRow.location_label || eventRow.venue || eventRow.city || '').trim() ||
    'See event page';
  const whenWhere =
    event_date + (event_time ? ' · ' + event_time : '') + ' · ' + loc;
  const ctaLabel = eventCtaLabel(eventRow, tickets);

  const organiserHtml = organiserName
    ? '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:600;color:' +
      NL.accent +
      ';margin:0 0 6px;line-height:1.4;">' +
      escapeHtml(organiserName) +
      '</p>'
    : '';

  return (
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f0e8;border-radius:12px;margin:0 0 12px;border:1px solid #e8dce8;">' +
    '<tr><td style="padding:16px 18px 14px;">' +
    organiserHtml +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:600;color:' +
    NL.dark +
    ';margin:0 0 6px;line-height:1.35;">' +
    escapeHtml(title) +
    '</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;color:#635c5e;margin:0 0 12px;line-height:1.5;">' +
    escapeHtml(whenWhere) +
    '</p>' +
    '<a href="' +
    escapeHtml(url) +
    '" style="display:inline-block;padding:12px 22px;background:' +
    NL.primary +
    ';border-radius:999px;color:#ffffff;font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;text-decoration:none;">' +
    escapeHtml(ctaLabel) +
    '</a>' +
    '</td></tr></table>'
  );
}

async function fetchTicketsByEventId(sb, eventIds) {
  const ids = (eventIds || []).filter(Boolean);
  if (!ids.length) return new Map();
  const { data, error } = await sb
    .from('tickets')
    .select('id, event_id, name, ticket_type, status, sale_starts_at, sale_ends_at')
    .in('event_id', ids);
  if (error) throw new Error(error.message);
  const grouped = groupTicketsByEventId(data || []);
  return new Map(Object.entries(grouped));
}

function listingCard(title, subtitle, url, badge) {
  const badgeHtml = badge
    ? '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:' +
      NL.accent +
      ';text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px;">' +
      escapeHtml(badge) +
      '</p>'
    : '';
  return (
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f0e8;border-radius:12px;margin:0 0 10px;border:1px solid #e8dce8;">' +
    '<tr><td style="padding:16px 18px;">' +
    badgeHtml +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:600;color:' +
    NL.dark +
    ';margin:0 0 6px;line-height:1.35;">' +
    '<a href="' +
    escapeHtml(url) +
    '" style="color:' +
    NL.dark +
    ';text-decoration:none;">' +
    escapeHtml(title) +
    '</a></p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;color:#635c5e;margin:0;line-height:1.5;">' +
    escapeHtml(subtitle) +
    '</p></td></tr></table>'
  );
}

function buildArticleSection(edition, layout) {
  const resolvedLayout = normalizeNewsletterLayout(layout || edition.layout);
  const title = String(edition.articleTitle || edition.article_title || '').trim();
  const body = String(edition.articleBody || edition.article_body || '').trim();
  const imageUrl = articleImageUrl(edition);
  if (!title && !body && !imageUrl) return '';

  const bodyHtml = paragraphsHtml(body);

  if (resolvedLayout === 'editorial') {
    const titleHtml = title
      ? '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:24px;font-weight:600;color:' +
        NL.dark +
        ';margin:0 0 14px;line-height:1.25;">' +
        escapeHtml(title) +
        '</p>'
      : '';
    const inner =
      '<tr><td class="mobile-pad" style="padding:16px 44px 8px;text-align:left;">' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">Editorial</p>' +
      titleHtml +
      bodyHtml +
      '</td></tr>';
    return inner;
  }

  if (resolvedLayout === 'classic') {
    const thumb = imageUrl
      ? '<td class="article-thumb-cell" width="88" valign="top" style="padding-right:16px;">' +
        articleThumbHtml(imageUrl, { width: 88, height: 88, radius: 8 }) +
        '</td>'
      : '';
    const textCell =
      '<td valign="top">' +
      (title
        ? '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:600;color:' +
          NL.dark +
          ';margin:0 0 10px;line-height:1.35;">' +
          escapeHtml(title) +
          '</p>'
        : '') +
      bodyHtml +
      '</td>';
    return (
      '<tr><td class="mobile-pad" style="padding:16px 36px 4px;text-align:left;">' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:' +
      NL.accent +
      ';text-transform:uppercase;letter-spacing:1px;margin:0;">Editorial</p>' +
      '</td></tr>' +
      '<tr><td class="mobile-pad" style="padding:0 36px 16px;">' +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:' +
      NL.light +
      ';border-radius:10px;border:1px solid ' +
      NL.lightBorder +
      ';">' +
      '<tr><td style="padding:18px 20px;">' +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>' +
      thumb +
      textCell +
      '</tr></table></td></tr></table></td></tr>'
    );
  }

  const thumbBlock = imageUrl
    ? '<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="left" style="margin:0 16px 8px 0;"><tr><td>' +
      articleThumbHtml(imageUrl, { width: 96, height: 72, radius: 10 }) +
      '</td></tr></table>'
    : '';
  const inner = accentCard(
    thumbBlock +
      (title
        ? '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:17px;font-weight:600;color:#ffffff;margin:0 0 12px;line-height:1.35;">' +
          escapeHtml(title) +
          '</p>'
        : '') +
      bodyHtml.replace(/#635c5e/g, 'rgba(255,255,255,0.82)')
  );
  return sectionWrap('Editorial', '', inner);
}

function buildHubNewsSection(edition) {
  const body = String(edition.hubNews || edition.hub_news || '').trim();
  if (!body) return '';
  return sectionWrap('Hub news', 'What is new on the Hub', accentCard(paragraphsHtml(body).replace(/#635c5e/g, 'rgba(255,255,255,0.82)')));
}

function buildMemberSpotlightSection(edition) {
  const name = String(edition.memberSpotlightName || edition.member_spotlight_name || '').trim();
  const role = String(edition.memberSpotlightTitle || edition.member_spotlight_title || '').trim();
  const body = String(edition.memberSpotlightBody || edition.member_spotlight_body || '').trim();
  const imageUrl = String(edition.memberSpotlightImageUrl || edition.member_spotlight_image_url || '').trim();
  if (!name && !body) return '';

  const imageHtml = imageUrl
    ? '<img src="' +
      escapeHtml(imageUrl) +
      '" alt="" width="72" style="width:72px;height:72px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 12px;">'
    : '';

  const inner = accentCard(
    imageHtml +
      (name
        ? '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:17px;font-weight:600;color:#ffffff;margin:0 0 4px;line-height:1.35;text-align:center;">' +
          escapeHtml(name) +
          '</p>'
        : '') +
      (role
        ? '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;color:rgba(255,255,255,0.7);margin:0 0 12px;text-align:center;">' +
          escapeHtml(role) +
          '</p>'
        : '') +
      paragraphsHtml(body).replace(/#635c5e/g, 'rgba(255,255,255,0.82)')
  );
  return sectionWrap('Member spotlight', '', inner);
}

function buildFeaturedEventsSection(events, site, ticketsByEventId) {
  if (!events.length) return '';
  const ticketMap = ticketsByEventId instanceof Map ? ticketsByEventId : new Map();
  const cards = events
    .map(function (eventRow) {
      const tickets = ticketMap.get(String(eventRow.id)) || [];
      return eventListingCard(eventRow, site, tickets);
    })
    .join('');
  return sectionWrap('Featured events', 'Coming up on the Hub', '<tr><td class="mobile-pad" style="padding:0 40px 8px;">' + cards + '</td></tr>');
}

function buildNearbyEventsSection(events, site, ticketsByEventId, locationLabel) {
  if (!events.length) return '';
  const ticketMap = ticketsByEventId instanceof Map ? ticketsByEventId : new Map();
  const cards = events
    .map(function (eventRow) {
      const tickets = ticketMap.get(String(eventRow.id)) || [];
      return eventListingCard(eventRow, site, tickets);
    })
    .join('');
  const subtitle = locationLabel
    ? 'Based on your profile: ' + locationLabel
    : 'Upcoming events in your area';
  return sectionWrap('Events near you', subtitle, '<tr><td class="mobile-pad" style="padding:0 40px 8px;">' + cards + '</td></tr>');
}

function buildFeaturedOrganisersSection(organisers, site) {
  if (!organisers.length) return '';
  const cards = organisers
    .map(function (row) {
      const name = String(row.name || 'Organiser').trim();
      const badge = row.rankingLabel ? String(row.rankingLabel).trim() : '';
      const subtitle = row.reviewCount
        ? Number(row.average_rating || row.rating || 0).toFixed(1) +
          ' average · ' +
          row.reviewCount +
          ' reviews'
        : 'Discover their upcoming events';
      return listingCard(name, subtitle, organiserPublicUrl(row, site), badge);
    })
    .join('');
  return sectionWrap('Featured organisers', 'Groups members love', '<tr><td class="mobile-pad" style="padding:0 40px 8px;">' + cards + '</td></tr>');
}

function topRankedOrganiserRow(row, site, rank) {
  const name = String(row.name || 'Organiser').trim();
  const url = organiserPublicUrl(row, site);
  const rating = Number(row.rating || row.average_rating || 0);
  const reviews = Number(row.reviewCount || row.review_count || 0);
  const meta =
    reviews > 0
      ? '★ ' + rating.toFixed(1) + ' · ' + reviews + ' review' + (reviews === 1 ? '' : 's')
      : 'View profile';

  return (
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 8px;border:1px solid ' +
    NL.lightBorder +
    ';border-radius:10px;background:#ffffff;">' +
    '<tr><td style="padding:12px 14px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">' +
    '<tr>' +
    '<td width="40" valign="top" style="width:40px;padding-right:10px;">' +
    '<span style="display:inline-block;width:30px;height:30px;line-height:30px;text-align:center;border-radius:50%;background:' +
    NL.primary +
    ';color:#ffffff;font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;">' +
    String(rank) +
    '</span></td>' +
    '<td valign="top" style="padding-right:8px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:600;color:' +
    NL.dark +
    ';margin:0 0 4px;line-height:1.35;">' +
    '<a href="' +
    escapeHtml(url) +
    '" style="color:' +
    NL.dark +
    ';text-decoration:none;">' +
    escapeHtml(name) +
    '</a></p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;color:' +
    NL.textMuted +
    ';margin:0;line-height:1.4;">' +
    escapeHtml(meta) +
    '</p></td>' +
    '<td valign="middle" align="right" style="white-space:nowrap;">' +
    '<a href="' +
    escapeHtml(url) +
    '" style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:' +
    NL.primary +
    ';text-decoration:none;">View →</a>' +
    '</td></tr></table></td></tr></table>'
  );
}

function buildTopRankedOrganisersSection(organisers, site, periodLabel) {
  if (!organisers.length) return '';
  const period = String(periodLabel || currentPeriodLabel()).trim();
  const subtitle = period ? 'Top 10 networking groups · ' + period : 'Top 10 networking groups';
  const rows = organisers
    .map(function (row, index) {
      return topRankedOrganiserRow(row, site, row.rank || index + 1);
    })
    .join('');
  const browseUrl = siteBase(site) + '/events/#organisers';
  const footer =
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;margin:12px 0 0;text-align:center;">' +
    '<a href="' +
    escapeHtml(browseUrl) +
    '" style="color:' +
    NL.primary +
    ';font-weight:700;text-decoration:none;">Browse all networking groups →</a></p>';
  return sectionWrap(
    'Hub rankings',
    subtitle,
    '<tr><td class="mobile-pad" style="padding:0 40px 8px;background:' +
      NL.light +
      ';">' +
      rows +
      footer +
      '</td></tr>'
  );
}

async function fetchRankingOrganisers(sb, limit) {
  const max = Math.max(1, Number(limit) || 3);
  const rankingIndex = await computeLiveRankingIndex(sb);
  return [...rankingIndex.values()]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, max)
    .map(function (entry) {
      const row = entry.organiserRow || {};
      return {
        ...row,
        rank: entry.rank,
        totalRanked: entry.totalRanked,
        rankingLabel: entry.label,
        rankingTier: entry.tier,
        reviewCount: entry.reviewCount,
        rating: entry.rating,
      };
    });
}

function buildFeaturedOpportunitiesSection(opportunities, site) {
  if (!opportunities.length) return '';
  const cards = opportunities
    .map(function (row) {
      const title = String(row.title || 'Opportunity').trim();
      const host = String(row.host || '').trim();
      const subtitle = host ? 'Hosted by ' + host : 'Browse the business opportunities directory';
      return listingCard(title, subtitle, opportunityPublicUrl(row, site), row.featured ? 'Premium spotlight' : '');
    })
    .join('');
  return sectionWrap('Business opportunities', 'From the directory', '<tr><td class="mobile-pad" style="padding:0 40px 8px;">' + cards + '</td></tr>');
}

function mapEditionRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    editionLabel: row.edition_label || '',
    subject: row.subject || '',
    preheader: row.preheader || '',
    status: row.status || 'draft',
    scheduledAt: row.scheduled_at,
    sentAt: row.sent_at,
    articleTitle: row.article_title || '',
    articleBody: row.article_body || '',
    articleImageUrl: row.article_image_url || '',
    layout: normalizeNewsletterLayout(row.layout),
    hubNews: row.hub_news || '',
    memberSpotlightName: row.member_spotlight_name || '',
    memberSpotlightTitle: row.member_spotlight_title || '',
    memberSpotlightBody: row.member_spotlight_body || '',
    memberSpotlightImageUrl: row.member_spotlight_image_url || '',
    autoFeatured: row.auto_featured !== false,
    useEventsSponsor: row.use_events_sponsor !== false,
    featuredEventIds: Array.isArray(row.featured_event_ids) ? row.featured_event_ids : [],
    featuredOrganiserIds: Array.isArray(row.featured_organiser_ids) ? row.featured_organiser_ids : [],
    featuredOpportunityIds: Array.isArray(row.featured_opportunity_ids) ? row.featured_opportunity_ids : [],
    recipientCount: Number(row.recipient_count) || 0,
    sendCursor: Number(row.send_cursor) || 0,
    sentCount: Number(row.sent_count) || 0,
    failedCount: Number(row.failed_count) || 0,
    createdBy: row.created_by || '',
  };
}

function editionToDbPatch(edition) {
  const e = edition && typeof edition === 'object' ? edition : {};
  const autoFeatured = editionBoolean(e.autoFeatured ?? e.auto_featured, true);
  const useEventsSponsor = editionBoolean(e.useEventsSponsor ?? e.use_events_sponsor, true);

  return {
    edition_label: String(e.editionLabel ?? e.edition_label ?? '').trim(),
    subject: String(e.subject ?? '').trim(),
    preheader: String(e.preheader ?? '').trim(),
    article_title: String(e.articleTitle ?? e.article_title ?? '').trim(),
    article_body: String(e.articleBody ?? e.article_body ?? '').trim(),
    article_image_url: String(e.articleImageUrl ?? e.article_image_url ?? '').trim(),
    layout: normalizeNewsletterLayout(e.layout),
    hub_news: String(e.hubNews ?? e.hub_news ?? '').trim(),
    member_spotlight_name: String(e.memberSpotlightName ?? e.member_spotlight_name ?? '').trim(),
    member_spotlight_title: String(e.memberSpotlightTitle ?? e.member_spotlight_title ?? '').trim(),
    member_spotlight_body: String(e.memberSpotlightBody ?? e.member_spotlight_body ?? '').trim(),
    member_spotlight_image_url: String(e.memberSpotlightImageUrl ?? e.member_spotlight_image_url ?? '').trim(),
    auto_featured: autoFeatured,
    use_events_sponsor: useEventsSponsor,
    featured_event_ids: autoFeatured
      ? []
      : parseEditionUuidList(e.featuredEventIds ?? e.featured_event_ids),
    featured_organiser_ids: autoFeatured
      ? []
      : parseEditionUuidList(e.featuredOrganiserIds ?? e.featured_organiser_ids),
    featured_opportunity_ids: autoFeatured
      ? []
      : parseEditionUuidList(e.featuredOpportunityIds ?? e.featured_opportunity_ids),
    updated_at: new Date().toISOString(),
  };
}

async function fetchFeaturedEvents(sb, edition, limit) {
  const max = Math.max(1, Number(limit) || 4);
  const autoFeatured = edition.auto_featured !== false && edition.autoFeatured !== false;
  const ids = Array.isArray(edition.featured_event_ids)
    ? edition.featured_event_ids
    : edition.featuredEventIds || [];
  const filteredIds = ids.filter(Boolean);
  const now = new Date().toISOString();

  if (!autoFeatured && filteredIds.length) {
    const { data, error } = await sb
      .from('events')
      .select(
        'id, title, slug, starts_at, city, venue, location_label, status, approval_status, published_at, featured, ticket_sales_enabled, refund_terms_agreed_at, refund_terms_agreed, organisers(name)'
      )
      .in('id', filteredIds);
    if (error) throw new Error(error.message);
    return (data || []).filter(isEventPublishedForSale).slice(0, max);
  }

  const { data, error } = await sb
    .from('events')
    .select(
      'id, title, slug, starts_at, city, venue, location_label, status, approval_status, published_at, featured, ticket_sales_enabled, refund_terms_agreed_at, refund_terms_agreed, organisers(name)'
    )
    .eq('status', 'published')
    .eq('approval_status', 'Approved')
    .gt('starts_at', now)
    .order('featured', { ascending: false, nullsFirst: false })
    .order('starts_at', { ascending: true })
    .limit(max * 2);
  if (error) throw new Error(error.message);
  return (data || []).filter(isEventPublishedForSale).slice(0, max);
}

async function fetchFeaturedOrganisers(sb, edition, limit) {
  const max = Math.max(1, Number(limit) || 3);
  const autoFeatured = edition.auto_featured !== false && edition.autoFeatured !== false;
  const ids = Array.isArray(edition.featured_organiser_ids)
    ? edition.featured_organiser_ids
    : edition.featuredOrganiserIds || [];
  const filteredIds = ids.filter(Boolean);

  if (!autoFeatured && filteredIds.length) {
    const { data, error } = await sb
      .from('organisers')
      .select('id, name, slug, average_rating, review_count')
      .in('id', filteredIds);
    if (error) throw new Error(error.message);
    return (data || []).slice(0, max);
  }

  const rankingIndex = await fetchRankingOrganisers(sb, max);
  return rankingIndex;
}

async function fetchFeaturedOpportunities(sb, edition, limit) {
  const max = Math.max(1, Number(limit) || 3);
  const autoFeatured = edition.auto_featured !== false && edition.autoFeatured !== false;
  const ids = Array.isArray(edition.featured_opportunity_ids)
    ? edition.featured_opportunity_ids
    : edition.featuredOpportunityIds || [];
  const filteredIds = ids.filter(Boolean);

  if (!autoFeatured && filteredIds.length) {
    const { data, error } = await sb
      .from('business_opportunities')
      .select('id, title, host, featured, status, approval_status, listing_expires_at')
      .in('id', filteredIds);
    if (error) throw new Error(error.message);
    return (data || []).filter(listingPaymentCurrent).slice(0, max);
  }

  const { data, error } = await sb
    .from('business_opportunities')
    .select('id, title, host, featured, status, approval_status, listing_expires_at, published_at')
    .eq('status', 'published')
    .eq('approval_status', 'Approved')
    .order('featured', { ascending: false, nullsFirst: false })
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(max * 2);
  if (error) throw new Error(error.message);
  return (data || []).filter(listingPaymentCurrent).slice(0, max);
}

async function buildNewsletterVariables(sb, edition, recipient) {
  const siteUrl = siteBase();
  const site = siteUrl;
  const name = String(recipient?.name || '').trim() || 'there';
  const editionLabel = String(edition.edition_label || edition.editionLabel || 'The Networker Hub').trim();
  const subject = String(edition.subject || editionLabel).trim();
  const layout = normalizeNewsletterLayout(edition.layout);
  const useEventsSponsor =
    edition.use_events_sponsor !== false && edition.useEventsSponsor !== false;

  const autoFeatured = edition.auto_featured !== false && edition.autoFeatured !== false;
  const showMagazineRankings = layout === 'magazine' && autoFeatured;

  const [events, organisers, opportunities, topRankedOrganisers] = await Promise.all([
    fetchFeaturedEvents(sb, edition),
    showMagazineRankings ? Promise.resolve([]) : fetchFeaturedOrganisers(sb, edition),
    fetchFeaturedOpportunities(sb, edition),
    showMagazineRankings ? fetchRankingOrganisers(sb, 10) : Promise.resolve([]),
  ]);
  const ticketsByEventId = await fetchTicketsByEventId(
    sb,
    events.map((row) => row.id)
  );

  const recipientLocation = String(recipient?.location || '').trim();
  const nearby = await fetchNearbyEvents(sb, recipientLocation, {
    excludeEventIds: events.map((row) => row.id),
    limit: 4,
  });
  const nearbyTicketsByEventId = await fetchTicketsByEventId(
    sb,
    nearby.events.map((row) => row.id)
  );

  const intro =
    'Hi ' +
    escapeHtml(name) +
    ', welcome to <strong style="color:' +
    NL.dark +
    ';">' +
    escapeHtml(editionLabel) +
    '</strong> — your roundup of networking on The Networker Hub.';

  const vars = {
    user_name: name,
    edition_label: editionLabel,
    newsletter_subject: subject,
    newsletter_layout: layout,
    preheader: String(edition.preheader || '').trim() || subject,
    intro_html: intro,
    article_hero_image_html: articleHeroImageHtml(edition, layout),
    article_section_html: buildArticleSection(edition, layout),
    hub_news_section_html: buildHubNewsSection(edition),
    featured_events_section_html: buildFeaturedEventsSection(events, site, ticketsByEventId),
    nearby_events_section_html: buildNearbyEventsSection(
      nearby.events,
      site,
      nearbyTicketsByEventId,
      nearby.locationLabel
    ),
    top_ranked_organisers_section_html: showMagazineRankings
      ? buildTopRankedOrganisersSection(topRankedOrganisers, site)
      : '',
    featured_organisers_section_html: buildFeaturedOrganisersSection(organisers, site),
    featured_opportunities_section_html: buildFeaturedOpportunitiesSection(opportunities, site),
    member_spotlight_section_html: buildMemberSpotlightSection(edition),
    browse_events_url: browseEventsUrl(site),
    opportunities_url: site + '/opportunities/',
    unsubscribe_url: site + '/account/settings.html',
    site_url: site,
    logo_url: logoNavUrl(site),
    logo_footer_url: logoFooterUrl(site),
    privacy_url: legalPolicyUrl(site, 'privacy'),
    terms_url: legalPolicyUrl(site, 'terms'),
    contact_url: contactUrl(site),
    hub_account_url: hubAccountUrl(site),
  };

  if (!useEventsSponsor) {
    vars.sponsor_row = '';
    vars.sponsor_section = '';
    vars.mini_sponsors_row = '';
  }

  return vars;
}

module.exports = {
  NEWSLETTER_SLUG,
  mapEditionRow,
  editionToDbPatch,
  buildNewsletterVariables,
  parseEditionUuidList,
};
