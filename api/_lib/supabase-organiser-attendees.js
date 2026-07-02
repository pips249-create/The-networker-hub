const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { formatBookingReference } = require('./booking-payment-summary');

/**
 * List registrations for the signed-in organiser's events (Supabase).
 *
 * @param {string[]} eventIds
 * @param {string|null} filterEventId — optional single event id, or "all"
 */
async function listAttendeesForOrganiserEvents(eventIds, filterEventId) {
  if (!isSupabaseConfigured() || !eventIds.length) return [];

  const allowed = new Set(eventIds);
  if (filterEventId && filterEventId !== 'all' && !allowed.has(filterEventId)) {
    return [];
  }

  const targetIds =
    filterEventId && filterEventId !== 'all' ? [filterEventId] : [...allowed];

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('registrations')
    .select(
      `
      id,
      created_at,
      event_id,
      payment_status,
      application_status,
      screening_answer_industry,
      screening_answer_job_title,
      application_denial_reason,
      amount_paid,
      quantity,
      guest_names,
      dietary_requirements,
      accessibility_requirements,
      cancelled_at,
      attendees ( name, email ),
      events ( title ),
      tickets ( name, price )
    `
    )
    .in('event_id', targetIds)
    .is('cancelled_at', null);

  if (error) throw error;

  return (data || [])
    .filter((row) => allowed.has(row.event_id))
    .map((row) => {
      const attendee = row.attendees || {};
      const event = row.events || {};
      const ticket = row.tickets || {};
      const email = String(attendee.email || '').trim();
      const name =
        String(attendee.name || '').trim() || (email ? email.split('@')[0] : 'Attendee');

      const paymentStatus = String(row.payment_status || 'Pending').trim();
      const applicationStatus = String(row.application_status || 'Approved').trim();
      const amountPaid = row.amount_paid != null ? Number(row.amount_paid) : 0;
      const guestNames = Array.isArray(row.guest_names)
        ? row.guest_names.map((n) => String(n || '').trim()).filter(Boolean)
        : [];

      const ticketName = String(ticket.name || 'General admission').trim();
      const ticketPrice =
        ticket.price != null && ticket.price !== '' ? Number(String(ticket.price).replace(/[£,\s]/g, '')) : 0;
      const needsPayment =
        applicationStatus === 'Approved' &&
        paymentStatus === 'Pending' &&
        Number.isFinite(ticketPrice) &&
        ticketPrice > 0;

      return {
        id: row.id,
        bookingReference: formatBookingReference(row.id),
        eventId: row.event_id,
        eventTitle: String(event.title || 'Event').trim(),
        name,
        email,
        guestNames,
        dietaryRequirements: String(row.dietary_requirements || '').trim(),
        accessibilityRequirements: String(row.accessibility_requirements || '').trim(),
        phone: '',
        ticketName,
        quantity: Math.max(1, Number(row.quantity) || 1),
        paymentStatus,
        applicationStatus,
        needsPayment,
        screeningIndustry: String(row.screening_answer_industry || '').trim(),
        screeningJobTitle: String(row.screening_answer_job_title || '').trim(),
        applicationDenialReason: String(row.application_denial_reason || '').trim(),
        amountPaid,
        amountDisplay:
          applicationStatus === 'Pending'
            ? 'Application pending'
            : needsPayment
              ? 'Awaiting payment'
              : amountPaid > 0
                ? '£' + amountPaid.toFixed(2)
                : 'Free',
        registeredAt: row.created_at || '',
      };
    })
    .sort((a, b) => {
      const ta = a.registeredAt ? new Date(a.registeredAt).getTime() : 0;
      const tb = b.registeredAt ? new Date(b.registeredAt).getTime() : 0;
      return tb - ta;
    });
}

function cancellationRefundLabel(paymentStatus, amountPaid, refundEligible) {
  const status = String(paymentStatus || '').trim();
  const amount = Number(amountPaid) || 0;
  if (status === 'Free' || amount <= 0) return 'Free ticket — no refund';
  if (refundEligible) return 'Refund may be due';
  return 'No refund due';
}

/**
 * List attendee-cancelled bookings for an organiser's groups.
 * Uses registrations.organiser_id (not a large event_id IN list) so admin view
 * does not overflow Supabase request headers when many events exist.
 *
 * @param {string[]} groupIds — organiser group ids for the signed-in workspace
 * @param {string|null} filterEventId — optional single event id, or "all"
 * @param {boolean} [adminView] — when true, return cancellations across the platform
 */
async function listBookingCancellationsForOrganiserEvents(groupIds, filterEventId, adminView) {
  if (!isSupabaseConfigured()) return [];
  if (!adminView && !(groupIds && groupIds.length)) return [];

  const allowedOrganisers = adminView ? null : new Set(groupIds);

  const sb = getSupabaseAdmin();
  let query = sb
    .from('registrations')
    .select(
      `
      id,
      created_at,
      cancelled_at,
      event_id,
      organiser_id,
      payment_status,
      amount_paid,
      quantity,
      attendees ( name, email ),
      events ( title, refund_policy, refund_policy_details, refund_cutoff_days, starts_at ),
      tickets ( name )
    `
    )
    .not('cancelled_at', 'is', null);

  if (!adminView) {
    query = query.in('organiser_id', [...groupIds]);
  }

  if (filterEventId && filterEventId !== 'all') {
    query = query.eq('event_id', filterEventId);
  }

  const { data, error } = await query.order('cancelled_at', { ascending: false });

  if (error) throw error;

  const { isRefundEligibleForCancellation } = require('./cancellation-email-sections');

  return (data || [])
    .filter((row) => !allowedOrganisers || allowedOrganisers.has(row.organiser_id))
    .map((row) => {
      const attendee = row.attendees || {};
      const event = row.events || {};
      const ticket = row.tickets || {};
      const email = String(attendee.email || '').trim();
      const name =
        String(attendee.name || '').trim() || (email ? email.split('@')[0] : 'Attendee');
      const paymentStatus = String(row.payment_status || 'Pending').trim();
      const amountPaid = row.amount_paid != null ? Number(row.amount_paid) : 0;
      const refundEligible = isRefundEligibleForCancellation(event, row);

      return {
        id: row.id,
        bookingReference: formatBookingReference(row.id),
        eventId: row.event_id,
        eventTitle: String(event.title || 'Event').trim(),
        name,
        email,
        ticketName: String(ticket.name || 'General admission').trim(),
        quantity: Math.max(1, Number(row.quantity) || 1),
        paymentStatus,
        amountPaid,
        amountDisplay: amountPaid > 0 ? '£' + amountPaid.toFixed(2) : 'Free',
        registeredAt: row.created_at || '',
        cancelledAt: row.cancelled_at || '',
        refundLabel: cancellationRefundLabel(paymentStatus, amountPaid, refundEligible),
        refundEligible,
      };
    });
}

module.exports = {
  listAttendeesForOrganiserEvents,
  listBookingCancellationsForOrganiserEvents,
};
