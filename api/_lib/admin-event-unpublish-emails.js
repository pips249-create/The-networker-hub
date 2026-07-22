const { sendTemplatedEmail } = require('./send-template-email');
const { resolveOrganiserNotificationEmail } = require('./organiser-notification-email');
const { organiserDashboardUrl } = require('./hub-email-urls');
const { enrichEventRemovedByHubVars } = require('./event-removed-by-hub-sections');

function formatEventDateTime(startsAt) {
  const d = startsAt ? new Date(startsAt) : null;
  if (!d || Number.isNaN(d.getTime())) {
    return { event_date: 'Date TBC', event_time: '' };
  }
  return {
    event_date: d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    event_time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  };
}

async function sendOrganiserEventUnpublishedEmail(sb, options = {}) {
  const eventId = String(options.eventId || '').trim();
  const eventRow = options.eventRow;
  const reason = String(options.reason || '').trim();
  const details = String(options.details || '').trim();

  if (!eventId || !eventRow) {
    return { skipped: true, reason: 'missing_event' };
  }

  const organiserId = String(eventRow.organiser_id || '').trim();
  const contact = await resolveOrganiserNotificationEmail(sb, organiserId);
  if (!contact.email) {
    return { skipped: true, reason: 'missing_organiser_email' };
  }

  const siteUrl = (process.env.SITE_URL || 'https://the-networker-hub.vercel.app').replace(/\/$/, '');
  const { event_date, event_time } = formatEventDateTime(eventRow.starts_at);
  const organiserName = String(contact.name || 'there').trim() || 'there';

  const vars = enrichEventRemovedByHubVars(
    {
      organiser_name: organiserName,
      event_name: String(eventRow.title || '').trim() || 'Untitled event',
      event_date,
      event_time,
      removal_reason: reason || 'Hub moderation',
      removal_details: details,
      paid_bookings: '0',
      refunds_confirmed: '',
      dashboard_url: organiserDashboardUrl(siteUrl, {
        panel: 'events-attendees',
        eventId,
        applications: 'pending',
      }),
    },
    ''
  );

  try {
    await sendTemplatedEmail({
      slug: 'event_unpublished_by_hub',
      to: contact.email,
      variables: vars,
    });
    return { sent: true, to: contact.email };
  } catch (e) {
    return { sent: false, error: e.message || String(e), code: e.code || null };
  }
}

module.exports = {
  sendOrganiserEventUnpublishedEmail,
};
