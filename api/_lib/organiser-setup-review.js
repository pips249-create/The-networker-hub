const { getSupabaseAdmin } = require('./supabase');
const {
  normalizeAttendanceMode,
  expandEventIdsToSeriesPeers,
} = require('./supabase-organiser-events');
const { formatRefundPolicyLabel, formatRefundPolicyText } = require('./event-refund-policy');
const { getMembershipPlanForOrganiser } = require('./membership-billing');
const { isMembersOnlyTicket } = require('./ticket-visibility');
const { acceptOrganiserTerms, CURRENT_ORGANISER_TERMS_VERSION } = require('./supabase-auth');
function formatTicketPrice(price) {
  const n = Number(price);
  if (!Number.isFinite(n)) return '—';
  if (n <= 0) return 'Free';
  return '£' + n.toFixed(n % 1 === 0 ? 0 : 2);
}

function vatTreatmentLabel(value) {
  const v = String(value || '').trim();
  if (v === 'included') return 'VAT included in ticket prices';
  if (v === 'added') return 'VAT added at checkout (+20%)';
  if (v === 'none') return 'Not VAT registered';
  return '';
}

function isInternalTicket(ticket) {
  const type = String(ticket?.ticketType || ticket?.ticket_type || '').trim();
  const name = String(ticket?.name || '').trim();
  if (/guest-visit/i.test(type) || /^guest\s*visit$/i.test(name)) return true;
  if (type === 'Alumni' || /^alumni/i.test(name)) return true;
  return false;
}

function inferPayHowLabel(tickets, membershipPlan) {
  const publicTiers = (tickets || []).filter((t) => !isMembersOnlyTicket(t) && !isInternalTicket(t));
  const memberTiers = (tickets || []).filter((t) => isMembersOnlyTicket(t));
  const hasMembership =
    membershipPlan &&
    (Number(membershipPlan.monthly?.amountPounds) > 0 ||
      Number(membershipPlan.annual?.amountPounds) > 0 ||
      membershipPlan.offered);
  const hasPublicTickets = publicTiers.length > 0;
  if (hasPublicTickets && hasMembership) return 'Ticket and membership';
  if (hasMembership && !hasPublicTickets) return 'Free visits, then membership';
  if (memberTiers.length > 0 && publicTiers.length === 0) return 'Closed member list';
  return 'Ticket for this event';
}

function bookingPathLabel(eventRow, tickets, membershipPlan) {
  const mode = normalizeAttendanceMode(eventRow?.attendance_mode);
  const payHow = inferPayHowLabel(tickets, membershipPlan);
  if (mode === 'category_exclusivity') {
    return 'Application based — ' + payHow;
  }
  if (mode === 'membership_meeting') {
    return 'General ticketing — membership';
  }
  if (mode === 'guest_programme') {
    return 'General ticketing — with free trial visits';
  }
  const memberOnly =
    (tickets || []).filter((t) => !isInternalTicket(t)).length > 0 &&
    (tickets || []).every((t) => isInternalTicket(t) || isMembersOnlyTicket(t));
  if (memberOnly) return 'General ticketing — closed member list';
  return 'General ticketing — ' + payHow;
}

function mapReviewTicket(ticket) {
  return {
    id: ticket.id,
    name: String(ticket.name || 'Ticket').trim(),
    price: ticket.price != null ? String(ticket.price) : '',
    priceLabel: formatTicketPrice(ticket.price),
    ticketType: ticket.ticketType || ticket.ticket_type || 'Standard',
    visibility: ticket.visibility || 'public',
  };
}

function buildSetupReviewItem(eventRow, tickets, membershipPlan) {
  const displayTickets = (tickets || [])
    .filter((t) => !isInternalTicket(t))
    .map(mapReviewTicket);
  const membershipLines = [];
  if (membershipPlan) {
    const monthly = membershipPlan.monthly?.amountPounds;
    const annual = membershipPlan.annual?.amountPounds;
    if (monthly != null && Number(monthly) >= 0) {
      membershipLines.push({
        label: 'Monthly membership',
        priceLabel: Number(monthly) > 0 ? formatTicketPrice(monthly) + '/month' : 'Free via member list',
      });
    }
    if (annual != null && Number(annual) > 0) {
      membershipLines.push({
        label: 'Annual membership',
        priceLabel: formatTicketPrice(annual) + '/year',
      });
    }
  }
  return {
    eventId: eventRow.id,
    title: String(eventRow.title || 'Event').trim(),
    startsAt: eventRow.starts_at || null,
    organiserGroupId: eventRow.organiser_id || null,
    bookingPath: bookingPathLabel(eventRow, tickets, membershipPlan),
    tickets: displayTickets,
    membership: membershipLines,
    refundPolicy: eventRow.refund_policy || null,
    refundPolicyLabel: formatRefundPolicyLabel(eventRow),
    refundPolicyText: formatRefundPolicyText(eventRow),
    refundCutoffDays:
      eventRow.refund_cutoff_days != null ? Number(eventRow.refund_cutoff_days) : null,
    vatTreatment: eventRow.vat_treatment || null,
    vatTreatmentLabel: vatTreatmentLabel(eventRow.vat_treatment),
    attendanceMode: normalizeAttendanceMode(eventRow.attendance_mode),
  };
}

async function listOrganiserSetupReviews(groupIds) {
  const ids = (groupIds || []).map((id) => String(id || '').trim()).filter(Boolean);
  if (!ids.length) return [];

  const sb = getSupabaseAdmin();
  const { data: events, error } = await sb
    .from('events')
    .select(
      'id, title, starts_at, organiser_id, attendance_mode, refund_policy, refund_policy_details, refund_cutoff_days, vat_treatment, series_group_id'
    )
    .in('organiser_id', ids)
    .eq('needs_organiser_setup_review', true)
    .order('starts_at', { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  if (!events || !events.length) return [];

  const eventIds = events.map((row) => row.id);
  const { data: ticketRows, error: ticketErr } = await sb
    .from('tickets')
    .select('id, event_id, name, price, ticket_type, visibility, display_order')
    .in('event_id', eventIds)
    .order('display_order', { ascending: true });
  if (ticketErr) throw new Error(ticketErr.message);

  const ticketsByEvent = new Map();
  (ticketRows || []).forEach((row) => {
    if (!ticketsByEvent.has(row.event_id)) ticketsByEvent.set(row.event_id, []);
    ticketsByEvent.get(row.event_id).push(row);
  });

  const organiserIds = [...new Set(events.map((row) => row.organiser_id).filter(Boolean))];
  const plansByOrganiser = new Map();
  await Promise.all(
    organiserIds.map(async (orgId) => {
      try {
        const plan = await getMembershipPlanForOrganiser(orgId);
        plansByOrganiser.set(orgId, plan);
      } catch {
        plansByOrganiser.set(orgId, null);
      }
    })
  );

  const seenSeries = new Set();
  const reviews = [];
  for (const row of events) {
    const seriesKey = row.series_group_id ? String(row.series_group_id) : row.id;
    if (seenSeries.has(seriesKey)) continue;
    seenSeries.add(seriesKey);
    const tickets = ticketsByEvent.get(row.id) || [];
    if (!tickets.length) continue;
    reviews.push(
      buildSetupReviewItem(row, tickets, plansByOrganiser.get(row.organiser_id) || null)
    );
  }
  return reviews;
}

async function acceptOrganiserEventSetup({ userId, eventId, groupIds }) {
  const id = String(eventId || '').trim();
  if (!id) {
    const err = new Error('missing_event');
    err.status = 400;
    throw err;
  }
  const allowedGroups = new Set((groupIds || []).map((g) => String(g || '').trim()).filter(Boolean));
  const sb = getSupabaseAdmin();

  const { data: eventRow, error: loadErr } = await sb
    .from('events')
    .select('id, organiser_id, needs_organiser_setup_review, refund_policy')
    .eq('id', id)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!eventRow) {
    const err = new Error('event_not_found');
    err.status = 404;
    throw err;
  }
  if (!allowedGroups.has(String(eventRow.organiser_id || ''))) {
    const err = new Error('event_not_owned');
    err.status = 403;
    throw err;
  }
  if (!eventRow.needs_organiser_setup_review) {
    const err = new Error('setup_review_not_required');
    err.status = 400;
    throw err;
  }

  const peerIds = await expandEventIdsToSeriesPeers(sb, [id]);
  const now = new Date().toISOString();
  const patch = {
    needs_organiser_setup_review: false,
    refund_terms_agreed: true,
    refund_terms_agreed_at: now,
  };
  const { error: updateErr } = await sb.from('events').update(patch).in('id', peerIds);
  if (updateErr) throw new Error(updateErr.message);

  await acceptOrganiserTerms(userId, CURRENT_ORGANISER_TERMS_VERSION);

  return {
    eventIds: peerIds,
    organiserTermsAccepted: true,
    refundTermsAgreed: true,
  };
}

module.exports = {
  listOrganiserSetupReviews,
  acceptOrganiserEventSetup,
  buildSetupReviewItem,
  bookingPathLabel,
};
