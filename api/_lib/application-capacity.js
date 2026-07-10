/**
 * Capacity rules for Category Exclusivity (application-based) tickets.
 * Only approved applications hold a seat; pending and denied do not.
 */
function registrationHoldsApplicationSeat(row) {
  if (!row) return false;
  if (row.cancelled_at) return false;
  if (String(row.payment_status || '').trim() === 'Refunded') return false;
  return String(row.application_status || '').trim() === 'Approved';
}

async function countApprovedApplicationSeats(sb, ticketId) {
  const regRes = await sb
    .from('registrations')
    .select('quantity')
    .eq('ticket_id', ticketId)
    .eq('application_status', 'Approved')
    .neq('payment_status', 'Refunded')
    .is('cancelled_at', null);
  if (regRes.error) throw new Error(regRes.error.message);
  return (regRes.data || []).reduce(
    (sum, row) => sum + Math.max(1, Number(row.quantity) || 1),
    0
  );
}

async function assertApplicationSeatAvailable(sb, ticketRow, { excludeRegistrationId } = {}) {
  if (!ticketRow || ticketRow.quantity == null) return;
  const cap = Math.max(0, Number(ticketRow.quantity) || 0);
  if (cap <= 0) return;

  let query = sb
    .from('registrations')
    .select('quantity')
    .eq('ticket_id', ticketRow.id)
    .eq('application_status', 'Approved')
    .neq('payment_status', 'Refunded')
    .is('cancelled_at', null);
  if (excludeRegistrationId) {
    query = query.neq('id', excludeRegistrationId);
  }
  const regRes = await query;
  if (regRes.error) throw new Error(regRes.error.message);
  const sold = (regRes.data || []).reduce(
    (sum, row) => sum + Math.max(1, Number(row.quantity) || 1),
    0
  );
  if (sold >= cap) {
    const err = new Error('applications_full');
    err.code = 'applications_full';
    err.status = 400;
    throw err;
  }
}

module.exports = {
  registrationHoldsApplicationSeat,
  countApprovedApplicationSeats,
  assertApplicationSeatAvailable,
};
