const { sendTemplatedEmail } = require('./send-template-email');
const { resolveOrganiserNotificationEmail } = require('./organiser-notification-email');
const {
  eventPublicUrl,
  organiserPublicUrl,
  organiserDashboardUrl,
  supportEmail,
} = require('./hub-email-urls');
const { formatMultilineHtml } = require('./event-refund-policy');
const { publicOrganiserSlug } = require('./organiser-slug');
const { publicEventSlug } = require('./event-slug');

const LISTING_CHANGE_REASONS = [
  'Listing wording',
  'Ticket details',
  'Event description',
  'Date, time or location',
  'Other',
];

const MAX_MESSAGE_CHARS = 2000;

function buildAdminMessageRow(message) {
  const text = String(message || '').trim();
  if (!text) return '';
  return (
    '<tr><td class="mobile-pad" style="padding:0 40px 20px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f0e8;border-radius:14px;border:1px solid #d9c4e0;">' +
    '<tr><td style="padding:20px 22px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:700;color:#1c2040;margin:0 0 6px;">Note from the Hub team</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;line-height:1.65;color:#635c5e;margin:0;">' +
    formatMultilineHtml(text) +
    '</p></td></tr></table></td></tr>'
  );
}

function normalizeReason(raw) {
  const reason = String(raw || '').trim();
  if (LISTING_CHANGE_REASONS.indexOf(reason) >= 0) return reason;
  return reason.slice(0, 120) || 'Other';
}

async function sendOrganiserListingUpdatedEmail(sb, options = {}) {
  const organiserId = String(options.organiserId || '').trim();
  const eventId = String(options.eventId || '').trim();
  const reason = normalizeReason(options.reason);
  const message = String(options.message || '').trim();

  if (!organiserId) return { skipped: true, reason: 'missing_organiser' };
  if (!message) return { skipped: true, reason: 'missing_message' };
  if (message.length > MAX_MESSAGE_CHARS) {
    const err = new Error('Message must be ' + MAX_MESSAGE_CHARS + ' characters or fewer.');
    err.status = 400;
    throw err;
  }

  const orgRes = await sb
    .from('organisers')
    .select('id, name, slug, email, contact_email')
    .eq('id', organiserId)
    .maybeSingle();
  if (orgRes.error) throw new Error(orgRes.error.message);
  const organiser = orgRes.data;
  if (!organiser) return { skipped: true, reason: 'organiser_not_found' };

  const contact = await resolveOrganiserNotificationEmail(sb, organiserId);
  if (!contact.email) return { skipped: true, reason: 'missing_organiser_email' };

  let eventRow = options.eventRow || null;
  if (!eventRow && eventId) {
    const evRes = await sb
      .from('events')
      .select('id, title, slug, starts_at, organiser_id')
      .eq('id', eventId)
      .maybeSingle();
    if (evRes.error) throw new Error(evRes.error.message);
    eventRow = evRes.data;
    if (eventRow && String(eventRow.organiser_id || '') !== organiserId) {
      const err = new Error('That event is not linked to this networking group.');
      err.status = 400;
      throw err;
    }
  }

  const siteUrl = (process.env.SITE_URL || 'https://www.thenetworkeruk.com').replace(/\/$/, '');
  const organiserName = String(contact.name || organiser.name || 'there').trim() || 'there';
  const eventTitle = eventRow ? String(eventRow.title || '').trim() || 'Untitled event' : '';
  const listingLabel = eventTitle || String(organiser.name || '').trim() || 'your listing';
  const listingKind = eventRow ? 'your event listing' : 'your organiser page';
  const listingUrl = eventRow
    ? eventPublicUrl({ id: eventRow.id, slug: publicEventSlug(eventRow) || eventRow.slug }, siteUrl)
    : organiserPublicUrl(
        { id: organiser.id, slug: publicOrganiserSlug(organiser) || organiser.slug, name: organiser.name },
        siteUrl
      );
  const ctaLabel = eventRow ? 'View your listing' : 'View your organiser page';

  try {
    await sendTemplatedEmail({
      slug: 'organiser_listing_updated_by_hub',
      to: contact.email,
      replyTo: supportEmail(),
      skipEmailCheck: true,
      variables: {
        organiser_name: organiserName,
        listing_label: listingLabel,
        listing_kind: listingKind,
        change_reason: reason,
        admin_message_row: buildAdminMessageRow(message),
        listing_url: listingUrl,
        cta_label: ctaLabel,
        dashboard_url: organiserDashboardUrl(siteUrl, eventId ? { eventId } : {}),
        event_name: eventTitle,
      },
    });
    return {
      sent: true,
      to: contact.email,
      listingLabel,
      reason,
    };
  } catch (e) {
    return { sent: false, error: e.message || String(e), code: e.code || null };
  }
}

module.exports = {
  LISTING_CHANGE_REASONS,
  MAX_MESSAGE_CHARS,
  sendOrganiserListingUpdatedEmail,
};
