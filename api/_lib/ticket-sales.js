/** Sale end for "when event starts" tiers — heal rows saved before start time was corrected. */
function effectiveTicketSaleEnd(ticket, eventStartsAt) {
  const row = ticket && typeof ticket === 'object' ? ticket : {};
  const endsRaw = row.sale_ends_at ? String(row.sale_ends_at).trim() : '';
  if (!endsRaw) return null;
  const ends = new Date(endsRaw);
  if (Number.isNaN(ends.getTime())) return null;

  const startRaw = eventStartsAt ? String(eventStartsAt).trim() : '';
  if (!startRaw) return ends;
  const eventStart = new Date(startRaw);
  if (Number.isNaN(eventStart.getTime())) return ends;

  if (ends < eventStart) return eventStart;
  return ends;
}

/**
 * Whether a ticket row is on sale at the given time.
 * Pass eventStartsAt so stale at_start sale ends still track the event start.
 */
function isTicketOnSale(ticket, at, eventStartsAt) {
  const row = ticket && typeof ticket === 'object' ? ticket : {};
  const now = at instanceof Date ? at : new Date();
  const status = String(row.status || 'Active').trim();
  if (status !== 'Active') return false;

  const starts = row.sale_starts_at ? new Date(row.sale_starts_at) : null;
  if (starts && !Number.isNaN(starts.getTime()) && starts > now) return false;

  const ends = effectiveTicketSaleEnd(row, eventStartsAt);
  if (ends && ends <= now) return false;

  return true;
}

function eventHasTicketsOnSale(tickets, at, eventStartsAt) {
  const list = Array.isArray(tickets) ? tickets : [];
  return list.some((ticket) => isTicketOnSale(ticket, at, eventStartsAt));
}

/** Earliest future sale_starts_at across active tiers (null if none scheduled ahead). */
function earliestTicketSaleStart(tickets, at) {
  const now = at instanceof Date ? at : new Date();
  const list = Array.isArray(tickets) ? tickets : [];
  let earliest = null;
  for (const ticket of list) {
    const status = String(ticket.status || 'Active').trim();
    if (status !== 'Active') continue;
    const starts = ticket.sale_starts_at ? new Date(ticket.sale_starts_at) : null;
    if (!starts || Number.isNaN(starts.getTime()) || starts <= now) continue;
    if (!earliest || starts < earliest) earliest = starts;
  }
  return earliest;
}

const { EVENT_TZ, formatTime, londonDatePartsFromIso } = require('./event-timezone');

function formatTicketSalesOpensLabel(isoOrDate, at) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (!d || Number.isNaN(d.getTime())) return '';
  const now = at instanceof Date ? at : new Date();
  const parts = londonDatePartsFromIso(d.toISOString());
  const nowParts = londonDatePartsFromIso(now.toISOString());
  const includeYear = parts && nowParts && parts.year !== nowParts.year;
  const datePart = d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: includeYear ? 'numeric' : undefined,
    timeZone: EVENT_TZ,
  });
  const timePart = formatTime(d.toISOString());
  return datePart + ' at ' + timePart;
}

function formatTicketSalesOpensShort(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: EVENT_TZ,
  });
}

function isEventPublishedForSale(eventRow) {
  const ev = eventRow && typeof eventRow === 'object' ? eventRow : {};
  const status = String(ev.status || '').trim().toLowerCase();
  if (status === 'cancelled' || status === 'archived' || status === 'unpublished') return false;
  if (status !== 'published') return false;
  const approval = String(ev.approval_status || '').trim();
  if (approval && approval !== 'Approved') return false;
  return true;
}

/** Whether buyers can purchase — requires published event, ticket tiers, and an active sale window. */
function resolveTicketSalesEnabled(eventRow, tickets, at) {
  const ev = eventRow && typeof eventRow === 'object' ? eventRow : {};
  const now = at instanceof Date ? at : new Date();
  if (!isEventPublishedForSale(ev)) return false;
  const list = Array.isArray(tickets) ? tickets : [];
  if (!list.length || !eventHasTicketsOnSale(list, now, ev.starts_at)) return false;

  if (ev.ticket_sales_enabled === true) return true;

  const hasScheduledStarts = list.some((ticket) => {
    const starts = ticket.sale_starts_at ? new Date(ticket.sale_starts_at) : null;
    return starts && !Number.isNaN(starts.getTime());
  });
  // Scheduled tiers: auto-enable checkout once the sale window opens.
  if (hasScheduledStarts && (ev.refund_terms_agreed_at || ev.refund_terms_agreed === true)) {
    return true;
  }

  // Legacy rows or organiser-held sales until enable_sales is used.
  if (ev.refund_terms_agreed_at || ev.refund_terms_agreed === true) {
    return ev.ticket_sales_enabled !== false;
  }
  return false;
}

/** Compute ticket sale end from a window option relative to the event start. */
function computeSaleEndIso(option, customDatetime, eventDateIso) {
  const base = eventDateIso ? new Date(eventDateIso) : null;
  if (!base || Number.isNaN(base.getTime())) return null;
  const opt = String(option || '').trim();
  if (opt === 'at_start') return base.toISOString();
  if (opt === '12_hours') return new Date(base.getTime() - 12 * 60 * 60 * 1000).toISOString();
  if (opt === '1_day') return new Date(base.getTime() - 24 * 60 * 60 * 1000).toISOString();
  if (opt === '1_week') return new Date(base.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (opt === 'custom' && customDatetime) {
    const { parseEventDateInputToUtcIso } = require('./event-timezone');
    return parseEventDateInputToUtcIso(customDatetime);
  }
  return null;
}

function resolveTierSaleEnd(tier, eventStartsAt) {
  const option = String(tier.saleEndOption || '').trim();
  if (option) {
    return computeSaleEndIso(option, tier.saleEndCustom || tier.saleEnd, eventStartsAt);
  }
  return tier.saleEnd || null;
}

function groupTicketsByEventId(tickets) {
  const map = {};
  (tickets || []).forEach((ticket) => {
    const eventId = String(ticket.event_id || '').trim();
    if (!eventId) return;
    if (!map[eventId]) map[eventId] = [];
    map[eventId].push(ticket);
  });
  return map;
}

module.exports = {
  effectiveTicketSaleEnd,
  isTicketOnSale,
  eventHasTicketsOnSale,
  earliestTicketSaleStart,
  formatTicketSalesOpensLabel,
  formatTicketSalesOpensShort,
  isEventPublishedForSale,
  resolveTicketSalesEnabled,
  computeSaleEndIso,
  resolveTierSaleEnd,
  groupTicketsByEventId,
};
