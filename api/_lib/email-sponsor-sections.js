/**
 * CMS sponsor rows for transactional emails — main hero banner + mini sponsors footer.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const {
  buildSponsorSection,
  fetchSponsorBlockForSlot,
  EVENTS_SPONSOR_SLOT,
} = require('./email-booking-defaults');
const { isEmailSponsorBlock } = require('./cms-sponsor-fields');
const { toPublicAssetUrl } = require('./hub-email-urls');
const {
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
  'organiser_ranking_badge',
  'organiser_low_upcoming_events',
  'organiser_ticket_sales_nudge',
  'organiser_featured_expiry_reminder',
  'organiser_claim_invite',
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
  'guest_visit_followup',
  'category_exclusivity_payment_reminder',
  'alumni_fast_pass_invite',
  'attendee_reengagement',
  'attendee_signup_events_nudge',
  'attendee_signup_events_nudge_followup',
  'attendee_hubert_event_concierge',
  'booking_cancelled',
  'event_cancelled',
  'refund_processed',
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
  'guest_visit_followup',
  'category_exclusivity_payment_reminder',
  'alumni_fast_pass_invite',
  'attendee_reengagement',
  'attendee_signup_events_nudge',
  'attendee_signup_events_nudge_followup',
  'attendee_hubert_event_concierge',
  'booking_cancelled',
  'event_cancelled',
  'refund_processed',
]);

/** General Hub account emails show all three directory partners in one compact row. */
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
  const label = String(options.label || 'Our mini sponsors');

  const cells = list
    .map(function (ad) {
      const logo = toPublicAssetUrl(ad.logo_url || '', process.env.SITE_URL).replace(/"/g, '&quot;');
      const url = String(ad.cta_url || '').replace(/"/g, '&quot;');
      const name = String(ad.company_name || 'Sponsor').replace(/"/g, '&quot;');
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
    cells +
    '</tr></table></td></tr></table></td></tr>'
  );
}

async function resolveEventsMainSponsorBlock(sb) {
  const eventsBlock = await fetchSponsorBlockForSlot(sb, EVENTS_SPONSOR_SLOT);
  if (eventsBlock && eventsBlock.include_in_emails !== false && isEmailSponsorBlock(eventsBlock)) {
    return eventsBlock;
  }
  if (eventsBlock) return null;

  const bookingBlock = await fetchSponsorBlockForSlot(sb, 'booking_email_sponsor');
  if (bookingBlock && isEmailSponsorBlock(bookingBlock)) return bookingBlock;

  const legacy = await fetchSponsorBlockForSlot(sb, 'sponsor_hub');
  if (legacy && isEmailSponsorBlock(legacy)) return legacy;

  return null;
}

async function resolveOpportunitySponsorBlock(sb) {
  const primary = await fetchSponsorBlockForSlot(sb, OPPORTUNITIES_SPONSOR_SLOT);
  if (primary) {
    if (primary.include_in_emails !== false && isEmailSponsorBlock(primary)) return primary;
    return null;
  }
  const legacy = await fetchSponsorBlockForSlot(sb, OPPORTUNITY_SIDEBAR_SLOT);
  if (legacy && legacy.include_in_emails !== false && isEmailSponsorBlock(legacy)) return legacy;
  return null;
}

async function resolveOrganiserSponsorBlock(sb) {
  const block = await fetchSponsorBlockForSlot(sb, 'organisers_sponsor_hub');
  if (block && block.include_in_emails !== false && isEmailSponsorBlock(block)) return block;
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
  const ads = publishableCarouselAds(parseCarouselBody(row.body));
  return ads.slice(0, max);
}

async function fetchEventMiniSponsorAds(sb, limit) {
  // Only the dedicated email mini slot — do not reuse page-carousel placeholders.
  return fetchMiniSponsorAds(sb, EVENT_EMAIL_MINI_SPONSORS_SLOT, limit);
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
    let label = 'Our event directory is proudly powered by';

    if (OPPORTUNITY_EMAIL_SLUGS.has(slug)) {
      mainBlock = await resolveOpportunitySponsorBlock(sb);
      label = 'Our business opportunities directory is proudly powered by';
    } else if (ORGANISER_EMAIL_SLUGS.has(slug)) {
      mainBlock = await resolveOrganiserSponsorBlock(sb);
      label = 'Our organiser directory is proudly powered by';
    } else if (EVENT_MAIN_SPONSOR_SLUGS.has(slug)) {
      mainBlock = await resolveEventsMainSponsorBlock(sb);
    }

    const sponsorRow = mainBlock
      ? wrapSponsorRow(buildSponsorSection(mainBlock, { label }))
      : '';

    let miniRow = '';
    if (HUB_PARTNER_SPONSOR_SLUGS.has(slug)) {
      const partnerBlocks = await resolveHubPartnerBlocks(sb);
      miniRow = buildMiniSponsorsRow(partnerBlocks, { label: 'Our Hub partners' });
    } else if (EVENT_MINI_SPONSOR_SLUGS.has(slug)) {
      const ads = await fetchEventMiniSponsorAds(sb, 3);
      miniRow = buildMiniSponsorsRow(ads);
    } else if (ORGANISER_MINI_SPONSOR_SLUGS.has(slug)) {
      const ads = await fetchMiniSponsorAds(sb, ORGANISER_EMAIL_MINI_SPONSORS_SLOT, 3);
      miniRow = buildMiniSponsorsRow(ads);
    } else if (OPPORTUNITY_MINI_SPONSOR_SLUGS.has(slug)) {
      const ads = await fetchMiniSponsorAds(sb, OPPORTUNITY_EMAIL_MINI_SPONSORS_SLOT, 3);
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

function insertSponsorPlaceholderBeforeFooter(html, placeholder) {
  const body = String(html || '');
  const token = String(placeholder || '').trim();
  if (!token || body.includes(token)) return body;
  const footerRow = /(<tr[^>]*>\s*<td[^>]*background\s*:\s*#1c2040)/i;
  if (footerRow.test(body)) return body.replace(footerRow, token + '\n$1');
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
  insertSponsorPlaceholderBeforeFooter,
  stripUnresolvedSponsorPlaceholders,
};
