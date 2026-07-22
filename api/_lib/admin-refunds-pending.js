/**
 * Cancelled events where Stripe refunds were not confirmed — needs admin follow-up.
 */
const { fetchEventRegistrationStats } = require('./admin-event-commerce');
const { issueEventRefundsInStripe, waitForEventRefundsInStripe } = require('./stripe-refunds');
const { isStripeConnectEnabled } = require('./stripe-connect');
const { finalizeEventRefundsConfirmed } = require('./admin-event-removal');

async function listRefundsPendingEvents(sb, limit) {
  const max = Math.min(Math.max(Number(limit) || 50, 1), 100);

  const { data: cancellations, error: cancelErr } = await sb
    .from('event_cancellations')
    .select('id, event_id, created_at, refunds_confirmed_at, reinstated_at, removed_by_admin, reason')
    .is('refunds_confirmed_at', null)
    .is('reinstated_at', null)
    .order('created_at', { ascending: false })
    .limit(max * 3);
  if (cancelErr) throw new Error(cancelErr.message);

  const latestByEvent = new Map();
  (cancellations || []).forEach((row) => {
    if (!row?.event_id || latestByEvent.has(row.event_id)) return;
    latestByEvent.set(row.event_id, row);
  });

  const eventIds = [...latestByEvent.keys()];
  if (!eventIds.length) return [];

  const { data: events, error: eventErr } = await sb
    .from('events')
    .select('id, title, status, organiser_id, starts_at, payout_held, organisers(name)')
    .in('id', eventIds)
    .eq('status', 'cancelled');
  if (eventErr) throw new Error(eventErr.message);

  const statsMap = await fetchEventRegistrationStats(sb, eventIds);
  const rows = [];

  (events || []).forEach((ev) => {
    const cancellation = latestByEvent.get(ev.id);
    if (!cancellation) return;
    const stats = statsMap[ev.id] || { registration_count: 0, paid_booking_count: 0 };
    if ((stats.paid_booking_count || 0) < 1) return;
    rows.push({
      eventId: ev.id,
      title: String(ev.title || '').trim() || 'Untitled',
      status: ev.status,
      startsAt: ev.starts_at || null,
      organiserId: ev.organiser_id || '',
      organiserName: ev.organisers?.name ? String(ev.organisers.name).trim() : '',
      payoutHeld: Boolean(ev.payout_held),
      cancellationId: cancellation.id,
      cancelledAt: cancellation.created_at,
      removedByAdmin: Boolean(cancellation.removed_by_admin),
      reason: cancellation.reason || '',
      paidBookings: stats.paid_booking_count,
      registrationCount: stats.registration_count,
    });
  });

  return rows.slice(0, max);
}

async function retryEventRefunds(sb, eventId) {
  const { data: eventRow, error: eventErr } = await sb
    .from('events')
    .select('id, title, status')
    .eq('id', eventId)
    .maybeSingle();
  if (eventErr) throw new Error(eventErr.message);
  if (!eventRow) {
    const e = new Error('Event not found');
    e.status = 404;
    throw e;
  }
  if (String(eventRow.status || '').toLowerCase() !== 'cancelled') {
    const e = new Error('Event is not cancelled');
    e.status = 400;
    throw e;
  }

  const { data: cancellation, error: cancelErr } = await sb
    .from('event_cancellations')
    .select('*')
    .eq('event_id', eventId)
    .is('refunds_confirmed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (cancelErr) throw new Error(cancelErr.message);
  if (!cancellation) {
    const e = new Error('No open cancellation record for this event');
    e.status = 404;
    throw e;
  }

  const { data: registrations, error: regErr } = await sb
    .from('registrations')
    .select('id, payment_status, stripe_payment_intent_id, amount_paid, refund_email_sent_at, organiser_id')
    .eq('event_id', eventId)
    .eq('payment_status', 'Paid');
  if (regErr) throw new Error(regErr.message);

  const refundResult = await issueEventRefundsInStripe(registrations || [], {
    connectEnabled: isStripeConnectEnabled(),
  });

  let refundsConfirmed = false;
  if (refundResult.allIssued && (registrations || []).length) {
    const verification = await waitForEventRefundsInStripe(registrations || [], {
      attempts: 5,
      delayMs: 1500,
    });
    if (verification.allRefunded) {
      await finalizeEventRefundsConfirmed(sb, cancellation.id, eventId);
      refundsConfirmed = true;
    }
  }

  return {
    eventId,
    title: String(eventRow.title || '').trim() || 'Untitled',
    refundResult,
    refundsConfirmed,
    paidBookings: (registrations || []).length,
  };
}

module.exports = {
  listRefundsPendingEvents,
  retryEventRefunds,
};
