/**
 * Whether a ticket row is on sale at the given time.
 */
function isTicketOnSale(ticket, at) {
  const row = ticket && typeof ticket === 'object' ? ticket : {};
  const now = at instanceof Date ? at : new Date();
  const status = String(row.status || 'Active').trim();
  if (status !== 'Active') return false;

  const starts = row.sale_starts_at ? new Date(row.sale_starts_at) : null;
  if (starts && !Number.isNaN(starts.getTime()) && starts > now) return false;

  const ends = row.sale_ends_at ? new Date(row.sale_ends_at) : null;
  if (ends && !Number.isNaN(ends.getTime()) && ends <= now) return false;

  return true;
}

function eventHasTicketsOnSale(tickets, at) {
  const list = Array.isArray(tickets) ? tickets : [];
  return list.some((ticket) => isTicketOnSale(ticket, at));
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

function formatTicketSalesOpensLabel(isoOrDate, at) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (!d || Number.isNaN(d.getTime())) return '';
  const now = at instanceof Date ? at : new Date();
  const datePart = d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
  const timePart = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return datePart + ' at ' + timePart;
}

function formatTicketSalesOpensShort(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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
  if (!list.length || !eventHasTicketsOnSale(list, now)) return false;

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
  isTicketOnSale,
  eventHasTicketsOnSale,
  earliestTicketSaleStart,
  formatTicketSalesOpensLabel,
  formatTicketSalesOpensShort,
  isEventPublishedForSale,
  resolveTicketSalesEnabled,
  groupTicketsByEventId,
};
