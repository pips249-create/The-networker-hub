/**
 * Transactional lifecycle emails: payouts, opportunity decisions, capacity alerts, meeting links.
 */
const { sendTemplatedEmail } = require('./send-template-email');
const { formatGbp } = require('./organiser-registration-stats');
const {
  siteBase,
  legalPolicyUrl,
  contactUrl,
  logoNavUrl,
  logoFooterUrl,
  hubertIconUrl,
  eventPublicUrl,
  organiserDashboardUrl,
  organiserBusinessDashboardUrl,
  opportunityPublicUrl,
  hubAccountUrl,
  hubPaymentUrl,
} = require('./hub-email-urls');
const { ownerNameFromOpportunity } = require('./opportunity-emails');
const { resolveOrganiserNotificationEmail } = require('./organiser-notification-email');
const { escapeHtml } = require('./event-refund-policy');
const { formatEventDateTime } = require('./favourite-sales-emails');

function baseEmailVars(siteUrl) {
  const site = siteBase(siteUrl);
  return {
    site_url: site,
    logo_url: logoNavUrl(site),
    logo_footer_url: logoFooterUrl(site),
    hubert_icon_url: hubertIconUrl(site),
    privacy_url: legalPolicyUrl(site, 'privacy'),
    terms_url: legalPolicyUrl(site, 'terms'),
    contact_url: contactUrl(site),
  };
}

function buildMeetingLinkEmailSection(link) {
  const url = String(link || '').trim();
  if (!url) return '';
  const safeUrl = escapeHtml(url);
  return (
    '<a href="' +
    safeUrl +
    '" style="display:inline-block;padding:14px 32px;background:#9a7aa8;border-radius:999px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;">Join online &rarr;</a>'
  );
}

async function sendPayoutRequestedEmail(sb, { payout, eventRow, organiserId }) {
  const contact = await resolveOrganiserNotificationEmail(sb, organiserId);
  if (!contact.email) return { skipped: true, reason: 'no_organiser_email' };

  const siteUrl = siteBase();
  await sendTemplatedEmail({
    slug: 'payout_requested',
    to: contact.email,
    variables: {
      ...baseEmailVars(siteUrl),
      organiser_name: contact.name || 'there',
      event_name: String(eventRow?.title || 'your event').trim(),
      amount_net: formatGbp(payout?.amount_net ?? payout?.amount),
      dashboard_url: organiserDashboardUrl(siteUrl, { panel: 'revenue' }),
    },
  });
  return { sent: true, to: contact.email };
}

async function sendPayoutStatusEmail(sb, { payout, eventRow, organiserId, status }) {
  const contact = await resolveOrganiserNotificationEmail(sb, organiserId);
  if (!contact.email) return { skipped: true, reason: 'no_organiser_email' };

  const slug = status === 'paid' ? 'payout_paid' : 'payout_approved';
  const siteUrl = siteBase();
  await sendTemplatedEmail({
    slug,
    to: contact.email,
    variables: {
      ...baseEmailVars(siteUrl),
      organiser_name: contact.name || 'there',
      event_name: String(eventRow?.title || 'your event').trim(),
      amount_net: formatGbp(payout?.amount_net ?? payout?.amount),
      dashboard_url: organiserDashboardUrl(siteUrl, { panel: 'revenue' }),
    },
  });
  return { sent: true, to: contact.email, slug };
}

async function sendOpportunityRejectedEmail(opportunity, rejectionNote) {
  const to = String(opportunity?.owner_email || opportunity?.contact_email || '').trim().toLowerCase();
  if (!to) return { skipped: true, reason: 'no_owner_email' };

  const siteUrl = siteBase();
  const note = String(rejectionNote || '').trim();
  await sendTemplatedEmail({
    slug: 'opportunity_listing_rejected',
    to,
    variables: {
      ...baseEmailVars(siteUrl),
      owner_name: ownerNameFromOpportunity(opportunity, to),
      opportunity_title: String(opportunity.title || 'Your opportunity').trim(),
      rejection_note: note
        ? note
        : 'We could not approve this listing at this time. You can edit your listing and resubmit when you are ready.',
      edit_url: siteUrl + '/organiser/opportunity-edit?id=' + encodeURIComponent(opportunity.id),
    },
  });
  return { sent: true, to };
}

async function sendOpportunityListingExpiredEmail(row) {
  const to = String(row.owner_email || row.contact_email || '').trim().toLowerCase();
  if (!to) return { skipped: true, reason: 'no_owner_email' };

  const siteUrl = siteBase();
  await sendTemplatedEmail({
    slug: 'opportunity_listing_expired',
    to,
    variables: {
      ...baseEmailVars(siteUrl),
      owner_name: ownerNameFromOpportunity(row, to),
      opportunity_title: String(row.title || 'Your opportunity').trim(),
      renew_url: organiserBusinessDashboardUrl(siteUrl, { renew: row.id }),
    },
  });
  return { sent: true, to };
}

async function sendOpportunityPremiumExpiredEmail(row) {
  const to = String(row.owner_email || row.contact_email || '').trim().toLowerCase();
  if (!to) return { skipped: true, reason: 'no_owner_email' };

  const siteUrl = siteBase();
  await sendTemplatedEmail({
    slug: 'opportunity_premium_expired',
    to,
    variables: {
      ...baseEmailVars(siteUrl),
      owner_name: ownerNameFromOpportunity(row, to),
      opportunity_title: String(row.title || 'Your opportunity').trim(),
      renew_url: organiserBusinessDashboardUrl(siteUrl, { renew: row.id }),
    },
  });
  return { sent: true, to };
}

async function sendEventAlmostFullEmail(sb, eventRow, stats) {
  const organiserId = eventRow?.organiser_id;
  if (!organiserId) return { skipped: true, reason: 'no_organiser' };

  const contact = await resolveOrganiserNotificationEmail(sb, organiserId);
  if (!contact.email) return { skipped: true, reason: 'no_organiser_email' };

  const siteUrl = siteBase();
  await sendTemplatedEmail({
    slug: 'event_almost_full',
    to: contact.email,
    variables: {
      ...baseEmailVars(siteUrl),
      organiser_name: contact.name || 'there',
      event_name: String(eventRow.title || 'your event').trim(),
      tickets_remaining: String(stats.tickets_remaining || ''),
      tickets_sold: String(stats.tickets_sold || ''),
      dashboard_url: organiserDashboardUrl(siteUrl, {
        panel: 'events-attendees',
        eventId: eventRow.id,
      }),
    },
  });

  await sb
    .from('events')
    .update({ almost_full_email_sent_at: new Date().toISOString() })
    .eq('id', eventRow.id);

  return { sent: true, to: contact.email };
}

function reviewUrlForEvent(eventRow, siteUrl, options) {
  const site = siteBase(siteUrl);
  const eventId = String(eventRow?.id || '').trim();
  const opts = options && typeof options === 'object' ? options : {};
  const rating = Math.max(0, Math.min(5, Math.round(Number(opts.rating) || 0)));
  if (eventId) {
    const encoded = encodeURIComponent(eventId);
    let url = hubAccountUrl(site) + '?review=' + encoded;
    if (rating >= 1) url += '&rating=' + String(rating);
    return url + '#review/' + encoded;
  }
  return hubAccountUrl(site) + '#reviews-pending';
}

function buildReviewStarRatingRow(eventRow, siteUrl) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const href = escapeHtml(reviewUrlForEvent(eventRow, siteUrl, { rating: i }));
    stars.push(
      '<a class="review-star-link" href="' +
        href +
        '" style="display:inline-block;padding:4px 8px;font-size:40px;line-height:1;color:#e6b422;text-decoration:none;" aria-label="' +
        i +
        ' star' +
        (i === 1 ? '' : 's') +
        '">&#9733;</a>'
    );
  }
  return (
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">' +
    '<tr><td style="text-align:center;line-height:1;">' +
    stars.join('') +
    '</td></tr></table>'
  );
}

function buildPostEventReviewEmailVars(eventRow, attendee, organiser, siteUrl) {
  const site = siteBase(siteUrl);
  const { event_date } = formatEventDateTime(eventRow?.starts_at);
  const organiserName = String(organiser?.name || '').trim() || 'the organiser';
  const eventName = String(eventRow?.title || 'your event').trim();
  const metaParts = [];
  if (event_date) metaParts.push(event_date);
  if (organiserName && organiserName !== 'the organiser') metaParts.push(organiserName);
  return {
    ...baseEmailVars(site),
    user_name: String(attendee?.name || '').trim() || 'there',
    event_name: eventName,
    organiser_name: organiserName,
    event_date: event_date || '',
    event_meta: metaParts.join(' · ') || organiserName,
    review_url: reviewUrlForEvent(eventRow, site),
    star_rating_row: buildReviewStarRatingRow(eventRow, site),
  };
}

module.exports = {
  baseEmailVars,
  buildMeetingLinkEmailSection,
  sendPayoutRequestedEmail,
  sendPayoutStatusEmail,
  sendOpportunityRejectedEmail,
  sendOpportunityListingExpiredEmail,
  sendOpportunityPremiumExpiredEmail,
  sendEventAlmostFullEmail,
  reviewUrlForEvent,
  buildReviewStarRatingRow,
  buildPostEventReviewEmailVars,
  hubPaymentUrl,
  eventPublicUrl,
  organiserBusinessDashboardUrl,
  opportunityPublicUrl,
};
