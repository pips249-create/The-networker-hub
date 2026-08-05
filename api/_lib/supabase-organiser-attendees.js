const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { formatBookingReference } = require('./booking-payment-summary');
const {
  buildRegistrationRelationshipMap,
  relationshipForRegistration,
} = require('./organiser-attendee-relationship');

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
  const baseSelect = `
      id,
      created_at,
      event_id,
      organiser_id,
      attendee_id,
      payment_status,
      application_status,
      screening_answer_industry,
      screening_answer_job_title,
      application_denial_reason,
      application_decided_at,
      amount_paid,
      quantity,
      guest_names,
      cancelled_at,
      attendees ( name, email, company, business_sector, job_title ),
      events ( title, organiser_id, starts_at ),
      tickets ( name, price, ticket_type )
    `;
  const extrasSelect = `
      dietary_requirements,
      accessibility_requirements,
    `;

  async function fetchRows(includeExtras, eventFilterIds, profileMode) {
    let selectBase = baseSelect;
    if (profileMode === 'basic') {
      selectBase = selectBase.replace(
        'attendees ( name, email, company, business_sector, job_title )',
        'attendees ( name, email )'
      );
    } else if (profileMode === 'legacy') {
      selectBase = selectBase.replace(
        'attendees ( name, email, company, business_sector, job_title )',
        'attendees ( name, email, company, business_sector )'
      );
    }
    const select = includeExtras
      ? selectBase.replace('guest_names,', 'guest_names,\n' + extrasSelect)
      : selectBase;
    return sb
      .from('registrations')
      .select(select)
      .in('event_id', eventFilterIds)
      .is('cancelled_at', null);
  }

  async function fetchWithProfileFallback(includeExtras, eventFilterIds) {
    let result = await fetchRows(includeExtras, eventFilterIds, 'full');
    if (result.error && /job_title|column/.test(String(result.error.message || ''))) {
      result = await fetchRows(includeExtras, eventFilterIds, 'legacy');
    }
    if (
      result.error &&
      /company|business_sector|job_title|column/.test(String(result.error.message || ''))
    ) {
      result = await fetchRows(includeExtras, eventFilterIds, 'basic');
    }
    return result;
  }

  const viewingAll = targetIds.length === allowed.size;
  let historyRows;
  let data;
  let error;

  if (viewingAll) {
    ({ data, error } = await fetchWithProfileFallback(true, [...allowed]));
    if (
      error &&
      /dietary_requirements|accessibility_requirements|column/.test(String(error.message || ''))
    ) {
      ({ data, error } = await fetchWithProfileFallback(false, [...allowed]));
    }
    if (error) throw error;
    historyRows = data || [];
  } else {
    ({ data: historyRows, error } = await fetchWithProfileFallback(false, [...allowed]));
    if (error) throw error;

    ({ data, error } = await fetchWithProfileFallback(true, targetIds));
    if (
      error &&
      /dietary_requirements|accessibility_requirements|column/.test(String(error.message || ''))
    ) {
      ({ data, error } = await fetchWithProfileFallback(false, targetIds));
    }
    if (error) throw error;
  }

  const relationshipMap = buildRegistrationRelationshipMap(historyRows || []);

  const orgIds = [
    ...new Set(
      (data || [])
        .map((row) => String(row.organiser_id || row.events?.organiser_id || '').trim())
        .filter(Boolean)
    ),
  ];
  const rosterMemberKeys = new Set();
  const rosterIndustryByKey = new Map();
  if (orgIds.length) {
    const { normalizeRosterEmail, rosterRowIsActive } = require('./organiser-member-roster');
    let rosterRows = [];
    let rosterErr = null;
    ({ data: rosterRows, error: rosterErr } = await sb
      .from('organiser_member_roster')
      .select('organiser_id, email, status, expires_at, industry')
      .in('organiser_id', orgIds)
      .eq('status', 'active'));
    if (rosterErr && /industry|column/i.test(String(rosterErr.message || ''))) {
      ({ data: rosterRows, error: rosterErr } = await sb
        .from('organiser_member_roster')
        .select('organiser_id, email, status, expires_at')
        .in('organiser_id', orgIds)
        .eq('status', 'active'));
    }
    if (rosterErr) throw new Error(rosterErr.message);
    (rosterRows || []).forEach((row) => {
      if (!rosterRowIsActive(row)) return;
      const orgId = String(row.organiser_id || '').trim();
      const email = normalizeRosterEmail(row.email);
      if (orgId && email) {
        const key = orgId + '\0' + email;
        rosterMemberKeys.add(key);
        const industry = String(row.industry || '').trim();
        if (industry) rosterIndustryByKey.set(key, industry);
      }
    });
  }

  const { normalizeRosterEmail } = require('./organiser-member-roster');

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
      const ticketType = String(ticket.ticket_type || '').trim();
      const isCategoryExclusivityApplication =
        /application/i.test(ticketType) || /application to attend/i.test(ticketName.toLowerCase());
      const ticketPrice =
        ticket.price != null && ticket.price !== '' ? Number(String(ticket.price).replace(/[£,\s]/g, '')) : 0;
      const needsPayment =
        applicationStatus === 'Approved' &&
        paymentStatus === 'Pending' &&
        Number.isFinite(ticketPrice) &&
        ticketPrice > 0;

      const relationship = relationshipForRegistration(row, relationshipMap);
      const organiserId = String(row.organiser_id || event.organiser_id || '').trim();
      const rosterEmail = normalizeRosterEmail(email);
      const rosterKey = organiserId && rosterEmail ? organiserId + '\0' + rosterEmail : '';
      const isRosterMember = Boolean(rosterKey && rosterMemberKeys.has(rosterKey));
      const rosterIndustry = rosterKey ? rosterIndustryByKey.get(rosterKey) || '' : '';

      return {
        id: row.id,
        bookingReference: formatBookingReference(row.id),
        eventId: row.event_id,
        eventTitle: String(event.title || 'Event').trim(),
        eventDate: event.starts_at || '',
        name,
        email,
        company: String(attendee.company || '').trim(),
        jobTitle: String(attendee.job_title || '').trim(),
        businessSector: String(attendee.business_sector || '').trim(),
        rosterIndustry,
        guestNames,
        dietaryRequirements: String(row.dietary_requirements || '').trim(),
        accessibilityRequirements: String(row.accessibility_requirements || '').trim(),
        phone: '',
        ticketName,
        isCategoryExclusivityApplication,
        quantity: Math.max(1, Number(row.quantity) || 1),
        paymentStatus,
        applicationStatus,
        needsPayment,
        screeningIndustry: String(row.screening_answer_industry || '').trim(),
        screeningJobTitle: String(row.screening_answer_job_title || '').trim(),
        applicationDenialReason: String(row.application_denial_reason || '').trim(),
        applicationDecidedAt: row.application_decided_at || '',
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
        isRosterMember,
        groupRelationship: relationship.groupRelationship,
        priorVisitCount: relationship.priorVisitCount,
        visitCount:
          relationship.groupRelationship === 'unknown'
            ? null
            : Math.max(1, relationship.priorVisitCount + 1),
      };
    })
    .sort((a, b) => {
      const ta = a.registeredAt ? new Date(a.registeredAt).getTime() : 0;
      const tb = b.registeredAt ? new Date(b.registeredAt).getTime() : 0;
      return tb - ta;
    });
}

function cancellationRefundLabel(paymentStatus, amountPaid, refundStatus) {
  const status = String(paymentStatus || '').trim();
  const amount = Number(amountPaid) || 0;
  if (refundStatus === 'completed') return 'Refund issued';
  if (refundStatus === 'pending') return 'Refund required';
  if (status === 'Free' || amount <= 0) return 'Free ticket — no refund';
  return 'No refund due';
}

/**
 * List attendee-cancelled bookings for an organiser's groups.
 * Prefer event_id scoping (reliable for all registrations); fall back to organiser_id.
 *
 * @param {string[]} groupIds — organiser group ids for the signed-in workspace
 * @param {string|null} filterEventId — optional single event id, or "all"
 * @param {boolean} [adminView] — when true, return cancellations across the platform
 * @param {string[]} [eventIds] — event ids owned by the workspace (primary filter)
 */
async function listBookingCancellationsForOrganiserEvents(
  groupIds,
  filterEventId,
  adminView,
  eventIds
) {
  if (!isSupabaseConfigured()) return [];
  if (!adminView && !(eventIds && eventIds.length) && !(groupIds && groupIds.length)) return [];

  const sb = getSupabaseAdmin();
  let query = sb
    .from('registrations')
    .select(
      `
      id,
      created_at,
      cancelled_at,
      refund_email_sent_at,
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
    const ids = (eventIds || []).filter(Boolean);
    if (ids.length) {
      query = query.in('event_id', ids);
    } else if (groupIds && groupIds.length) {
      query = query.in('organiser_id', [...groupIds]);
    } else {
      return [];
    }
  }

  if (filterEventId && filterEventId !== 'all') {
    query = query.eq('event_id', filterEventId);
  }

  const { data, error } = await query.order('cancelled_at', { ascending: false });

  if (error) throw error;

  const { isRefundEligibleForCancellation, deriveRefundStatusForCancelledRegistration } =
    require('./cancellation-email-sections');

  return (data || [])
    .map((row) => {
      const attendee = row.attendees || {};
      const event = row.events || {};
      const ticket = row.tickets || {};
      const email = String(attendee.email || '').trim();
      const name =
        String(attendee.name || '').trim() || (email ? email.split('@')[0] : 'Attendee');
      const paymentStatus = String(row.payment_status || 'Pending').trim();
      const amountPaid = row.amount_paid != null ? Number(row.amount_paid) : 0;
      const refundEligible = isRefundEligibleForCancellation(event, row, row.cancelled_at);
      const refundStatus = deriveRefundStatusForCancelledRegistration(event, row) || 'none';

      return {
        id: row.id,
        organiserId: row.organiser_id,
        bookingReference: formatBookingReference(row.id),
        eventId: row.event_id,
        eventTitle: String(event.title || 'Event').trim(),
        eventDate: event.starts_at || '',
        name,
        email,
        ticketName: String(ticket.name || 'General admission').trim(),
        quantity: Math.max(1, Number(row.quantity) || 1),
        paymentStatus,
        amountPaid,
        amountDisplay: amountPaid > 0 ? '£' + amountPaid.toFixed(2) : 'Free',
        registeredAt: row.created_at || '',
        cancelledAt: row.cancelled_at || '',
        refundLabel: cancellationRefundLabel(paymentStatus, amountPaid, refundStatus),
        refundEligible,
        refundStatus,
      };
    });
}

/**
 * Lightweight pending-application summary for dashboard badges and notices.
 */
async function summarizePendingApplicationsForEventIds(eventIds) {
  if (!isSupabaseConfigured() || !eventIds.length) {
    return { count: 0, preview: [] };
  }

  const sb = getSupabaseAdmin();
  const { count, data, error } = await sb
    .from('registrations')
    .select(
      `
      id,
      event_id,
      screening_answer_industry,
      screening_answer_job_title,
      attendees ( name, email ),
      events ( title )
    `,
      { count: 'exact' }
    )
    .in('event_id', eventIds)
    .eq('application_status', 'Pending')
    .is('cancelled_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw new Error(error.message);

  const preview = (data || []).map((row) => {
    const attendee = row.attendees || {};
    const event = row.events || {};
    const email = String(attendee.email || '').trim();
    const name =
      String(attendee.name || '').trim() || (email ? email.split('@')[0] : 'Applicant');
    return {
      id: row.id,
      eventId: row.event_id,
      eventTitle: String(event.title || 'Event').trim(),
      name,
      screeningIndustry: String(row.screening_answer_industry || '').trim(),
      screeningJobTitle: String(row.screening_answer_job_title || '').trim(),
    };
  });

  return {
    count: count || 0,
    preview,
  };
}

module.exports = {
  listAttendeesForOrganiserEvents,
  listBookingCancellationsForOrganiserEvents,
  summarizePendingApplicationsForEventIds,
};
