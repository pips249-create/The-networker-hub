/**
 * Reinstate a cancelled event when refunds were not completed (mistaken admin removal).
 */
const { fetchEventRegistrationStats } = require('./admin-event-commerce');

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || '')
  );
}

async function loadLatestCancellation(sb, eventId) {
  const { data, error } = await sb
    .from('event_cancellations')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function countRefundedRegistrations(sb, eventId) {
  const { count, error } = await sb
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('payment_status', 'Refunded');
  if (error) throw new Error(error.message);
  return count || 0;
}

function evaluateReinstateEligibility(eventRow, cancellation, stats) {
  const status = String(eventRow?.status || '').toLowerCase();
  if (status !== 'cancelled') {
    return { canReinstate: false, reason: 'Event is not cancelled.' };
  }
  if (!cancellation) {
    return { canReinstate: false, reason: 'No cancellation record found for this event.' };
  }
  if (cancellation.reinstated_at) {
    return { canReinstate: false, reason: 'This event was already reinstated.' };
  }
  if (cancellation.refunds_confirmed_at) {
    return {
      canReinstate: false,
      reason: 'Refunds were confirmed in Stripe — reinstate is not available.',
    };
  }
  return { canReinstate: true, reason: null, paidBookings: stats?.paid_booking_count || 0 };
}

async function evaluateReinstateEligibilityForEvent(sb, eventRow, cancellation, stats) {
  const base = evaluateReinstateEligibility(eventRow, cancellation, stats);
  if (!base.canReinstate) return base;
  const refundedCount = await countRefundedRegistrations(sb, eventRow.id);
  if (refundedCount > 0) {
    return {
      canReinstate: false,
      reason:
        refundedCount +
        ' booking' +
        (refundedCount === 1 ? ' has' : 's have') +
        ' already been refunded in Stripe.',
    };
  }
  return base;
}

async function reinstateCancelledEvent(sb, eventId, opts) {
  const adminUserId = isUuid(opts?.adminUserId) ? opts.adminUserId : null;
  const targetStatus =
    String(opts?.status || '').trim().toLowerCase() === 'published' ? 'published' : 'unpublished';

  const { data: eventRow, error: eventErr } = await sb
    .from('events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle();
  if (eventErr) throw new Error(eventErr.message);
  if (!eventRow) {
    const e = new Error('Event not found');
    e.status = 404;
    throw e;
  }

  const cancellation = await loadLatestCancellation(sb, eventId);
  const statsMap = await fetchEventRegistrationStats(sb, [eventId]);
  const stats = statsMap[eventId] || { registration_count: 0, paid_booking_count: 0 };
  const eligibility = await evaluateReinstateEligibilityForEvent(sb, eventRow, cancellation, stats);
  if (!eligibility.canReinstate) {
    const e = new Error(eligibility.reason || 'This event cannot be reinstated');
    e.status = 400;
    e.code = 'reinstate_not_allowed';
    throw e;
  }

  const eventPatch = {
    status: targetStatus,
    payout_held: false,
    ticket_sales_enabled: false,
  };
  if (targetStatus === 'published') {
    eventPatch.approval_status = 'Approved';
  } else if (String(eventRow.approval_status || '').trim() === 'Rejected') {
    eventPatch.approval_status = 'Pending Review';
  }

  const { error: eventUpdateErr } = await sb.from('events').update(eventPatch).eq('id', eventId);
  if (eventUpdateErr) throw new Error(eventUpdateErr.message);

  const { error: regErr } = await sb
    .from('registrations')
    .update({ cancelled_at: null })
    .eq('event_id', eventId)
    .neq('payment_status', 'Refunded');
  if (regErr) throw new Error(regErr.message);

  const reinstateRow = {
    reinstated_at: new Date().toISOString(),
  };
  if (adminUserId) reinstateRow.reinstated_by = adminUserId;

  const { data: updatedCancellation, error: cancelErr } = await sb
    .from('event_cancellations')
    .update(reinstateRow)
    .eq('id', cancellation.id)
    .select('*')
    .single();
  if (cancelErr) throw new Error(cancelErr.message);

  return {
    id: eventId,
    title: String(eventRow.title || '').trim() || 'Untitled',
    status: targetStatus,
    cancellation: updatedCancellation,
    registrationsRestored: stats.registration_count || 0,
  };
}

module.exports = {
  evaluateReinstateEligibility,
  evaluateReinstateEligibilityForEvent,
  reinstateCancelledEvent,
};
