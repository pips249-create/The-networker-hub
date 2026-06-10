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

function isEventPublishedForSale(eventRow) {
  const ev = eventRow && typeof eventRow === 'object' ? eventRow : {};
  const status = String(ev.status || '').trim().toLowerCase();
  if (status === 'cancelled' || status === 'archived' || status === 'unpublished') return false;
  if (status !== 'published') return false;
  const approval = String(ev.approval_status || '').trim();
  if (approval && approval !== 'Approved') return false;
  return true;
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
  isEventPublishedForSale,
  groupTicketsByEventId,
};
