/**
 * Admin booking lookup — search registrations for support.
 */
const { formatBookingReference } = require('./booking-payment-summary');

const REGISTRATION_SELECT =
  'id, created_at, payment_status, amount_paid, quantity, cancelled_at, refund_email_sent_at, application_status, stripe_payment_intent_id, stripe_checkout_session_id, attendee_id, event_id, ticket_id, organiser_id, attendees(name, email), events(title, slug, starts_at), tickets(name)';

function mapBookingRow(row) {
  return {
    id: row.id,
    bookingReference: formatBookingReference(row.id),
    createdAt: row.created_at || null,
    paymentStatus: row.payment_status || '',
    amountPaid: Number(row.amount_paid) || 0,
    quantity: row.quantity || 1,
    cancelledAt: row.cancelled_at || null,
    refundEmailSentAt: row.refund_email_sent_at || null,
    applicationStatus: row.application_status || null,
    stripePaymentIntentId: row.stripe_payment_intent_id || null,
    stripeCheckoutSessionId: row.stripe_checkout_session_id || null,
    attendeeName: row.attendees?.name || '—',
    attendeeEmail: row.attendees?.email || '—',
    eventTitle: row.events?.title || '—',
    eventSlug: row.events?.slug || '',
    eventStartsAt: row.events?.starts_at || null,
    ticketName: row.tickets?.name || '—',
    organiserId: row.organiser_id || null,
  };
}

function parseBookingSearchQuery(raw) {
  const q = String(raw || '').trim();
  if (!q) return { kind: 'none' };
  if (q.includes('@')) return { kind: 'email', value: q.toLowerCase() };
  const uuidFull =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidFull.test(q)) return { kind: 'id', value: q };
  const ref = q.replace(/^hub-/i, '').replace(/-/g, '');
  if (/^[0-9a-f]{6,32}$/i.test(ref)) return { kind: 'ref', value: ref.toLowerCase() };
  return { kind: 'text', value: q.toLowerCase() };
}

async function fetchRegistrations(sb, builder) {
  const res = await builder(
    sb.from('registrations').select(REGISTRATION_SELECT).order('created_at', { ascending: false }).limit(40)
  );
  if (res.error) throw new Error(res.error.message);
  return (res.data || []).map(mapBookingRow);
}

async function searchAdminBookings(sb, query) {
  const parsed = parseBookingSearchQuery(query.q);
  if (parsed.kind === 'none') {
    return { bookings: [], message: 'Enter an email, booking reference (HUB-…), registration ID, or event title.' };
  }
  if (parsed.kind !== 'id' && parsed.value.length < 2) {
    return { bookings: [], message: 'Enter at least 2 characters.' };
  }

  if (parsed.kind === 'id') {
    const bookings = await fetchRegistrations(sb, (q) => q.eq('id', parsed.value));
    return { bookings, query: parsed };
  }

  if (parsed.kind === 'ref') {
    const bookings = await fetchRegistrations(sb, (q) => q.ilike('id', `${parsed.value}%`));
    return { bookings, query: parsed };
  }

  if (parsed.kind === 'email') {
    const attRes = await sb
      .from('attendees')
      .select('id')
      .ilike('email', `%${parsed.value}%`)
      .limit(40);
    if (attRes.error) throw new Error(attRes.error.message);
    const attendeeIds = (attRes.data || []).map((a) => a.id).filter(Boolean);
    if (!attendeeIds.length) return { bookings: [], query: parsed };
    const bookings = await fetchRegistrations(sb, (q) => q.in('attendee_id', attendeeIds));
    return { bookings, query: parsed };
  }

  const evRes = await sb
    .from('events')
    .select('id')
    .ilike('title', `%${parsed.value}%`)
    .limit(40);
  if (evRes.error) throw new Error(evRes.error.message);
  const eventIds = (evRes.data || []).map((e) => e.id).filter(Boolean);
  if (!eventIds.length) return { bookings: [], query: parsed };
  const bookings = await fetchRegistrations(sb, (q) => q.in('event_id', eventIds));
  return { bookings, query: parsed };
}

module.exports = {
  searchAdminBookings,
  mapBookingRow,
};
