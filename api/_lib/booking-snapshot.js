const { formatRefundPolicyLabel, formatRefundPolicyText, isOnlineEvent } = require('./event-refund-policy');

const SNAPSHOT_VERSION = 1;

function parsePriceNum(raw) {
  if (raw == null || raw === '') return 0;
  const n = Number(String(raw).replace(/[£,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function eventLocationLabel(eventRow) {
  if (!eventRow) return '';
  return (
    String(eventRow.location_label || '').trim() ||
    [eventRow.venue, eventRow.city, eventRow.postcode].filter(Boolean).join(', ').trim() ||
    String(eventRow.city || '').trim()
  );
}

function buildBookingSnapshot({ eventRow, ticketRow, quantity, amountPaid, paymentStatus, capturedAt }) {
  if (!eventRow?.id) return null;

  const qty = Math.max(1, Number(quantity) || 1);
  const ticketPrice = parsePriceNum(ticketRow?.price);
  const paid = amountPaid != null ? Number(amountPaid) : 0;

  return {
    v: SNAPSHOT_VERSION,
    captured_at: capturedAt || new Date().toISOString(),
    event: {
      id: String(eventRow.id),
      title: String(eventRow.title || '').trim(),
      starts_at: eventRow.starts_at || null,
      ends_at: eventRow.ends_at || null,
      venue: String(eventRow.venue || '').trim() || null,
      city: String(eventRow.city || '').trim() || null,
      postcode: String(eventRow.postcode || '').trim() || null,
      location_label: eventLocationLabel(eventRow) || null,
      meeting_type: String(eventRow.meeting_type || '').trim() || null,
      meeting_link: String(eventRow.meeting_link || '').trim() || null,
      refund_policy: String(eventRow.refund_policy || '').trim() || null,
      refund_policy_details: String(eventRow.refund_policy_details || '').trim() || null,
      refund_cutoff_days:
        eventRow.refund_cutoff_days != null ? Number(eventRow.refund_cutoff_days) : null,
      vat_treatment: String(eventRow.vat_treatment || '').trim() || null,
    },
    ticket: ticketRow?.id
      ? {
          id: String(ticketRow.id),
          name: String(ticketRow.name || 'Ticket').trim(),
          price: ticketPrice,
        }
      : null,
    quantity: qty,
    amount_paid: Number.isFinite(paid) ? paid : 0,
    payment_status: String(paymentStatus || '').trim() || null,
  };
}

async function loadSnapshotSourceRows(sb, eventId, ticketId) {
  const id = String(eventId || '').trim();
  if (!id) return { eventRow: null, ticketRow: null };

  const eventRes = await sb
    .from('events')
    .select(
      'id, title, starts_at, ends_at, venue, city, postcode, location_label, meeting_type, meeting_link, refund_policy, refund_policy_details, refund_cutoff_days, vat_treatment, organiser_id'
    )
    .eq('id', id)
    .maybeSingle();
  if (eventRes.error) throw new Error(eventRes.error.message);

  let ticketRow = null;
  const tid = String(ticketId || '').trim();
  if (tid) {
    const ticketRes = await sb.from('tickets').select('id, name, price, event_id').eq('id', tid).maybeSingle();
    if (ticketRes.error) throw new Error(ticketRes.error.message);
    if (ticketRes.data && String(ticketRes.data.event_id || '') === id) {
      ticketRow = ticketRes.data;
    }
  }

  return { eventRow: eventRes.data, ticketRow };
}

async function buildBookingSnapshotForRegistration(sb, { eventId, ticketId, quantity, amountPaid, paymentStatus }) {
  const { eventRow, ticketRow } = await loadSnapshotSourceRows(sb, eventId, ticketId);
  return buildBookingSnapshot({
    eventRow,
    ticketRow,
    quantity,
    amountPaid,
    paymentStatus,
  });
}

function snapshotEventRow(snapshot) {
  const event = snapshot?.event;
  if (!event || typeof event !== 'object') return null;
  return {
    id: event.id,
    title: event.title,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    venue: event.venue,
    city: event.city,
    postcode: event.postcode,
    location_label: event.location_label,
    meeting_type: event.meeting_type,
    meeting_link: event.meeting_link,
    refund_policy: event.refund_policy,
    refund_policy_details: event.refund_policy_details,
    refund_cutoff_days: event.refund_cutoff_days,
    vat_treatment: event.vat_treatment,
  };
}

/**
 * Prefer booked snapshot for what the attendee purchased; fall back to live event/ticket rows.
 */
function resolveBookedListing({ registration, eventRow, ticketRow }) {
  const snapshot = registration?.booked_snapshot;
  const snapEvent = snapshotEventRow(snapshot);
  const ev = snapEvent || eventRow || {};
  const ticketFromSnap = snapshot?.ticket;
  const ticket = ticketFromSnap
    ? { id: ticketFromSnap.id, name: ticketFromSnap.name, price: ticketFromSnap.price }
    : ticketRow || {};
  const qty = Math.max(1, Number(snapshot?.quantity ?? registration?.quantity) || 1);
  const meetingLink = String(registration?.meeting_link || ev.meeting_link || '').trim();

  return {
    eventRow: ev,
    ticketRow: ticket,
    quantity: qty,
    title: String(ev.title || 'Event').trim(),
    date: ev.starts_at || null,
    endDate: ev.ends_at || null,
    ticketName: String(ticket.name || 'General Admission').trim(),
    ticketPriceNum:
      snapshot?.ticket?.price != null
        ? parsePriceNum(snapshot.ticket.price)
        : parsePriceNum(ticket.price),
    amountPaid:
      snapshot?.amount_paid != null
        ? Number(snapshot.amount_paid)
        : registration?.amount_paid != null
          ? Number(registration.amount_paid)
          : 0,
    meetingLink,
    isOnline: isOnlineEvent(ev, meetingLink),
    hasSnapshot: Boolean(snapEvent),
    snapshotCapturedAt: snapshot?.captured_at || null,
    refundPolicyLabel: formatRefundPolicyLabel(ev) || 'Refund policy',
    refundPolicyText: formatRefundPolicyText(ev),
    refundPolicy: ev.refund_policy || null,
    refundPolicyDetails: ev.refund_policy_details || null,
    refundCutoffDays: ev.refund_cutoff_days != null ? Number(ev.refund_cutoff_days) : null,
  };
}

module.exports = {
  SNAPSHOT_VERSION,
  buildBookingSnapshot,
  loadSnapshotSourceRows,
  buildBookingSnapshotForRegistration,
  resolveBookedListing,
  snapshotEventRow,
};
