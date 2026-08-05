/**
 * CMS sponsor rows for transactional emails — main hero banner + mini sponsors footer.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const {
  buildSponsorSection,
  fetchSponsorBlockForSlot,
  EVENTS_SPONSOR_SLOT,
  isEmailSafeLogoUrl,
} = require('./email-booking-defaults');
const { isEmailSponsorBlock, hasSponsorLogo, sponsorLogoUrl } = require('./cms-sponsor-fields');
const { toPublicAssetUrl } = require('./hub-email-urls');
const {
  EVENT_PAGE_CAROUSEL_SLOT,
  ORGANISER_PAGE_CAROUSEL_SLOT,
  OPPORTUNITY_PAGE_CAROUSEL_SLOT,
  EVENT_EMAIL_MINI_SPONSORS_SLOT,
  ORGANISER_EMAIL_MINI_SPONSORS_SLOT,
  OPPORTUNITY_EMAIL_MINI_SPONSORS_SLOT,
  parseCarouselBody,
  publishableCarouselAds,
} = require('./event-page-carousel');

const OPPORTUNITIES_SPONSOR_SLOT = 'opportunities_sponsor_hub';
const OPPORTUNITY_SIDEBAR_SLOT = 'opportunity_page_sidebar_ad';

/** Every business-opportunity email uses the Business Ops sponsor. */
const OPPORTUNITY_EMAIL_SLUGS = new Set([
  'opportunity_listing_live',
  'opportunity_listing_expiry_reminder',
  'opportunity_premium_expiry_reminder',
  'opportunity_premium_live',
  'opportunity_enquiry_received',
  'opportunity_enquiry_sent',
  'opportunity_listing_expired',
  'opportunity_premium_expired',
  'opportunity_listing_rejected',
  'saved_opportunity_closing_soon',
  'opportunity_saved_search_match',
]);

/** Every organiser-facing email uses the organiser-directory sponsor. */
const ORGANISER_EMAIL_SLUGS = new Set([
  'organiser_new_registration',
  'organiser_new_application',
  'organiser_booking_cancelled',
  'event_removed_by_hub',
  'event_unpublished_by_hub',
  'organiser_listing_unpublished_by_hub',
  'organiser_hub_warning',
  'organiser_hub_suspended',
  'organiser_ranking_badge',
  'organiser_low_upcoming_events',
  'organiser_ticket_sales_nudge',
  'organiser_featured_expiry_reminder',
  'organiser_claim_invite',
  'organiser_launch_invite',
  'organiser_team_invite',
  'organiser_email_verify',
  'stripe_connect_nudge',
  'payout_requested',
  'payout_approved',
  'payout_paid',
  'event_almost_full',
]);

/** Attendee-facing event and ticket emails use the event-directory sponsor. */
const EVENT_MAIN_SPONSOR_SLUGS = new Set([
  'booking_confirmation',
  'booking_reminder',
  'online_join_reminder',
  'saved_event_tickets_open',
  'saved_organiser_new_listing',
  'application_received',
  'application_approved',
  'application_denied',
  'meeting_link_added',
  'event_details_updated',
  'post_event_review_request',
  'post_event_review_reminder',
  'event_saved_search_match',
  'guest_visit_followup',
  'category_exclusivity_payment_reminder',
  'alumni_fast_pass_invite',
  'ce_member_invite',
  'event_connections_list',
  'attendee_reengagement',
  'attendee_signup_events_nudge',
  'attendee_hubert_event_concierge',
  'booking_cancelled',
  'event_cancelled',
  'refund_processed',
  'account_welcome',
  'password_reset',
]);

/** Selected organiser growth emails also show the organiser mini-sponsor trio. */
const ORGANISER_MINI_SPONSOR_SLUGS = new Set([
  'organiser_new_registration',
  'organiser_new_application',
  'organiser_featured_expiry_reminder',
  'organiser_ranking_badge',
  'organiser_low_upcoming_events',
]);

const OPPORTUNITY_MINI_SPONSOR_SLUGS = new Set([
  'opportunity_listing_live',
  'opportunity_listing_expiry_reminder',
  'opportunity_premium_expiry_reminder',
  'opportunity_premium_live',
  'saved_opportunity_closing_soon',
  'opportunity_saved_search_match',
]);

/** Attendee event emails also show the event mini-sponsor trio above the footer. */
const EVENT_MINI_SPONSOR_SLUGS = new Set([
  'booking_confirmation',
  'booking_reminder',
  'online_join_reminder',
  'saved_event_tickets_open',
  'saved_organiser_new_listing',
  'application_received',
  'application_approved',
  'application_denied',
  'meeting_link_added',
  'event_details_updated',
  'post_event_review_request',
  'post_event_review_reminder',
  'event_saved_search_match',
  'guest_visit_followup',
  'category_exclusivity_payment_reminder',
  'alumni_fast_pass_invite',
  'ce_member_invite',
  'event_connections_list',
  'attendee_reengagement',
  'attendee_signup_events_nudge',
  'attendee_hubert_event_concierge',
  'booking_cancelled',
  'event_cancelled',
  'refund_processed',
]);

/** Welcome / password reset: Events main under header; all three directory partners in footer. */
const HUB_PARTNER_SPONSOR_SLUGS = new Set(['account_welcome', 'password_reset']);

const SPONSOR_PLACEHOLDER_KEYS = ['sponsor_row', 'sponsor_section', 'mini_sponsors_row'];

function wrapSponsorRow(inner) {
  const html = String(inner || '').trim();
  if (!html) return '';
  if (/^<tr[\s>]/i.test(html)) return html;
  return '<tr><td>' + html + '</td></tr>';
}

function buildMiniSponsorsRow(ads, options = {}) {
  const list = (ads || []).filter(Boolean).slice(0, 3);
  if (!list.length) return '';
  const label = String(options.label || 'Powered by');

  const cells = list
    .map(function (ad) {
      const rawLogo = String(ad.logo_url || ad.image_url || '').trim();
      if (!rawLogo || /\.svg(?:[?#]|$)/i.test(rawLogo) || /^data:image\/svg/i.test(rawLogo)) {
        return '';
      }
      const logo = toPublicAssetUrl(rawLogo, process.env.SITE_URL).replace(/"/g, '&quot;');
      const url = String(ad.cta_url || '').replace(/"/g, '&quot;');
      const name = String(ad.company_name || ad.title || 'Sponsor').replace(/"/g, '&quot;');
      if (!logo || !url) return '';
      return (
        '<td class="mini-sponsor-cell" style="width:33.33%;padding:6px 8px;text-align:center;vertical-align:middle;">' +
        '<a href="' +
        url +
        '" style="text-decoration:none;display:inline-block;">' +
        '<img src="' +
        logo +
        '" alt="' +
        name +
        '" width="80" style="max-width:80px;width:100%;height:auto;display:block;margin:0 auto;opacity:0.92;">' +
        '</a></td>'
      );
    })
    .filter(Boolean)
    .join('');

  if (!cells) return '';

  const cellCount = (cells.match(/mini-sponsor-cell/g) || []).length;
  const widthPct = cellCount === 1 ? '100%' : cellCount === 2 ? '50%' : '33.33%';
  const sizedCells = cells.replace(/width:33\.33%;/g, 'width:' + widthPct + ';');

  return (
    '<tr><td class="mobile-pad" style="padding:8px 40px 24px;text-align:center;background:#ffffff;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:14px;border:1px solid #e6e0e2;">' +
    '<tr><td style="padding:14px 16px 10px;text-align:center;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:600;color:#7a7274;text-transform:uppercase;letter-spacing:1px;margin:0;">' +
    label +
    '</p>' +
    '</td></tr>' +
    '<tr><td style="padding:0 12px 16px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>' +
    sizedCells +
    '</tr></table></td></tr></table></td></tr>'
  );
}

function isRenderableEmailSponsor(block) {
  if (!isEmailSponsorBlock(block)) return false;
  if (!hasSponsorLogo(block)) return false;
  return isEmailSafeLogoUrl(sponsorLogoUrl(block));
}

async function resolveEventsMainSponsorBlock(sb) {
  const eventsBlock = await fetchSponsorBlockForSlot(sb, EVENTS_SPONSOR_SLOT);
  if (eventsBlock && eventsBlock.include_in_emails !== false && isRenderableEmailSponsor(eventsBlock)) {
    return eventsBlock;
  }

  // Events slot missing, incomplete, or opted out of emails — use the dedicated email creative.
  const bookingBlock = await fetchSponsorBlockForSlot(sb, 'booking_email_sponsor');
  if (isRenderableEmailSponsor(bookingBlock)) return bookingBlock;

  const legacy = await fetchSponsorBlockForSlot(sb, 'sponsor_hub');
  if (isRenderableEmailSponsor(legacy)) return legacy;

  return null;
}

async function resolveOpportunitySponsorBlock(sb) {
  const primary = await fetchSponsorBlockForSlot(sb, OPPORTUNITIES_SPONSOR_SLOT);
  if (primary) {
    if (primary.include_in_emails !== false && isRenderableEmailSponsor(primary)) return primary;
  } else {
    const legacy = await fetchSponsorBlockForSlot(sb, OPPORTUNITY_SIDEBAR_SLOT);
    if (legacy && legacy.include_in_emails !== false && isRenderableEmailSponsor(legacy)) return legacy;
  }
  return null;
}

async function resolveOrganiserSponsorBlock(sb) {
  const block = await fetchSponsorBlockForSlot(sb, 'organisers_sponsor_hub');
  if (block && block.include_in_emails !== false && isRenderableEmailSponsor(block)) return block;
  return null;
}

async function resolveHubPartnerBlocks(sb) {
  const blocks = await Promise.all([
    resolveEventsMainSponsorBlock(sb),
    resolveOrganiserSponsorBlock(sb),
    resolveOpportunitySponsorBlock(sb),
  ]);
  return blocks.filter(Boolean);
}

async function fetchMiniSponsorAds(sb, slot, limit) {
  const max = Math.max(1, Number(limit) || 3);
  const row = await fetchSponsorBlockForSlot(sb, slot);
  if (!row || row.active === false) return [];
  const ads = publishableCarouselAds(parseCarouselBody(row.body), slot);
  return ads.slice(0, max);
}

/**
 * Prefer the dedicated email mini inventory; if empty/inactive, reuse the matching
 * detail-page mini sponsors so Command Centre only needs one set of logos.
 */
async function fetchMiniSponsorAdsWithPageFallback(sb, emailSlot, pageSlot, limit) {
  const fromEmail = await fetchMiniSponsorAds(sb, emailSlot, limit);
  if (fromEmail.length) return fromEmail;
  return fetchMiniSponsorAds(sb, pageSlot, limit);
}

async function fetchEventMiniSponsorAds(sb, limit) {
  return fetchMiniSponsorAdsWithPageFallback(
    sb,
    EVENT_EMAIL_MINI_SPONSORS_SLOT,
    EVENT_PAGE_CAROUSEL_SLOT,
    limit
  );
}

async function getEmailSponsorVars(slug) {
  const empty = { sponsor_row: '', sponsor_section: '', mini_sponsors_row: '' };
  if (
    !slug ||
    (!EVENT_MAIN_SPONSOR_SLUGS.has(slug) &&
      !EVENT_MINI_SPONSOR_SLUGS.has(slug) &&
      !OPPORTUNITY_EMAIL_SLUGS.has(slug) &&
      !ORGANISER_EMAIL_SLUGS.has(slug) &&
      !HUB_PARTNER_SPONSOR_SLUGS.has(slug))
  ) {
    return empty;
  }
  if (!isSupabaseConfigured()) return empty;

  try {
    const sb = getSupabaseAdmin();
    let mainBlock = null;
    const label = 'Powered by';

    if (OPPORTUNITY_EMAIL_SLUGS.has(slug)) {
      mainBlock = await resolveOpportunitySponsorBlock(sb);
    } else if (ORGANISER_EMAIL_SLUGS.has(slug)) {
      mainBlock = await resolveOrganiserSponsorBlock(sb);
    } else if (EVENT_MAIN_SPONSOR_SLUGS.has(slug)) {
      mainBlock = await resolveEventsMainSponsorBlock(sb);
    }

    const sponsorRow = mainBlock
      ? wrapSponsorRow(buildSponsorSection(mainBlock, { label }))
      : '';

    let miniRow = '';
    if (HUB_PARTNER_SPONSOR_SLUGS.has(slug)) {
      const partnerBlocks = await resolveHubPartnerBlocks(sb);
      miniRow = buildMiniSponsorsRow(partnerBlocks, { label: 'Powered by' });
    } else if (EVENT_MINI_SPONSOR_SLUGS.has(slug)) {
      const ads = await fetchEventMiniSponsorAds(sb, 3);
      miniRow = buildMiniSponsorsRow(ads);
    } else if (ORGANISER_MINI_SPONSOR_SLUGS.has(slug)) {
      const ads = await fetchMiniSponsorAdsWithPageFallback(
        sb,
        ORGANISER_EMAIL_MINI_SPONSORS_SLOT,
        ORGANISER_PAGE_CAROUSEL_SLOT,
        3
      );
      miniRow = buildMiniSponsorsRow(ads);
    } else if (OPPORTUNITY_MINI_SPONSOR_SLUGS.has(slug)) {
      const ads = await fetchMiniSponsorAdsWithPageFallback(
        sb,
        OPPORTUNITY_EMAIL_MINI_SPONSORS_SLOT,
        OPPORTUNITY_PAGE_CAROUSEL_SLOT,
        3
      );
      miniRow = buildMiniSponsorsRow(ads);
    }

    return {
      sponsor_row: sponsorRow,
      sponsor_section: sponsorRow,
      mini_sponsors_row: miniRow,
    };
  } catch {
    return empty;
  }
}

function stripUnresolvedSponsorPlaceholders(html) {
  let out = String(html || '');
  for (const key of SPONSOR_PLACEHOLDER_KEYS) {
    out = out.replace(new RegExp('\\{\\{\\s*' + key + '\\s*\\}\\}', 'g'), '');
  }
  return out;
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripSponsorPlaceholder(html, placeholder) {
  const token = String(placeholder || '').trim();
  if (!token) return String(html || '');
  return String(html || '').replace(new RegExp('\\s*' + escapeRegExp(token) + '\\s*', 'g'), '\n');
}

function insertSponsorPlaceholderAfterHeader(html, placeholder) {
  const token = String(placeholder || '').trim();
  if (!token) return String(html || '');

  // Always re-place so misplaced footer/mid-body slots move under the logo hero.
  let body = stripSponsorPlaceholder(html, token);

  // Combined logo+wave cell (legacy cancellation layouts): insert between </a> and wave div.
  const combinedHeader = body.search(
    /alt="The Networker Hub"[^>]*>[\s\S]*?<\/a>\s*<div[^>]*>\s*<svg[\s\S]*?viewBox="0 0 600 40"/i
  );
  if (combinedHeader !== -1) {
    const anchorEnd = body.indexOf('</a>', combinedHeader);
    if (anchorEnd !== -1) {
      return (
        body.slice(0, anchorEnd + 4) +
        '\n            <!-- sponsor injected -->\n            </td></tr>\n        ' +
        token +
        '\n        <tr><td style="background:#f5f0e8;padding:0;text-align:center;">' +
        body.slice(anchorEnd + 4)
      );
    }
  }

  // Prefer: cream logo-hero band, immediately after the Hub logo row and before the wave.
  const logoMatch = body.search(
    /alt="The Networker Hub"[^>]*class="email-logo-header"|alt="The Networker Hub" width="2[0-9]{2}"|class="email-logo-header"/i
  );
  if (logoMatch !== -1) {
    const logoRowEnd = body.indexOf('</tr>', logoMatch);
    if (logoRowEnd !== -1) {
      const afterLogo = body.slice(logoRowEnd + 5);
      const waveRelative = afterLogo.search(/<tr[\s>][\s\S]*?<svg[\s\S]*?viewBox="0 0 600 40"/i);
      if (waveRelative !== -1) {
        const insertAt = logoRowEnd + 5;
        return body.slice(0, insertAt) + '\n\n        ' + token + '\n' + body.slice(insertAt);
      }
      return body.slice(0, logoRowEnd + 5) + '\n\n        ' + token + '\n' + body.slice(logoRowEnd + 5);
    }
  }

  // Follow-up / non-wave headers: first Hub logo row.
  const anyLogo = body.search(/alt="The Networker Hub"/i);
  if (anyLogo !== -1) {
    const rowEnd = body.indexOf('</tr>', anyLogo);
    if (rowEnd !== -1) {
      return body.slice(0, rowEnd + 5) + '\n\n        ' + token + '\n' + body.slice(rowEnd + 5);
    }
  }

  return insertSponsorPlaceholderBeforeFooter(body, token);
}

function ensureSponsorPlaceholderAfterHeader(html, placeholder) {
  return insertSponsorPlaceholderAfterHeader(html, placeholder);
}

function insertSponsorPlaceholderBeforeFooter(html, placeholder) {
  const body = String(html || '');
  const token = String(placeholder || '').trim();
  if (!token || body.includes(token)) return body;
  const footerRow = /(<tr[^>]*>\s*<td[^>]*background\s*:\s*#1c2040)/i;
  if (footerRow.test(body)) return body.replace(footerRow, token + '\n$1');
  const creamFooter = /(<tr[^>]*>\s*<td[^>]*class="mobile-footer-pad")/i;
  if (creamFooter.test(body)) return body.replace(creamFooter, token + '\n$1');
  const closingTable = body.lastIndexOf('</table>');
  if (closingTable === -1) return body + token;
  return body.slice(0, closingTable) + token + '\n' + body.slice(closingTable);
}

module.exports = {
  OPPORTUNITY_EMAIL_SLUGS,
  ORGANISER_EMAIL_SLUGS,
  EVENT_MAIN_SPONSOR_SLUGS,
  EVENT_MINI_SPONSOR_SLUGS,
  ORGANISER_MINI_SPONSOR_SLUGS,
  OPPORTUNITY_MINI_SPONSOR_SLUGS,
  HUB_PARTNER_SPONSOR_SLUGS,
  SPONSOR_PLACEHOLDER_KEYS,
  buildMiniSponsorsRow,
  getEmailSponsorVars,
  insertSponsorPlaceholderAfterHeader,
  ensureSponsorPlaceholderAfterHeader,
  insertSponsorPlaceholderBeforeFooter,
  stripUnresolvedSponsorPlaceholders,
};
