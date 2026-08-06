const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { resolveAttendeeId } = require('./supabase-favourites');
const { buildStats } = require('./attendee');
const { eventHasEnded, isEligibleRegistration } = require('./supabase-reviews');
const {
  resolveEventDisplayImage,
  eventImageUrl,
  normalizeEventImagePosition,
} = require('./event-image');
const { formatBookingReference } = require('./booking-payment-summary');
const { resolveBookedListing } = require('./booking-snapshot');
const {
  isRefundEligibleForCancellation,
  isSelfServiceCancellationAllowed,
  deriveRefundStatusForCancelledRegistration,
} = require('./cancellation-email-sections');
const { listOpportunityEnquiriesSentBySession } = require('./supabase-opportunities');
const { listRosterGroupsForAttendee } = require('./organiser-member-roster');
const { reconcileCancelledRegistrationRefunds } = require('./reconcile-cancelled-refunds');
const { ticketIsApplication } = require('./supabase-application-submissions');

function deriveIsCategoryExclusivity(row) {
  const ev = row.events || {};
  const ticket = row.tickets || {};
  if (ticketIsApplication(ticket)) return true;
  const mode = String(ev.attendance_mode || '')
    .trim()
    .toLowerCase();
  return mode === 'category_exclusivity' || mode === 'osop';
}

function deriveReviewStatus(hasReview, row) {
  const ev = row.events || {};
  if (!eventHasEnded(ev)) return 'upcoming';
  if (hasReview) return 'reviewed';
  if (!isEligibleRegistration(row)) return 'ineligible';
  // Reviews attach to an organiser profile — orphan events cannot be reviewed.
  if (!ev.organiser_id) return 'ineligible';
  return 'pending';
}

function canCancelRegistration(row, ev) {
  return isSelfServiceCancellationAllowed(ev, row);
}

/** Focal point only applies when the display image is the event's own cover photo. */
function displayImagePosition(ev, displayImage) {
  if (!displayImage || displayImage !== eventImageUrl(ev)) return null;
  return normalizeEventImagePosition(ev.image_position) || null;
}

function mapRegistrationRow(row, reviewByEventId, seriesPeersByEventId) {
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
  const seriesPeers = seriesPeersByEventId ? seriesPeersByEventId.get(ev.id) || [] : [];
  const displayImage = resolveEventDisplayImage(ev, organiser, seriesPeers) || null;

  return {
    id: row.id,
    eventId,
    ticketId: row.ticket_id || ticket.id || '',
    slug: ev.slug || '',
    title: booked.title,
    date,
    endDate: booked.endDate,
    imageUrl: displayImage,
    imagePosition: displayImagePosition(ev, displayImage),
    organiserLogo: String(organiser.photo_url || '').trim() || null,
    eventType: String(ev.event_type || '').trim() || null,
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
    refundEligible: isRefundEligibleForCancellation(ev, row),
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
    city: String(ev.city || booked.eventRow?.city || '').trim() || null,
    address: String(ev.address || booked.eventRow?.address || '').trim() || null,
    postcode: String(ev.postcode || booked.eventRow?.postcode || '').trim() || null,
    venueName:
      String(ev.venue || booked.eventRow?.venue || ev.venue_name || booked.eventRow?.venue_name || '').trim() ||
      null,
    isCategoryExclusivity: deriveIsCategoryExclusivity(row),
    bookingGroupId: row.booking_group_id || null,
    registrationKind: String(row.registration_kind || 'standard').trim(),
  };
}

function mapCancelledRegistrationRow(row, seriesPeersByEventId) {
  const ev = row.events || {};
  const organiser = ev.organisers || {};
  const ticket = row.tickets || {};
  const eventId = row.event_id || ev.id || '';
  const booked = resolveBookedListing({ registration: row, eventRow: ev, ticketRow: ticket });
  const paymentStatus = String(row.payment_status || 'Pending').trim();
  const amountPaid = booked.amountPaid;
  const refundStatus = deriveRefundStatusForCancelledRegistration(ev, row);
  let refundLabel = 'Cancelled';
  if (refundStatus === 'pending') {
    refundLabel = 'Refund on its way';
  } else if (refundStatus === 'completed') {
    refundLabel = 'Refunded';
  } else if (amountPaid > 0) {
    refundLabel = 'Cancelled — no refund due';
  }
  const seriesPeers = seriesPeersByEventId ? seriesPeersByEventId.get(ev.id) || [] : [];
  const displayImage = resolveEventDisplayImage(ev, organiser, seriesPeers) || null;

  return {
    id: row.id,
    eventId,
    ticketId: row.ticket_id || ticket.id || '',
    slug: ev.slug || '',
    title: booked.title,
    date: booked.date,
    endDate: booked.endDate,
    imageUrl: displayImage,
    imagePosition: displayImagePosition(ev, displayImage),
    organiserLogo: String(organiser.photo_url || '').trim() || null,
    eventType: String(ev.event_type || '').trim() || null,
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
      booking_group_id,
      registration_kind,
      events (
        id,
        title,
        slug,
        starts_at,
        ends_at,
        status,
        image_url,
        image_position,
        photo_url,
        series_group_id,
        event_type,
        attendance_mode,
        city,
        address,
        postcode,
        venue,
        recurrence_pattern,
        recurrence_end_date,
        organiser_id,
        meeting_link,
        meeting_type,
        refund_policy,
        refund_policy_details,
        refund_cutoff_days,
        organisers (
          id,
          name,
          slug,
          photo_url
        )
      ),
      tickets (
        id,
        name,
        price,
        ticket_type
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
      organiser_id,
      stripe_payment_intent_id,
      events (
        id,
        title,
        slug,
        starts_at,
        ends_at,
        status,
        image_url,
        image_position,
        photo_url,
        series_group_id,
        event_type,
        recurrence_pattern,
        recurrence_end_date,
        organiser_id,
        refund_policy,
        refund_policy_details,
        refund_cutoff_days,
        organisers (
          id,
          name,
          slug,
          photo_url
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

async function fetchSeriesPeerImageRows(sb, eventRow) {
  if (!eventRow?.id) return [];
  const cols =
    'id, series_group_id, organiser_id, title, image_url, photo_url, recurrence_pattern, recurrence_end_date';

  if (eventRow.series_group_id) {
    const { data, error } = await sb
      .from('events')
      .select(cols)
      .eq('series_group_id', eventRow.series_group_id)
      .neq('id', eventRow.id);
    if (!error && data?.length) return data;
  }

  const titleKey = String(eventRow.title || '')
    .trim()
    .toLowerCase();
  const organiserId = eventRow.organiser_id || '';
  if (!titleKey || !organiserId) return [];

  const pattern = String(eventRow.recurrence_pattern || '').trim().toLowerCase();
  const endDate = String(eventRow.recurrence_end_date || '')
    .trim()
    .slice(0, 10);

  const { data, error } = await sb
    .from('events')
    .select(cols)
    .eq('organiser_id', organiserId)
    .neq('id', eventRow.id);
  if (error) throw new Error(error.message);

  return (data || []).filter((peer) => {
    if (
      String(peer.title || '')
        .trim()
        .toLowerCase() !== titleKey
    ) {
      return false;
    }
    if (pattern && endDate) {
      return (
        String(peer.recurrence_pattern || '').trim().toLowerCase() === pattern &&
        String(peer.recurrence_end_date || '')
          .trim()
          .slice(0, 10) === endDate
      );
    }
    return true;
  });
}

async function loadSeriesPeersByEventId(sb, rows) {
  const map = new Map();
  const seen = new Set();
  const events = [];
  for (const row of rows || []) {
    const ev = row.events;
    if (!ev?.id || seen.has(ev.id)) continue;
    seen.add(ev.id);
    events.push(ev);
  }

  await Promise.all(
    events.map(async (ev) => {
      const peers = await fetchSeriesPeerImageRows(sb, ev);
      map.set(ev.id, peers);
    })
  );
  return map;
}

async function getAttendeeDashboardFromSupabase(session) {
  if (!isSupabaseConfigured()) {
    return {
      registrations: [],
      cancelledBookings: [],
      stats: buildStats([]),
      opportunityEnquiries: [],
      myGroups: [],
    };
  }

  const sb = getSupabaseAdmin();
  const email = String(session.email || '')
    .trim()
    .toLowerCase();
  const [attendeeId, opportunityEnquiries, myGroups] = await Promise.all([
    resolveAttendeeId(sb, session),
    listOpportunityEnquiriesSentBySession(session).catch(() => []),
    listRosterGroupsForAttendee(email).catch(() => []),
  ]);

  if (!attendeeId) {
    return {
      registrations: [],
      cancelledBookings: [],
      stats: buildStats([]),
      opportunityEnquiries,
      myGroups,
    };
  }

  const [rows, cancelledRowsRaw, reviewByEventId] = await Promise.all([
    listRegistrationsForAttendee(sb, attendeeId),
    listCancelledRegistrationsForAttendee(sb, attendeeId),
    listReviewsForAttendee(sb, attendeeId),
  ]);

  const cancelledRows = await reconcileCancelledRegistrationRefunds(sb, cancelledRowsRaw);
  const seriesPeersByEventId = await loadSeriesPeersByEventId(sb, [...rows, ...cancelledRows]);

  const registrations = rows.map((row) => mapRegistrationRow(row, reviewByEventId, seriesPeersByEventId));
  const cancelledBookings = cancelledRows.map((row) =>
    mapCancelledRegistrationRow(row, seriesPeersByEventId)
  );
  return {
    registrations,
    cancelledBookings,
    stats: buildStats(registrations),
    opportunityEnquiries,
    myGroups,
  };
}

module.exports = {
  getAttendeeDashboardFromSupabase,
  deriveReviewStatus,
  mapRegistrationRow,
};
