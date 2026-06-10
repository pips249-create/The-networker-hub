const { sendTemplatedEmail } = require('./send-template-email');
const { buildAttendeeEmailVars } = require('./registration-emails');

const REMINDER_HOURS = 24;
const REMINDER_WINDOW_HOURS = 1;

/**
 * Find confirmed registrations for events starting ~24 hours from now and send reminders.
 */
async function sendDueBookingReminders(sb) {
  const now = Date.now();
  const windowStart = new Date(now + (REMINDER_HOURS - REMINDER_WINDOW_HOURS / 2) * 60 * 60 * 1000);
  const windowEnd = new Date(now + (REMINDER_HOURS + REMINDER_WINDOW_HOURS / 2) * 60 * 60 * 1000);

  const { data: events, error: eventsError } = await sb
    .from('events')
    .select(
      'id, title, slug, starts_at, organiser_id, meeting_link, meeting_type, venue, location_label, city, status, refund_policy, refund_policy_details, refund_cutoff_days'
    )
    .gte('starts_at', windowStart.toISOString())
    .lte('starts_at', windowEnd.toISOString())
    .neq('status', 'cancelled');

  if (eventsError) throw new Error(eventsError.message);
  if (!events || !events.length) {
    return { sent: 0, skipped: 0, errors: [], eventsChecked: 0 };
  }

  const eventIds = events.map(function (e) {
    return e.id;
  });
  const eventById = {};
  events.forEach(function (e) {
    eventById[e.id] = e;
  });

  const { data: registrations, error: regsError } = await sb
    .from('registrations')
    .select('id, attendee_id, event_id, ticket_id, meeting_link, quantity, amount_paid, payment_status, application_status, reminder_email_sent_at, created_at')
    .in('event_id', eventIds)
    .is('reminder_email_sent_at', null)
    .in('payment_status', ['Paid', 'Free'])
    .eq('application_status', 'Approved');

  if (regsError) throw new Error(regsError.message);

  const rows = registrations || [];
  const result = { sent: 0, skipped: 0, errors: [], eventsChecked: events.length };

  for (const registration of rows) {
    const eventRow = eventById[registration.event_id];
    if (!eventRow) {
      result.skipped += 1;
      continue;
    }

    let attendee = null;
    if (registration.attendee_id) {
      const attendeeRes = await sb
        .from('attendees')
        .select('id, email, name')
        .eq('id', registration.attendee_id)
        .maybeSingle();
      if (attendeeRes.error) throw new Error(attendeeRes.error.message);
      attendee = attendeeRes.data;
    }

    const attendeeEmail = String(attendee?.email || '').trim().toLowerCase();
    if (!attendeeEmail) {
      result.skipped += 1;
      continue;
    }

    let ticketName = 'Ticket';
    if (registration.ticket_id) {
      const ticketRes = await sb
        .from('tickets')
        .select('id, name')
        .eq('id', registration.ticket_id)
        .maybeSingle();
      if (ticketRes.error) throw new Error(ticketRes.error.message);
      ticketName = String(ticketRes.data?.name || 'Ticket').trim();
    }

    let organiserName = '';
    if (eventRow.organiser_id) {
      const orgRes = await sb
        .from('organisers')
        .select('id, name')
        .eq('id', eventRow.organiser_id)
        .maybeSingle();
      if (orgRes.error) throw new Error(orgRes.error.message);
      organiserName = String(orgRes.data?.name || '').trim();
    }

    const vars = buildAttendeeEmailVars({
      registration,
      eventRow,
      attendee: attendee || {},
      ticketName,
      organiserName,
    });

    try {
      await sendTemplatedEmail({
        slug: 'booking_reminder',
        to: attendeeEmail,
        variables: vars,
      });
      await sb
        .from('registrations')
        .update({ reminder_email_sent_at: new Date().toISOString() })
        .eq('id', registration.id);
      result.sent += 1;
    } catch (e) {
      result.errors.push({
        registration_id: registration.id,
        email: attendeeEmail,
        message: e.message || String(e),
      });
    }
  }

  return result;
}

module.exports = {
  sendDueBookingReminders,
  REMINDER_HOURS,
};
