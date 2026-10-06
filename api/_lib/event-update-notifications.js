/**
 * Notify booked attendees when organisers change allowed (non-material) event details.
 */
const { sendTemplatedEmail } = require('./send-template-email');
const { plainEventDescription } = require('./event-description');
const { escapeHtml } = require('./event-refund-policy');
const { loadLockedOrActiveSaleEvents } = require('./event-sale-lock');
const { buildMeetingLinkEmailSection } = require('./lifecycle-emails');
const {
  buildAttendeeEmailVars,
} = require('./registration-emails');

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectNotifyableEventChanges(existingRow, updatedRow) {
  if (!existingRow || !updatedRow) return [];

  const changes = [];
  const prevTitle = normalizeText(existingRow.title);
  const nextTitle = normalizeText(updatedRow.title);
  if (prevTitle && nextTitle && prevTitle !== nextTitle) {
    changes.push({ field: 'title', label: 'Event title', to: nextTitle });
  }

  const prevDesc = normalizeText(plainEventDescription(existingRow.description));
  const nextDesc = normalizeText(plainEventDescription(updatedRow.description));
  if (prevDesc && nextDesc && prevDesc !== nextDesc) {
    changes.push({ field: 'description', label: 'Description', to: nextDesc });
  }

  const prevLink = String(existingRow.meeting_link || '').trim();
  const nextLink = String(updatedRow.meeting_link || '').trim();
  if (nextLink && prevLink !== nextLink) {
    changes.push({
      field: 'meeting_link',
      label: prevLink ? 'Updated join link' : 'Join link',
      to: nextLink,
      isFirstLink: !prevLink,
    });
  }

  return changes;
}

function buildChangesSectionHtml(changes) {
  return (changes || [])
    .map((change) => {
      if (change.field === 'meeting_link') {
        return (
          '<p style="margin:0 0 16px;color:rgba(255,255,255,0.75);font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">' +
          escapeHtml(change.label) +
          '</p>' +
          buildMeetingLinkEmailSection(change.to)
        );
      }
      const body =
        change.field === 'description'
          ? escapeHtml(String(change.to || ''))
              .slice(0, 1200)
              .replace(/\r?\n/g, '<br>')
          : escapeHtml(String(change.to || ''));
      return (
        '<p style="margin:0 0 16px;">' +
        '<span style="display:block;color:rgba(255,255,255,0.75);font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">' +
        escapeHtml(change.label) +
        '</span>' +
        '<span style="color:#ffffff;font-size:16px;line-height:1.6;">' +
        body +
        '</span></p>'
      );
    })
    .join('');
}

async function listActiveRegistrationsForEvent(sb, eventId) {
  const { data, error } = await sb
    .from('registrations')
    .select(
      'id, attendee_id, event_id, ticket_id, amount_paid, payment_status, application_status, quantity, created_at, meeting_link, cancelled_at'
    )
    .eq('event_id', eventId)
    .in('payment_status', ['Paid', 'Free', 'Pending'])
    .neq('application_status', 'Denied')
    .is('cancelled_at', null);
  if (error) throw new Error(error.message);
  return data || [];
}

async function sendEventDetailsUpdatedEmails(sb, eventId, changes, eventRow) {
  const list = (changes || []).filter((change) => {
    if (!change) return false;
    if (change.field === 'meeting_link' && change.isFirstLink) return false;
    return true;
  });
  if (!list.length || !eventId || !eventRow) {
    return { sent: 0, skipped: true, reason: 'no_changes' };
  }

  const saleEvents = await loadLockedOrActiveSaleEvents(sb, [eventId]);
  if (!saleEvents.length) {
    return { sent: 0, skipped: true, reason: 'no_ticket_sales' };
  }

  const registrations = await listActiveRegistrationsForEvent(sb, eventId);
  if (!registrations.length) {
    return { sent: 0, skipped: true, reason: 'no_registrations' };
  }

  const { data: tickets, error: ticketErr } = await sb
    .from('tickets')
    .select('id, name')
    .eq('event_id', eventId);
  if (ticketErr) throw new Error(ticketErr.message);
  const ticketsById = new Map((tickets || []).map((ticket) => [ticket.id, ticket]));

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

  const changesSection = buildChangesSectionHtml(list);
  const linkChange = list.find((change) => change.field === 'meeting_link');
  if (linkChange) {
    await sb.from('registrations').update({ meeting_link: linkChange.to }).eq('event_id', eventId);
  }

  const result = { sent: 0, skipped: 0, errors: [] };
  const eventName = String(eventRow.title || 'your event').trim();

  for (const registration of registrations) {
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

    const ticketName = String(ticketsById.get(registration.ticket_id)?.name || 'Ticket').trim();
    const vars = buildAttendeeEmailVars({
      registration,
      eventRow,
      attendee,
      ticketName,
      organiserName,
      amountPaid: registration.amount_paid,
    });
    vars.changes_section = changesSection;

    try {
      await sendTemplatedEmail({
        slug: 'event_details_updated',
        to: attendeeEmail,
        variables: vars,
        subject: 'Update for ' + eventName,
      });
      result.sent += 1;
    } catch (err) {
      result.errors.push({
        registrationId: registration.id,
        message: err.message || String(err),
      });
    }
  }

  return result;
}

module.exports = {
  detectNotifyableEventChanges,
  buildChangesSectionHtml,
  sendEventDetailsUpdatedEmails,
};
