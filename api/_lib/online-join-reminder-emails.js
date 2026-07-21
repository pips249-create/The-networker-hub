const { sendTemplatedEmail } = require('./send-template-email');
const { buildAttendeeEmailVars } = require('./registration-emails');
const { isOnlineEvent } = require('./event-refund-policy');
const {
  baseEmailVars,
  buildMeetingLinkEmailSection,
} = require('./lifecycle-emails');
const { enrichBookingReminderVars } = require('./booking-email-sections');
const { getEmailSponsorVars } = require('./email-sponsor-sections');

const REMINDER_HOURS = 1;
const REMINDER_WINDOW_HOURS = 1;
// Last-chance catch-up if an hourly cron run was missed.
const REMINDER_CATCHUP_HOURS = 0.5;

function resolveMeetingLink(registration, eventRow) {
  return String(registration?.meeting_link || eventRow?.meeting_link || '').trim();
}

/**
 * Send join-link reminders ~1 hour before online events start.
 * Runs hourly — primary window is 1h ± 30m; unsent reminders also send up to 30m before start.
 */
async function sendDueOnlineJoinReminders(sb) {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const primaryStart = new Date(
    now + (REMINDER_HOURS - REMINDER_WINDOW_HOURS / 2) * 60 * 60 * 1000
  ).toISOString();
  const primaryEnd = new Date(
    now + (REMINDER_HOURS + REMINDER_WINDOW_HOURS / 2) * 60 * 60 * 1000
  ).toISOString();
  const catchupEnd = new Date(now + REMINDER_CATCHUP_HOURS * 60 * 60 * 1000).toISOString();

  const { data: events, error: eventsError } = await sb
    .from('events')
    .select(
      'id, title, slug, starts_at, organiser_id, meeting_link, meeting_type, venue, location_label, city, status, refund_policy, refund_policy_details, refund_cutoff_days'
    )
    .gt('starts_at', nowIso)
    .lte('starts_at', primaryEnd)
    .neq('status', 'cancelled');

  if (eventsError) throw new Error(eventsError.message);

  const dueEvents = (events || []).filter(function (eventRow) {
    const startsAt = String(eventRow.starts_at || '');
    const link = resolveMeetingLink(null, eventRow);
    if (!link || !isOnlineEvent(eventRow, link)) return false;
    return (
      (startsAt >= primaryStart && startsAt <= primaryEnd) ||
      (startsAt > nowIso && startsAt <= catchupEnd)
    );
  });

  if (!dueEvents.length) {
    return { sent: 0, skipped: 0, errors: [], eventsChecked: 0 };
  }

  const eventIds = dueEvents.map(function (e) {
    return e.id;
  });
  const eventById = Object.fromEntries(dueEvents.map((e) => [e.id, e]));

  const { data: registrations, error: regsError } = await sb
    .from('registrations')
    .select(
      'id, attendee_id, event_id, ticket_id, meeting_link, quantity, amount_paid, payment_status, application_status, online_join_reminder_sent_at, cancelled_at, created_at'
    )
    .in('event_id', eventIds)
    .is('online_join_reminder_sent_at', null)
    .is('cancelled_at', null)
    .in('payment_status', ['Paid', 'Free'])
    .eq('application_status', 'Approved');

  if (regsError) throw new Error(regsError.message);

  const sponsorVars = await getEmailSponsorVars('online_join_reminder');
  const result = { sent: 0, skipped: 0, errors: [], eventsChecked: dueEvents.length };

  for (const registration of registrations || []) {
    const eventRow = eventById[registration.event_id];
    if (!eventRow) {
      result.skipped += 1;
      continue;
    }

    const meetingLink = resolveMeetingLink(registration, eventRow);
    if (!meetingLink) {
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

    const vars = enrichBookingReminderVars(
      buildAttendeeEmailVars({
        registration,
        eventRow,
        attendee: attendee || {},
        ticketName,
        organiserName,
      }),
      sponsorVars.sponsor_row
    );

    const emailVars = {
      ...baseEmailVars(vars.site_url),
      ...vars,
      meeting_link_section: buildMeetingLinkEmailSection(meetingLink),
      sponsor_row: sponsorVars.sponsor_row || '',
      mini_sponsors_row: sponsorVars.mini_sponsors_row || '',
    };

    try {
      await sendTemplatedEmail({
        slug: 'online_join_reminder',
        to: attendeeEmail,
        variables: emailVars,
        subject: 'Join online in 1 hour — ' + String(eventRow.title || 'your event').trim(),
      });
      await sb
        .from('registrations')
        .update({ online_join_reminder_sent_at: new Date().toISOString() })
        .eq('id', registration.id);
      result.sent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') result.skipped += 1;
      else {
        result.errors.push({
          registration_id: registration.id,
          email: attendeeEmail,
          message: e.message || String(e),
        });
      }
    }
  }

  return result;
}

module.exports = {
  sendDueOnlineJoinReminders,
};
