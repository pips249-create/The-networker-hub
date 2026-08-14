/**
 * Book all remaining dates in a multi-date series — one checkout, one registration per date.
 */
const { randomUUID } = require('crypto');
const { fetchSeriesPeerRows } = require('./event-series-peers');
const { isEventPast } = require('./event-timezone');
const { resolveTicketSalesEnabled } = require('./ticket-sales');
const { isGuestVisitTicket } = require('./guest-visits');
const { isAlumniTicket } = require('./alumni-invites');
const { isMembersOnlyTicket } = require('./ticket-visibility');
const { ensureAttendeeId } = require('./supabase-favourites');
const { availableEventQty } = require('./event-capacity');

function parsePriceNum(raw) {
  if (raw == null || raw === '') return 0;
  const n = Number(String(raw).replace(/[£,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function normalizeTierName(name) {
  return String(name || '')
    .trim()
    .toLowerCase();
}

function bundleError(code, message, status = 400) {
  const err = new Error(message || code);
  err.code = code;
  err.status = status;
  return err;
}

async function availableTicketQty(sb, ticketId) {
  const tRes = await sb.from('tickets').select('id, quantity').eq('id', ticketId).maybeSingle();
  if (tRes.error) throw new Error(tRes.error.message);
  if (!tRes.data) return 0;
  if (tRes.data.quantity == null) return 99;

  const cap = Math.max(0, Number(tRes.data.quantity) || 0);
  const regRes = await sb
    .from('registrations')
    .select('quantity')
    .eq('ticket_id', ticketId)
    .is('cancelled_at', null)
    .neq('payment_status', 'Refunded')
    .neq('application_status', 'Denied');
  if (regRes.error) throw new Error(regRes.error.message);
  const sold = (regRes.data || []).reduce(
    (sum, row) => sum + Math.max(1, Number(row.quantity) || 1),
    0
  );
  return Math.max(0, cap - sold);
}

async function registeredEventIdsForAttendee(sb, attendeeId, eventIds) {
  if (!attendeeId || !eventIds.length) return new Set();
  const { data, error } = await sb
    .from('registrations')
    .select('event_id')
    .eq('attendee_id', attendeeId)
    .in('event_id', eventIds)
    .is('cancelled_at', null)
    .neq('application_status', 'Denied')
    .neq('payment_status', 'Refunded');
  if (error) throw new Error(error.message);
  return new Set((data || []).map((row) => row.event_id).filter(Boolean));
}

function ticketEligibleForBundle(ticket) {
  if (!ticket) return false;
  if (isSeriesPassTicket(ticket)) return false;
  if (isGuestVisitTicket(ticket)) return false;
  if (isAlumniTicket(ticket)) return false;
  if (isMembersOnlyTicket(ticket)) return false;
  const ticketType = String(ticket.ticket_type || '').trim();
  if (/application/i.test(ticketType)) return false;
  return true;
}

function isSeriesPassTicket(ticket) {
  return String(ticket?.series_scope || '').trim() === 'series_pass';
}

async function seriesPassSoldCount(sb, peerIds) {
  if (!peerIds.length) return 0;
  const { data, error } = await sb
    .from('registrations')
    .select('booking_group_id')
    .in('event_id', peerIds)
    .eq('registration_kind', 'series_pass')
    .is('cancelled_at', null)
    .neq('payment_status', 'Refunded')
    .neq('application_status', 'Denied');
  if (error) throw new Error(error.message);
  const groups = new Set(
    (data || []).map((row) => row.booking_group_id).filter(Boolean)
  );
  return groups.size;
}

async function seriesPassAvailableQty(sb, peerIds, quantityCap) {
  if (quantityCap == null) return 99;
  const cap = Math.max(0, Number(quantityCap) || 0);
  const sold = await seriesPassSoldCount(sb, peerIds);
  return Math.max(0, cap - sold);
}

/**
 * Full series pass — one checkout price, registration on each upcoming date.
 */
async function resolveSeriesPassItems(sb, { eventId, ticketId, email, userId }) {
  const anchorId = String(eventId || '').trim();
  const anchorTicketId = String(ticketId || '').trim();
  if (!anchorId || !anchorTicketId) {
    throw bundleError('missing_pass_params', 'Select a series pass before checkout.');
  }

  const anchorEvRes = await sb
    .from('events')
    .select('id, title, status, approval_status, starts_at, series_group_id, organiser_id')
    .eq('id', anchorId)
    .maybeSingle();
  if (anchorEvRes.error) throw new Error(anchorEvRes.error.message);
  const anchorEvent = anchorEvRes.data;
  if (!anchorEvent) throw bundleError('event_not_found', 'Event not found.', 404);
  if (!String(anchorEvent.organiser_id || '').trim()) {
    throw bundleError('missing_organiser', 'This event is not available for booking.');
  }

  const peers = await fetchSeriesPeerRows(sb, anchorEvent);
  if (peers.length <= 1) {
    throw bundleError(
      'series_pass_unavailable',
      'Series passes are only available on multi-date listings.'
    );
  }

  const peerIds = peers.map((row) => row.id).filter(Boolean);
  const { data: peerEvents, error: peerErr } = await sb
    .from('events')
    .select('id, title, status, approval_status, starts_at, ticket_sales_enabled')
    .in('id', peerIds);
  if (peerErr) throw new Error(peerErr.message);

  const anchorTicketRes = await sb
    .from('tickets')
    .select('id, name, price, quantity, event_id, ticket_type, visibility, status, series_scope')
    .eq('id', anchorTicketId)
    .maybeSingle();
  if (anchorTicketRes.error) throw new Error(anchorTicketRes.error.message);
  const anchorTicket = anchorTicketRes.data;
  if (!anchorTicket || anchorTicket.event_id !== anchorId) {
    throw bundleError('ticket_not_found', 'Ticket not found.');
  }
  if (!isSeriesPassTicket(anchorTicket)) {
    throw bundleError('not_series_pass', 'This ticket is not a full series pass.');
  }

  const tierKey = normalizeTierName(anchorTicket.name);
  const passPrice = parsePriceNum(anchorTicket.price);
  const passLeft = await seriesPassAvailableQty(sb, peerIds, anchorTicket.quantity);
  if (passLeft < 1) {
    throw bundleError('series_pass_sold_out', 'This series pass is sold out.');
  }

  const { data: allTickets, error: ticketsErr } = await sb
    .from('tickets')
    .select('id, name, price, event_id, ticket_type, visibility, status, series_scope')
    .in('event_id', peerIds);
  if (ticketsErr) throw new Error(ticketsErr.message);

  const ticketsByEvent = new Map();
  (allTickets || []).forEach((ticket) => {
    if (!ticketsByEvent.has(ticket.event_id)) ticketsByEvent.set(ticket.event_id, []);
    ticketsByEvent.get(ticket.event_id).push(ticket);
  });

  let attendeeId = null;
  if (email) {
    attendeeId = await ensureAttendeeId(sb, {
      email: String(email).trim().toLowerCase(),
      sub: userId || null,
    });
  }
  const alreadyRegistered = await registeredEventIdsForAttendee(sb, attendeeId, peerIds);

  const items = [];
  const sortedPeers = (peerEvents || [])
    .filter((row) => String(row.status || '').toLowerCase() === 'published')
    .filter((row) => row.approval_status === 'Approved')
    .filter((row) => row.starts_at && !isEventPast(row))
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

  for (const peer of sortedPeers) {
    if (alreadyRegistered.has(peer.id)) {
      throw bundleError(
        'series_pass_partial_conflict',
        'You are already registered for one or more dates in this series. Book remaining dates individually or contact the organiser.'
      );
    }

    const eventTickets = ticketsByEvent.get(peer.id) || [];
    if (!resolveTicketSalesEnabled(peer, eventTickets)) continue;

    const match = eventTickets.find(
      (ticket) =>
        isSeriesPassTicket(ticket) &&
        normalizeTierName(ticket.name) === tierKey &&
        String(ticket.status || 'Active').toLowerCase() !== 'paused'
    );
    if (!match) {
      throw bundleError(
        'series_pass_mismatch',
        'Series pass tiers are not set up consistently on every date. Contact the organiser.'
      );
    }

    items.push({
      eventId: peer.id,
      ticketId: match.id,
      startsAt: peer.starts_at,
      unitPrice: passPrice,
    });
  }

  if (items.length < 2) {
    throw bundleError(
      'series_pass_unavailable',
      'Series pass is not available — fewer than two upcoming dates remain.'
    );
  }

  return {
    items,
    unitPrice: passPrice,
    checkoutQty: 1,
    ticketName: String(anchorTicket.name || 'Series pass').trim(),
    eventTitle: String(anchorEvent.title || 'Event').trim(),
    organiserId: anchorEvent.organiser_id || null,
    pricingMode: 'series_pass',
  };
}

/**
 * Resolve bookable dates for a series bundle from the anchor event + selected ticket tier.
 */
async function resolveSeriesBundleItems(sb, { eventId, ticketId, email, userId }) {
  const anchorId = String(eventId || '').trim();
  const anchorTicketId = String(ticketId || '').trim();
  if (!anchorId || !anchorTicketId) {
    throw bundleError('missing_bundle_params', 'Select a ticket type before booking all dates.');
  }

  const anchorEvRes = await sb
    .from('events')
    .select('id, title, status, approval_status, starts_at, series_group_id, organiser_id, attendance_mode')
    .eq('id', anchorId)
    .maybeSingle();
  if (anchorEvRes.error) throw new Error(anchorEvRes.error.message);
  const anchorEvent = anchorEvRes.data;
  if (!anchorEvent) throw bundleError('event_not_found', 'Event not found.', 404);
  if (!String(anchorEvent.organiser_id || '').trim()) {
    throw bundleError('missing_organiser', 'This event is not available for booking.');
  }

  const peers = await fetchSeriesPeerRows(sb, anchorEvent);
  if (peers.length <= 1) {
    throw bundleError(
      'series_bundle_unavailable',
      'Book all dates is only available when this listing has multiple upcoming dates.'
    );
  }

  const peerIds = peers.map((row) => row.id).filter(Boolean);
  const { data: peerEvents, error: peerErr } = await sb
    .from('events')
    .select(
      'id, title, status, approval_status, starts_at, ticket_sales_enabled, attendance_mode, guest_passes_disabled'
    )
    .in('id', peerIds);
  if (peerErr) throw new Error(peerErr.message);

  const anchorTicketRes = await sb
    .from('tickets')
    .select('id, name, price, event_id, ticket_type, visibility, status')
    .eq('id', anchorTicketId)
    .maybeSingle();
  if (anchorTicketRes.error) throw new Error(anchorTicketRes.error.message);
  const anchorTicket = anchorTicketRes.data;
  if (!anchorTicket || anchorTicket.event_id !== anchorId) {
    throw bundleError('ticket_not_found', 'Ticket not found for this date.');
  }
  if (!ticketEligibleForBundle(anchorTicket)) {
    throw bundleError(
      'series_bundle_ticket_ineligible',
      'This ticket type cannot be booked across all dates. Choose a standard paid or free tier.'
    );
  }

  const tierKey = normalizeTierName(anchorTicket.name);
  const unitPrice = parsePriceNum(anchorTicket.price);

  const { data: allTickets, error: ticketsErr } = await sb
    .from('tickets')
    .select('id, name, price, event_id, ticket_type, visibility, status')
    .in('event_id', peerIds);
  if (ticketsErr) throw new Error(ticketsErr.error);

  const ticketsByEvent = new Map();
  (allTickets || []).forEach((ticket) => {
    if (!ticketsByEvent.has(ticket.event_id)) ticketsByEvent.set(ticket.event_id, []);
    ticketsByEvent.get(ticket.event_id).push(ticket);
  });

  let attendeeId = null;
  if (email) {
    attendeeId = await ensureAttendeeId(sb, {
      email: String(email).trim().toLowerCase(),
      sub: userId || null,
    });
  }
  const alreadyRegistered = await registeredEventIdsForAttendee(sb, attendeeId, peerIds);

  const items = [];
  const sortedPeers = (peerEvents || [])
    .filter((row) => String(row.status || '').toLowerCase() === 'published')
    .filter((row) => row.approval_status === 'Approved')
    .filter((row) => row.starts_at && !isEventPast(row))
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

  for (const peer of sortedPeers) {
    if (alreadyRegistered.has(peer.id)) continue;

    const eventTickets = ticketsByEvent.get(peer.id) || [];
    if (!resolveTicketSalesEnabled(peer, eventTickets)) continue;

    const match = eventTickets.find(
      (ticket) =>
        ticketEligibleForBundle(ticket) &&
        normalizeTierName(ticket.name) === tierKey &&
        parsePriceNum(ticket.price) === unitPrice &&
        String(ticket.status || 'Active').toLowerCase() !== 'paused'
    );
    if (!match) continue;

    const left = await availableTicketQty(sb, match.id);
    if (left < 1) continue;
    const eventLeft = await availableEventQty(sb, peer.id);
    if (eventLeft != null && eventLeft < 1) continue;

    items.push({
      eventId: peer.id,
      ticketId: match.id,
      startsAt: peer.starts_at,
      unitPrice,
    });
  }

  if (items.length < 2) {
    throw bundleError(
      'series_bundle_unavailable',
      items.length === 1
        ? 'Only one date is left to book for this ticket type — pick that date and checkout normally.'
        : 'Book all dates is not available — dates may differ in price, be sold out, or you may already be registered.'
    );
  }

  return {
    items,
    unitPrice,
    checkoutQty: items.length,
    ticketName: String(anchorTicket.name || 'Ticket').trim(),
    eventTitle: String(anchorEvent.title || 'Event').trim(),
    organiserId: anchorEvent.organiser_id || null,
    pricingMode: 'per_date',
  };
}

function bundleMetadataFromItems(items) {
  return {
    bundle_event_ids: items.map((item) => item.eventId).join(','),
    bundle_ticket_ids: items.map((item) => item.ticketId).join(','),
  };
}

function parseBundleMetadata(metadata) {
  const rawEventIds = String(metadata?.bundle_event_ids || '').trim();
  const rawTicketIds = String(metadata?.bundle_ticket_ids || '').trim();
  if (!rawEventIds || !rawTicketIds) return [];
  const eventIds = rawEventIds.split(',').map((id) => id.trim()).filter(Boolean);
  const ticketIds = rawTicketIds.split(',').map((id) => id.trim()).filter(Boolean);
  if (eventIds.length !== ticketIds.length || !eventIds.length) return [];
  return eventIds.map((eventId, index) => ({
    eventId,
    ticketId: ticketIds[index],
  }));
}

function newBookingGroupId() {
  return randomUUID();
}

module.exports = {
  resolveSeriesBundleItems,
  resolveSeriesPassItems,
  isSeriesPassTicket,
  seriesPassSoldCount,
  seriesPassAvailableQty,
  bundleMetadataFromItems,
  parseBundleMetadata,
  newBookingGroupId,
  availableTicketQty,
  parsePriceNum,
};
