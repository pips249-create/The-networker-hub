const { sendTemplatedEmail } = require('./send-template-email');

function formatAmount(amountPaid) {
  const n = Number(amountPaid);
  if (!Number.isFinite(n) || n <= 0) return 'Free';
  return n % 1 === 0 ? '£' + n.toFixed(0) : '£' + n.toFixed(2);
}

function eventPublicUrl(eventRow) {
  const site = (process.env.SITE_URL || 'https://the-networker-hub.vercel.app').replace(/\/$/, '');
  const slug = String(eventRow.slug || '').trim();
  if (slug) return site + '/events/' + encodeURIComponent(slug);
  return site + '/events/event.html?id=' + encodeURIComponent(eventRow.id);
}

/**
 * Send booking confirmation (+ organiser alert) after a registration is created.
 * Email failures are logged but do not fail checkout.
 */
async function sendRegistrationEmails(sb, registration) {
  const registrationId = registration.id;
  const attendeeId = registration.attendee_id;
  const eventId = registration.event_id;
  const ticketId = registration.ticket_id;
  if (!registrationId || !eventId) return { skipped: true, reason: 'missing_ids' };

  const [eventRes, attendeeRes, ticketRes] = await Promise.all([
    sb.from('events').select('id, title, slug, starts_at, ends_at, city, venue, location_label, organiser_id').eq('id', eventId).maybeSingle(),
    attendeeId
      ? sb.from('attendees').select('id, email, name').eq('id', attendeeId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    ticketId
      ? sb.from('tickets').select('id, name').eq('id', ticketId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (eventRes.error) throw new Error(eventRes.error.message);
  const eventRow = eventRes.data;
  if (!eventRow) return { skipped: true, reason: 'event_not_found' };

  const attendee = attendeeRes.data || {};
  const attendeeEmail = String(attendee.email || '').trim().toLowerCase();
  const attendeeName = String(attendee.name || '').trim() || 'there';

  let organiserName = '';
  let organiserEmail = '';
  if (eventRow.organiser_id) {
    const orgRes = await sb
      .from('organisers')
      .select('id, name, email')
      .eq('id', eventRow.organiser_id)
      .maybeSingle();
    if (orgRes.error) throw new Error(orgRes.error.message);
    organiserName = String(orgRes.data?.name || '').trim();
    organiserEmail = String(orgRes.data?.email || '').trim().toLowerCase();
  }

  const startsAt = eventRow.starts_at ? new Date(eventRow.starts_at) : null;
  const eventDate = startsAt
    ? startsAt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'Date TBC';
  const eventTime = startsAt
    ? startsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '';
  const eventLocation =
    String(eventRow.location_label || eventRow.venue || eventRow.city || '').trim() || 'See event page';
  const ticketName = String(ticketRes.data?.name || 'Ticket').trim();
  const amountPaid = formatAmount(registration.amount_paid);
  const eventUrl = eventPublicUrl(eventRow);
  const siteUrl = (process.env.SITE_URL || 'https://the-networker-hub.vercel.app').replace(/\/$/, '');

  const vars = {
    user_name: attendeeName,
    user_email: attendeeEmail,
    event_name: String(eventRow.title || 'Event').trim(),
    event_date: eventDate,
    event_time: eventTime,
    event_location: eventLocation,
    event_url: eventUrl,
    ticket_name: ticketName,
    amount_paid: amountPaid,
    organiser_name: organiserName || 'The organiser',
    meeting_link: String(registration.meeting_link || '').trim(),
    site_url: siteUrl,
    dashboard_url: siteUrl + '/organiser/index.html',
  };

  const sent = { attendee: false, organiser: false, errors: [] };

  if (attendeeEmail && !registration.ticket_email_sent) {
    try {
      await sendTemplatedEmail({
        slug: 'booking_confirmation',
        to: attendeeEmail,
        variables: vars,
      });
      sent.attendee = true;
    } catch (e) {
      sent.errors.push({ target: 'attendee', message: e.message || String(e) });
    }
  }

  if (organiserEmail) {
    try {
      await sendTemplatedEmail({
        slug: 'organiser_new_registration',
        to: organiserEmail,
        variables: vars,
      });
      sent.organiser = true;
    } catch (e) {
      sent.errors.push({ target: 'organiser', message: e.message || String(e) });
    }
  }

  if (sent.attendee) {
    await sb
      .from('registrations')
      .update({ ticket_email_sent: true })
      .eq('id', registrationId);
  }

  return sent;
}

module.exports = {
  sendRegistrationEmails,
  formatAmount,
  eventPublicUrl,
};
