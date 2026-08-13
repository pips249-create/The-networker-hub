/**
 * Shared event-level capacity (events.max_attendees).
 * Counts every active booking toward one room total — public, member, guest visit,
 * alumni, and pending applications — so mixed ticket types cannot oversell the venue.
 * Per-ticket quantityAvailable remains an optional sub-cap on top of this.
 */

function normalizeEventCapacity(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function registrationHoldsEventSeat(row) {
  if (!row) return false;
  if (row.cancelled_at) return false;
  if (String(row.payment_status || '').trim() === 'Refunded') return false;
  if (String(row.application_status || '').trim() === 'Denied') return false;
  return true;
}

async function countEventOccupiedSeats(sb, eventId, { excludeRegistrationId } = {}) {
  const id = String(eventId || '').trim();
  if (!id) return 0;

  let query = sb
    .from('registrations')
    .select('id, quantity, payment_status, application_status, cancelled_at')
    .eq('event_id', id)
    .neq('payment_status', 'Refunded')
    .neq('application_status', 'Denied')
    .is('cancelled_at', null);
  if (excludeRegistrationId) {
    query = query.neq('id', excludeRegistrationId);
  }
  const regRes = await query;
  if (regRes.error) throw new Error(regRes.error.message);
  return (regRes.data || []).reduce((sum, row) => {
    if (!registrationHoldsEventSeat(row)) return sum;
    return sum + Math.max(1, Number(row.quantity) || 1);
  }, 0);
}

async function getEventCapacityCap(sb, eventId) {
  const id = String(eventId || '').trim();
  if (!id) return null;
  const evRes = await sb.from('events').select('max_attendees').eq('id', id).maybeSingle();
  if (evRes.error) throw new Error(evRes.error.message);
  return normalizeEventCapacity(evRes.data?.max_attendees);
}

/**
 * Remaining seats under the event cap, or null when unlimited.
 */
async function availableEventQty(sb, eventId, { excludeRegistrationId } = {}) {
  const cap = await getEventCapacityCap(sb, eventId);
  if (cap == null) return null;
  const occupied = await countEventOccupiedSeats(sb, eventId, { excludeRegistrationId });
  return Math.max(0, cap - occupied);
}

function isEventSoldOutDbError(err) {
  const msg = String(err?.message || err || '');
  const code = String(err?.code || '');
  return (
    /event_sold_out/i.test(msg) ||
    code === '23514' ||
    code === 'check_violation'
  );
}

async function assertEventHasCapacity(sb, eventId, qty = 1, { excludeRegistrationId } = {}) {
  const need = Math.max(1, Number(qty) || 1);
  const left = await availableEventQty(sb, eventId, { excludeRegistrationId });
  if (left == null) return;
  if (left < need) {
    const err = new Error('event_sold_out');
    err.code = 'event_sold_out';
    err.status = 400;
    throw err;
  }
}

/**
 * Map Postgres trigger / constraint failures from registration inserts into
 * the same event_sold_out error the checkout UI already handles.
 */
function rethrowIfCapacityExceeded(err) {
  if (!err) return;
  if (isEventSoldOutDbError(err)) {
    const out = new Error('event_sold_out');
    out.code = 'event_sold_out';
    out.status = 400;
    throw out;
  }
  throw err;
}

module.exports = {
  normalizeEventCapacity,
  registrationHoldsEventSeat,
  countEventOccupiedSeats,
  getEventCapacityCap,
  availableEventQty,
  assertEventHasCapacity,
  isEventSoldOutDbError,
  rethrowIfCapacityExceeded,
};
