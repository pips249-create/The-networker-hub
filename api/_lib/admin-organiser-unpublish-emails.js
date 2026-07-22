const { sendTemplatedEmail } = require('./send-template-email');
const { resolveOrganiserNotificationEmail } = require('./organiser-notification-email');
const { organiserDashboardUrl } = require('./hub-email-urls');
const { enrichEventRemovedByHubVars } = require('./event-removed-by-hub-sections');

async function sendOrganiserListingUnpublishedEmail(sb, options = {}) {
  const organiserId = String(options.organiserId || options.organiserRow?.id || '').trim();
  const organiserRow = options.organiserRow;
  const reason = String(options.reason || '').trim();
  const details = String(options.details || '').trim();

  if (!organiserId || !organiserRow) {
    return { skipped: true, reason: 'missing_organiser' };
  }

  const contact = await resolveOrganiserNotificationEmail(sb, organiserId);
  if (!contact.email) {
    return { skipped: true, reason: 'missing_organiser_email' };
  }

  const siteUrl = (process.env.SITE_URL || 'https://the-networker-hub.vercel.app').replace(/\/$/, '');
  const organiserName =
    String(contact.name || organiserRow.name || '').trim() || 'your group';

  const vars = enrichEventRemovedByHubVars(
    {
      organiser_name: organiserName,
      removal_reason: reason || 'Community report upheld',
      removal_details: details,
      dashboard_url: organiserDashboardUrl(siteUrl, { panel: 'profile' }),
    },
    ''
  );

  try {
    await sendTemplatedEmail({
      slug: 'organiser_listing_unpublished_by_hub',
      to: contact.email,
      variables: vars,
    });
    return { sent: true, to: contact.email };
  } catch (e) {
    return { sent: false, error: e.message || String(e), code: e.code || null };
  }
}

module.exports = {
  sendOrganiserListingUnpublishedEmail,
};
