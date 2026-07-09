const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { resolveAttendeeId } = require('./supabase-favourites');
const { buildStats } = require('./attendee');
const { eventHasEnded, isEligibleRegistration } = require('./supabase-reviews');
const { eventImageUrl } = require('./event-image');
const { formatBookingReference } = require('./booking-payment-summary');
const { resolveBookedListing } = require('./booking-snapshot');
const {
  isRefundEligibleForCancellation,
  isSelfServiceCancellationAllowed,
  deriveRefundStatusForCancelledRegistration,
} = require('./cancellation-email-sections');
const { listOpportunityEnquiriesSentBySession } = require('./supabase-opportunities');

function deriveReviewStatus(hasReview, row) {
  const ev = row.events || {};
  if (!eventHasEnded(ev)) return 'upcoming';
  if (hasReview) return 'reviewed';
  if (!isEligibleRegistration(row)) return 'ineligible';
  return 'pending';
}

function canCancelRegistration(row, ev) {
  return isSelfServiceCancellationAllowed(ev, row);
}

function mapRegistrationRow(row, reviewByEventId) {
  const ev = row.events || {};
  const organiser = ev.organisers || {};
  const ticket = row.tickets || {};
  const eventId = row.event_id || ev.id || '';
  const review = reviewByEventId.get(eventId);
  const booked = resolveBookedListing({ registration: row, eventRow: ev, ticketRow: ticket });
  const date = booked.date;
  const ticketName = booked.ticketName;
  const qty = booked.quantity;
  const ticketPriceNum = booked.ticketPriceNum;
  const applicationStatus = String(row.application_status || 'Approved').trim();
  const paymentStatus = String(row.payment_status || 'Pending').trim();
  const amountPaid = booked.amountPaid;
  const bookingComplete =
    paymentStatus === 'Paid' || paymentStatus === 'Free' || amountPaid > 0;
  const needsPayment =
    !bookingComplete &&
    applicationStatus === 'Approved' &&
    paymentStatus === 'Pending' &&
    ticketPriceNum > 0;
  const needsFreeConfirmation =
    !bookingComplete &&
    applicationStatus === 'Approved' &&
    paymentStatus === 'Pending' &&
    ticketPriceNum <= 0;
  const meetingLink = booked.meetingLink;
  const online = booked.isOnline;

  return {
    id: row.id,
    eventId,
    ticketId: row.ticket_id || ticket.id || '',
    slug: ev.slug || '',
    title: booked.title,
    date,
    endDate: booked.endDate,
    imageUrl: eventImageUrl(ev) || null,
    ticketLabel: qty + ' × ' + ticketName,
    quantity: qty,
    paymentStatus: row.payment_status || 'Pending',
    applicationStatus: row.application_status || 'Approved',
    ticketPriceNum,
    needsPayment,
    needsFreeConfirmation,
    amountPaid,
    createdAt: row.created_at || null,
    bookingReference: formatBookingReference(row.id),
    organiserId: ev.organiser_id || organiser.id || '',
    organiserName: organiser.name || '',
    organiserSlug: organiser.slug || '',
    reviewStatus: deriveReviewStatus(Boolean(review), row),
    rating: review?.rating ?? null,
    reviewText: review?.reviewText ?? null,
    organiserResponse: review?.organiserResponse ?? null,
    canReview: deriveReviewStatus(Boolean(review), row) === 'pending',
    canCancel: canCancelRegistration(row, ev),
    refundPolicy: booked.refundPolicy,
    refundPolicyDetails: booked.refundPolicyDetails,
    refundCutoffDays: booked.refundCutoffDays,
    refundPolicyLabel: booked.refundPolicyLabel,
    refundPolicyText: booked.refundPolicyText,
    refundEligible: isRefundEligibleForCancellation(booked.eventRow, row),
    isCancelled: false,
    cancelledAt: null,
    refundStatus: null,
    isPaid:
      String(row.payment_status || '').trim() === 'Paid' &&
      Number(row.amount_paid) > 0,
    isOnline: online,
    meetingLink: online ? meetingLink : '',
    meetingType: booked.eventRow.meeting_type || (online ? 'Online' : 'In person'),
    bookedSnapshotAt: booked.snapshotCapturedAt,
  };
}

function mapCancelledRegistrationRow(row) {
  const ev = row.events || {};
  const organiser = ev.organisers || {};
  const ticket = row.tickets || {};
  const eventId = row.event_id || ev.id || '';
  const booked = resolveBookedListing({ registration: row, eventRow: ev, ticketRow: ticket });
  const paymentStatus = String(row.payment_status || 'Pending').trim();
  const amountPaid = booked.amountPaid;
  const refundStatus = deriveRefundStatusForCancelledRegistration(booked.eventRow, row);
  let refundLabel = 'Cancelled';
  if (refundStatus === 'pending') {
    refundLabel = 'Refund on its way';
  } else if (refundStatus === 'completed') {
    refundLabel = 'Refunded';
  } else if (amountPaid > 0) {
    refundLabel = 'Cancelled — no refund due';
  }

  return {
    id: row.id,
    eventId,
    ticketId: row.ticket_id || ticket.id || '',
    slug: ev.slug || '',
    title: booked.title,
    date: booked.date,
    endDate: booked.endDate,
    imageUrl: eventImageUrl(ev) || null,
    ticketLabel: booked.quantity + ' × ' + booked.ticketName,
    quantity: booked.quantity,
    paymentStatus,
    applicationStatus: row.application_status || 'Approved',
    amountPaid,
    createdAt: row.created_at || null,
    bookingReference: formatBookingReference(row.id),
    organiserId: ev.organiser_id || organiser.id || '',
    organiserName: organiser.name || '',
    organiserSlug: organiser.slug || '',
    canCancel: false,
    refundPolicy: booked.refundPolicy,
    refundPolicyText: booked.refundPolicyText,
    isPaid:
      String(row.payment_status || '').trim() === 'Paid' &&
      Number(row.amount_paid) > 0,
    isCancelled: true,
    cancelledAt: row.cancelled_at || null,
    refundStatus,
    refundLabel,
    refundPolicyLabel: booked.refundPolicyLabel || '',
    bookedSnapshotAt: booked.snapshotCapturedAt,
  };
}

async function listRegistrationsForAttendee(sb, attendeeId) {
  const res = await sb
    .from('registrations')
    .select(
      `
      id,
      created_at,
      event_id,
      ticket_id,
      payment_status,
      application_status,
      amount_paid,
      quantity,
      booked_snapshot,
      events (
        id,
        title,
        slug,
        starts_at,
        ends_at,
        status,
        image_url,
        photo_url,
        organiser_id,
        meeting_link,
        meeting_type,
        refund_policy,
        refund_policy_details,
        refund_cutoff_days,
        organisers (
          id,
          name,
          slug
        )
      ),
      tickets (
        id,
        name,
        price
      )
    `
    )
    .eq('attendee_id', attendeeId)
    .neq('payment_status', 'Refunded')
    .is('cancelled_at', null)
    .order('created_at', { ascending: false });

  if (res.error) throw new Error(res.error.message);
  return res.data || [];
}

async function listCancelledRegistrationsForAttendee(sb, attendeeId) {
  const res = await sb
    .from('registrations')
    .select(
      `
      id,
      created_at,
      cancelled_at,
      refund_email_sent_at,
      event_id,
      ticket_id,
      payment_status,
      application_status,
      amount_paid,
      quantity,
      booked_snapshot,
      events (
        id,
        title,
        slug,
        starts_at,
        ends_at,
        status,
        image_url,
        photo_url,
        organiser_id,
        refund_policy,
        refund_policy_details,
        refund_cutoff_days,
        organisers (
          id,
          name,
          slug
        )
      ),
      tickets (
        id,
        name,
        price
      )
    `
    )
    .eq('attendee_id', attendeeId)
    .not('cancelled_at', 'is', null)
    .order('cancelled_at', { ascending: false });

  if (res.error) throw new Error(res.error.message);
  return res.data || [];
}

async function listReviewsForAttendee(sb, attendeeId) {
  const res = await sb
    .from('reviews')
    .select('event_id, rating, review_text, organiser_response')
    .eq('attendee_id', attendeeId);
  if (res.error) throw new Error(res.error.message);
  const map = new Map();
  (res.data || []).forEach((row) => {
    if (row.event_id) {
      map.set(row.event_id, {
        rating: row.rating,
        reviewText: row.review_text,
        organiserResponse: row.organiser_response,
      });
    }
  });
  return map;
}

async function getAttendeeDashboardFromSupabase(session) {
  if (!isSupabaseConfigured()) {
    return {
      registrations: [],
      cancelledBookings: [],
      stats: buildStats([]),
      opportunityEnquiries: [],
    };
  }

  const sb = getSupabaseAdmin();
  const [attendeeId, opportunityEnquiries] = await Promise.all([
    resolveAttendeeId(sb, session),
    listOpportunityEnquiriesSentBySession(session).catch(() => []),
  ]);

  if (!attendeeId) {
    return {
      registrations: [],
      cancelledBookings: [],
      stats: buildStats([]),
      opportunityEnquiries,
    };
  }

  const [rows, cancelledRows, reviewByEventId] = await Promise.all([
    listRegistrationsForAttendee(sb, attendeeId),
    listCancelledRegistrationsForAttendee(sb, attendeeId),
    listReviewsForAttendee(sb, attendeeId),
  ]);

  const registrations = rows.map((row) => mapRegistrationRow(row, reviewByEventId));
  const cancelledBookings = cancelledRows.map((row) => mapCancelledRegistrationRow(row));
  return {
    registrations,
    cancelledBookings,
    stats: buildStats(registrations),
    opportunityEnquiries,
  };
}

module.exports = {
  getAttendeeDashboardFromSupabase,
  deriveReviewStatus,
  mapRegistrationRow,
};
