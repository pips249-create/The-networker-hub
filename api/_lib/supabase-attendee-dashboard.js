const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { resolveAttendeeId } = require('./supabase-favourites');
const { buildStats } = require('./attendee');
const { eventHasEnded, isEligibleRegistration } = require('./supabase-reviews');
const { eventImageUrl } = require('./event-image');
const { formatBookingReference } = require('./booking-payment-summary');
const {
  formatRefundPolicyLabel,
  formatRefundPolicyText,
} = require('./event-refund-policy');
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

const { isOnlineEvent } = require('./event-refund-policy');

function parsePriceNum(raw) {
  if (raw == null || raw === '') return 0;
  const n = Number(String(raw).replace(/[£,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function mapRegistrationRow(row, reviewByEventId) {
  const ev = row.events || {};
  const organiser = ev.organisers || {};
  const ticket = row.tickets || {};
  const eventId = row.event_id || ev.id || '';
  const review = reviewByEventId.get(eventId);
  const date = ev.starts_at || null;
  const ticketName = String(ticket.name || 'General Admission').trim();
  const qty = Math.max(1, Number(row.quantity) || 1);
  const ticketPriceNum = parsePriceNum(ticket.price);
  const applicationStatus = String(row.application_status || 'Approved').trim();
  const paymentStatus = String(row.payment_status || 'Pending').trim();
  const amountPaid = row.amount_paid != null ? Number(row.amount_paid) : 0;
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
  const meetingLink = String(row.meeting_link || ev.meeting_link || '').trim();
  const online = isOnlineEvent(ev, meetingLink);

  return {
    id: row.id,
    eventId,
    ticketId: row.ticket_id || ticket.id || '',
    slug: ev.slug || '',
    title: ev.title || 'Event',
    date,
    endDate: ev.ends_at || null,
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
    refundPolicy: ev.refund_policy || null,
    refundPolicyDetails: ev.refund_policy_details || null,
    refundCutoffDays: ev.refund_cutoff_days != null ? Number(ev.refund_cutoff_days) : null,
    refundPolicyLabel: formatRefundPolicyLabel(ev) || 'Refund policy',
    refundPolicyText: formatRefundPolicyText(ev),
    refundEligible: isRefundEligibleForCancellation(ev, row),
    isCancelled: false,
    cancelledAt: null,
    refundStatus: null,
    isPaid:
      String(row.payment_status || '').trim() === 'Paid' &&
      Number(row.amount_paid) > 0,
    isOnline: online,
    meetingLink: online ? meetingLink : '',
    meetingType: ev.meeting_type || (online ? 'Online' : 'In person'),
  };
}

function mapCancelledRegistrationRow(row) {
  const ev = row.events || {};
  const organiser = ev.organisers || {};
  const ticket = row.tickets || {};
  const eventId = row.event_id || ev.id || '';
  const date = ev.starts_at || null;
  const ticketName = String(ticket.name || 'General Admission').trim();
  const qty = Math.max(1, Number(row.quantity) || 1);
  const paymentStatus = String(row.payment_status || 'Pending').trim();
  const amountPaid = row.amount_paid != null ? Number(row.amount_paid) : 0;
  const refundStatus = deriveRefundStatusForCancelledRegistration(ev, row);

  return {
    id: row.id,
    eventId,
    ticketId: row.ticket_id || ticket.id || '',
    slug: ev.slug || '',
    title: ev.title || 'Event',
    date,
    endDate: ev.ends_at || null,
    imageUrl: eventImageUrl(ev) || null,
    ticketLabel: qty + ' × ' + ticketName,
    quantity: qty,
    paymentStatus,
    applicationStatus: row.application_status || 'Approved',
    amountPaid,
    createdAt: row.created_at || null,
    bookingReference: formatBookingReference(row.id),
    organiserId: ev.organiser_id || organiser.id || '',
    organiserName: organiser.name || '',
    organiserSlug: organiser.slug || '',
    canCancel: false,
    refundPolicy: ev.refund_policy || null,
    refundPolicyText: formatRefundPolicyText(ev),
    isPaid:
      String(row.payment_status || '').trim() === 'Paid' &&
      Number(row.amount_paid) > 0,
    isCancelled: true,
    cancelledAt: row.cancelled_at || null,
    refundStatus,
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
  const since = new Date();
  since.setDate(since.getDate() - 90);
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
    .gte('cancelled_at', since.toISOString())
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
