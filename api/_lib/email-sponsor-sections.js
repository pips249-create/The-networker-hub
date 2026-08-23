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
const { hasSponsorLogo, sponsorLogoUrl, sponsorCompanyName } = require('./cms-sponsor-fields');
const { toPublicAssetUrl } = require('./hub-email-urls');
const { withSponsorUtm } = require('./sponsor-utm');
const {
  EVENT_PAGE_CAROUSEL_SLOT,
  ORGANISER_PAGE_CAROUSEL_SLOT,
  OPPORTUNITY_PAGE_CAROUSEL_SLOT,
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
  'organiser_monthly_group_update',
  'event_removed_by_hub',
  'event_unpublished_by_hub',
  'organiser_listing_unpublished_by_hub',
  'organiser_listing_updated_by_hub',
  'organiser_hub_warning',
  'organiser_hub_suspended',
  'organiser_ranking_badge',
  'organiser_low_upcoming_events',
  'organiser_post_event_checklist',
  'organiser_ticket_sales_nudge',
  'organiser_featured_expiry_reminder',
  'organiser_claim_invite',
  'organiser_claim_confirmed',
  'organiser_launch_invite',
  'organiser_team_invite',
  'organiser_email_verify',
  'member_roster_payment_failed_organiser',
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
  'attendee_signup_events_nudge_followup',
  'attendee_hubert_event_concierge',
  'booking_cancelled',
  'event_cancelled',
  'refund_processed',
  'member_roster_invite',
  'member_roster_existing',
  'member_roster_pay_invite',
  'member_roster_payment_failed',
  'member_roster_renewal_receipt',
  'member_roster_new_event',
  'member_roster_booking_reminder',
]);

/** Selected organiser growth emails also show the organiser mini-sponsor trio. */
const ORGANISER_MINI_SPONSOR_SLUGS = new Set([
  'organiser_new_registration',
  'organiser_new_application',
  'organiser_featured_expiry_reminder',
  'organiser_ranking_badge',
  'organiser_claim_confirmed',
  'organiser_low_upcoming_events',
  'organiser_post_event_checklist',
  'organiser_monthly_group_update',
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
  'attendee_signup_events_nudge_followup',
  'booking_cancelled',
  'event_cancelled',
  'refund_processed',
  'member_roster_invite',
  'member_roster_existing',
  'member_roster_pay_invite',
  'member_roster_payment_failed',
  'member_roster_renewal_receipt',
  'member_roster_new_event',
  'member_roster_booking_reminder',
]);

/** Hub partner footer strip (Events + Organisers + Opportunities mains).
 * Account welcome / password reset are footer-only; Hubert concierge also keeps Events main under the header. */
const HUB_PARTNER_SPONSOR_SLUGS = new Set([
  'account_welcome',
  'password_reset',
  'attendee_hubert_event_concierge',
]);

const SPONSOR_PLACEHOLDER_KEYS = ['sponsor_row', 'sponsor_section', 'mini_sponsors_row'];

function wrapSponsorRow(inner) {
  const html = String(inner || '').trim();
  if (!html) return '';
  if (/^<tr[\s>]/i.test(html)) return html;
  return '<tr><td>' + html + '</td></tr>';
}

function siteBaseForSponsors() {
  return String(process.env.SITE_URL || 'https://www.thenetworkeruk.com').replace(/\/$/, '');
}

/** Normalize a CMS main-sponsor block (or carousel ad) for the footer logo strip. */
function toMiniSponsorAd(block) {
  if (!block) return null;
  const rawLogo = sponsorLogoUrl(block) || String(block.logo_url || block.image_url || '').trim();
  if (!rawLogo || !isEmailSafeLogoUrl(rawLogo)) return null;
  const site = siteBaseForSponsors();
  return {
    logo_url: rawLogo,
    cta_url: String(block.cta_url || '').trim() || site + '/advertising',
    company_name:
      sponsorCompanyName(block) ||
      String(block.company_name || block.title || '').trim() ||
      'Sponsor',
    logo_band_dark: block.logo_band_dark === true || block.logoBandDark === true,
  };
}

function buildMiniSponsorsRow(ads, options = {}) {
  const list = (ads || []).map(toMiniSponsorAd).filter(Boolean).slice(0, 3);
  if (!list.length) return { html: '', tracked: [] };
  const label = String(options.label || 'Powered by');
  const placement = String(options.placement || 'email_mini_sponsor').trim() || 'email_mini_sponsor';
  const campaign = String(options.campaign || placement).trim() || placement;
  const tracked = [];
  const darkPad = '#1a1a2e';

  const cells = list
    .map(function (ad) {
      const rawLogo = String(ad.logo_url || '').trim();
      if (!rawLogo || /\.svg(?:[?#]|$)/i.test(rawLogo) || /^data:image\/svg/i.test(rawLogo)) {
        return '';
      }
      const logo = toPublicAssetUrl(rawLogo, process.env.SITE_URL).replace(/"/g, '&quot;');
      const rawUrl = String(ad.cta_url || '').trim() || siteBaseForSponsors() + '/advertising';
      const url = withSponsorUtm(rawUrl, placement, { campaign }).replace(/"/g, '&quot;');
      const name = String(ad.company_name || 'Sponsor').replace(/"/g, '&quot;');
      if (!logo || !url) return '';
      tracked.push({
        placement,
        company: String(ad.company_name || '').trim(),
      });
      const imgHtml =
        '<img src="' +
        logo +
        '" alt="' +
        name +
        '" width="80" style="max-width:80px;width:100%;height:auto;display:block;margin:0 auto;opacity:0.92;border:0;">';
      const logoHtml = ad.logo_band_dark
        ? '<span style="display:inline-block;padding:8px 12px;background:' +
          darkPad +
          ';border-radius:6px;line-height:0;">' +
          imgHtml +
          '</span>'
        : imgHtml;
      return (
        '<td class="mini-sponsor-cell" style="width:33.33%;padding:6px 8px;text-align:center;vertical-align:middle;">' +
        '<a href="' +
        url +
        '" style="text-decoration:none;display:inline-block;">' +
        logoHtml +
        '</a></td>'
      );
    })
    .filter(Boolean)
    .join('');

  if (!cells) return { html: '', tracked: [] };

  const cellCount = (cells.match(/mini-sponsor-cell/g) || []).length;
  const widthPct = cellCount === 1 ? '100%' : cellCount === 2 ? '50%' : '33.33%';
  const sizedCells = cells.replace(/width:33\.33%;/g, 'width:' + widthPct + ';');

  return {
    html:
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
      '</tr></table></td></tr></table></td></tr>',
    tracked,
  };
}

function isRenderableEmailSponsor(block) {
  if (!block || block.active === false) return false;
  if (!hasSponsorLogo(block)) return false;
  if (!isEmailSafeLogoUrl(sponsorLogoUrl(block))) return false;
  // Website link preferred; buildSponsorSection falls back to /advertising when missing.
  return true;
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
 * Page Partner mini sponsors — same CMS carousel as detail pages.
 * Emails and pages share one inventory (no separate email carousel to manage).
 */
async function fetchEventMiniSponsorAds(sb, limit) {
  return fetchMiniSponsorAds(sb, EVENT_PAGE_CAROUSEL_SLOT, limit);
}

async function getEmailSponsorVars(slug) {
  const empty = { sponsor_row: '', sponsor_section: '', mini_sponsors_row: '', tracked: [] };
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
    // Email 2 / claim campaigns always use My Medical Cover (not organisers-directory sponsor).
    if (slug === 'organiser_launch_invite' || slug === 'organiser_claim_invite') {
      const { buildEmail2SponsorVars } = require('./email2-sponsor');
      return await buildEmail2SponsorVars({ wrapRow: true });
    }

    const sb = getSupabaseAdmin();
    let mainBlock = null;
    const label = 'Powered by';
    const tracked = [];

    if (OPPORTUNITY_EMAIL_SLUGS.has(slug)) {
      mainBlock = await resolveOpportunitySponsorBlock(sb);
    } else if (ORGANISER_EMAIL_SLUGS.has(slug)) {
      mainBlock = await resolveOrganiserSponsorBlock(sb);
    } else if (EVENT_MAIN_SPONSOR_SLUGS.has(slug)) {
      mainBlock = await resolveEventsMainSponsorBlock(sb);
    }

    const sponsorOpts = { label, placement: 'email_sponsor', campaign: 'email_sponsor' };
    // Opportunity (and organiser) directory logos are usually full-colour on white.
    // A dark pad makes them look like a white sticker — keep those on the cream header.
    if (OPPORTUNITY_EMAIL_SLUGS.has(slug)) {
      sponsorOpts.logoBandBg = '#ffffff';
      sponsorOpts.placement = 'opportunities_email';
      sponsorOpts.campaign = 'opportunities_email';
    } else if (ORGANISER_EMAIL_SLUGS.has(slug)) {
      sponsorOpts.logoBandBg = '#ffffff';
      sponsorOpts.placement = 'organisers_email';
      sponsorOpts.campaign = 'organisers_email';
    } else if (EVENT_MAIN_SPONSOR_SLUGS.has(slug)) {
      sponsorOpts.placement = 'events_email';
      sponsorOpts.campaign = 'events_email';
    }

    const sponsorRow = mainBlock
      ? wrapSponsorRow(buildSponsorSection(mainBlock, sponsorOpts))
      : '';
    if (sponsorRow && mainBlock) {
      tracked.push({
        placement: sponsorOpts.placement,
        company: sponsorCompanyName(mainBlock) || '',
      });
    }

    let miniRow = '';
    if (HUB_PARTNER_SPONSOR_SLUGS.has(slug)) {
      // Footer strip: Events + Organisers + Business Opportunities main directory sponsors.
      const partnerBlocks = await resolveHubPartnerBlocks(sb);
      const mini = buildMiniSponsorsRow(partnerBlocks, {
        label: 'Powered by',
        placement: 'hub_partner_email',
        campaign: 'hub_partner_email',
      });
      miniRow = mini.html;
      tracked.push.apply(tracked, mini.tracked);
    } else if (EVENT_MINI_SPONSOR_SLUGS.has(slug)) {
      const ads = await fetchEventMiniSponsorAds(sb, 3);
      const mini = buildMiniSponsorsRow(ads, {
        placement: 'events_email_mini',
        campaign: 'events_email_mini',
      });
      miniRow = mini.html;
      tracked.push.apply(tracked, mini.tracked);
    } else if (ORGANISER_MINI_SPONSOR_SLUGS.has(slug)) {
      const ads = await fetchMiniSponsorAds(sb, ORGANISER_PAGE_CAROUSEL_SLOT, 3);
      const mini = buildMiniSponsorsRow(ads, {
        placement: 'organisers_email_mini',
        campaign: 'organisers_email_mini',
      });
      miniRow = mini.html;
      tracked.push.apply(tracked, mini.tracked);
    } else if (OPPORTUNITY_MINI_SPONSOR_SLUGS.has(slug)) {
      const ads = await fetchMiniSponsorAds(sb, OPPORTUNITY_PAGE_CAROUSEL_SLOT, 3);
      const mini = buildMiniSponsorsRow(ads, {
        placement: 'opportunities_email_mini',
        campaign: 'opportunities_email_mini',
      });
      miniRow = mini.html;
      tracked.push.apply(tracked, mini.tracked);
    }

    return {
      sponsor_row: sponsorRow,
      sponsor_section: sponsorRow,
      mini_sponsors_row: miniRow,
      tracked,
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
    /alt="The Networker UK"[^>]*>[\s\S]*?<\/a>\s*<div[^>]*>\s*<svg[\s\S]*?viewBox="0 0 600 40"/i
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
    /alt="The Networker UK"[^>]*class="email-logo-header"|alt="The Networker UK" width="2[0-9]{2}"|class="email-logo-header"/i
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
  const anyLogo = body.search(/alt="The Networker UK"/i);
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
