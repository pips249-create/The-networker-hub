const { sendTemplatedEmail } = require('./send-template-email');
const { isOnlineEvent } = require('./event-refund-policy');
const {
  formatBookingReference,
  formatBookedAt,
  formatTicketQuantity,
} = require('./booking-payment-summary');
const {
  siteBase,
  browseEventsUrl,
  hubAccountUrl,
  hubPaymentUrl,
  legalPolicyUrl,
  contactUrl,
  eventPublicUrl: buildEventPublicUrl,
} = require('./hub-email-urls');
const { computeEventTicketStats } = require('./organiser-registration-stats');
const { attendeeInitial } = require('./organiser-email-sections');

function formatAmount(amountPaid) {
  const n = Number(amountPaid);
  if (!Number.isFinite(n) || n <= 0) return 'Free';
  return n % 1 === 0 ? '£' + n.toFixed(0) : '£' + n.toFixed(2);
}

function buildMeetingLinkSection(link) {
  const url = String(link || '').trim();
  if (!url) return '';
  const safeUrl = url.replace(/"/g, '&quot;');
  return (
    '<tr><td class="mobile-pad" style="padding:0 48px 8px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f0e8;border-radius:14px;border:1px solid #d9c4e0;">' +
    '<tr><td style="padding:20px 24px;text-align:center;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:11px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:2.5px;margin:0 0 8px;">Online event</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;font-weight:400;color:#736b6e;line-height:1.6;margin:0 0 14px;">Use the link below to join when the event starts.</p>' +
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">' +
    '<tr><td style="background:#9a7aa8;border-radius:999px;">' +
    '<a href="' +
    safeUrl +
    '" style="display:inline-block;padding:12px 32px;font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;">Join online &rarr;</a>' +
    '</td></tr></table></td></tr></table></td></tr>'
  );
}

function eventPublicUrl(eventRow) {
  return buildEventPublicUrl(eventRow);
}

function buildAttendeeEmailVars({
  registration,
  eventRow,
  attendee,
  ticketName,
  organiserName,
  amountPaid,
}) {
  const registrationId = registration.id;
  const attendeeName = String(attendee?.name || '').trim() || 'there';
  const attendeeEmail = String(attendee?.email || '').trim().toLowerCase();
  const startsAt = eventRow.starts_at ? new Date(eventRow.starts_at) : null;
  const eventDate = startsAt
    ? startsAt.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Date TBC';
  const eventTime = startsAt
    ? startsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '';
  const eventLocation =
    String(eventRow.location_label || eventRow.venue || eventRow.city || '').trim() ||
    'See event page';
  const siteUrl = siteBase();
  const meetingLink = String(registration.meeting_link || eventRow.meeting_link || '').trim();
  const online = isOnlineEvent(eventRow, meetingLink);
  const ticketQuantity = Math.max(1, parseInt(registration.quantity, 10) || 1);
  const bookedAtIso = registration.created_at || new Date().toISOString();
  const resolvedTicketName = String(ticketName || 'Ticket').trim();
  const resolvedAmountPaid =
    amountPaid != null ? amountPaid : formatAmount(registration.amount_paid);

  return {
    user_name: attendeeName,
    user_email: attendeeEmail,
    event_name: String(eventRow.title || 'Event').trim(),
    event_date: eventDate,
    event_time: eventTime,
    event_location: eventLocation,
    event_url: eventPublicUrl(eventRow, siteUrl),
    ticket_name: resolvedTicketName,
    amount_paid: resolvedAmountPaid,
    registration_id: registrationId,
    booking_reference: formatBookingReference(registrationId),
    booked_at: formatBookedAt(bookedAtIso),
    booked_at_iso: bookedAtIso,
    ticket_quantity: ticketQuantity,
    ticket_quantity_label: formatTicketQuantity(ticketQuantity, resolvedTicketName),
    payment_status: String(registration.payment_status || '').trim(),
    hub_account_url: hubAccountUrl(siteUrl),
    hub_payment_url: hubPaymentUrl(siteUrl, registrationId),
    browse_events_url: browseEventsUrl(siteUrl),
    contact_url: contactUrl(siteUrl),
    privacy_url: legalPolicyUrl(siteUrl, 'privacy'),
    terms_url: legalPolicyUrl(siteUrl, 'terms'),
    refunds_url: legalPolicyUrl(siteUrl, 'refunds'),
    organiser_name: organiserName || 'The organiser',
    meeting_link: online ? meetingLink : '',
    meeting_type: eventRow.meeting_type || (online ? 'Online' : 'In person'),
    refund_policy: eventRow.refund_policy,
    refund_policy_details: eventRow.refund_policy_details,
    refund_cutoff_days: eventRow.refund_cutoff_days,
    site_url: siteUrl,
    logo_url: siteUrl + '/assets/logo-nav.png',
    dashboard_url: siteUrl + '/organiser/index.html',
  };
}

async function fetchEventRegistrationStats(sb, eventId) {
  const [regsRes, ticketsRes] = await Promise.all([
    sb
      .from('registrations')
      .select('payment_status, application_status, quantity, amount_paid')
      .eq('event_id', eventId),
    sb.from('tickets').select('id, quantity').eq('event_id', eventId),
  ]);

  if (regsRes.error) throw new Error(regsRes.error.message);
  if (ticketsRes.error) throw new Error(ticketsRes.error.message);

  return computeEventTicketStats(regsRes.data, ticketsRes.data);
}

function buildOrganiserEmailVars(attendeeVars, stats) {
  const attendeeName = String(attendeeVars.user_name || '').trim() || 'Guest';
  return {
    ...attendeeVars,
    ...stats,
    attendee_name: attendeeName,
    attendee_email: String(attendeeVars.user_email || '').trim(),
    attendee_initial: attendeeInitial(attendeeName),
    booking_time: String(attendeeVars.booked_at || '').trim(),
  };
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
    sb
      .from('events')
      .select(
        'id, title, slug, starts_at, ends_at, city, venue, location_label, organiser_id, meeting_link, meeting_type, postcode, refund_policy, refund_policy_details, refund_cutoff_days'
      )
      .eq('id', eventId)
      .maybeSingle(),
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

  const ticketName = String(ticketRes.data?.name || 'Ticket').trim();
  const amountPaid = formatAmount(registration.amount_paid);

  const vars = buildAttendeeEmailVars({
    registration,
    eventRow,
    attendee,
    ticketName,
    organiserName,
    amountPaid,
  });

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
      const stats = await fetchEventRegistrationStats(sb, eventId);
      const organiserVars = buildOrganiserEmailVars(vars, stats);
      await sendTemplatedEmail({
        slug: 'organiser_new_registration',
        to: organiserEmail,
        variables: organiserVars,
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
  buildAttendeeEmailVars,
  buildOrganiserEmailVars,
  fetchEventRegistrationStats,
  formatAmount,
  eventPublicUrl,
  buildMeetingLinkSection,
  isOnlineEvent,
};
