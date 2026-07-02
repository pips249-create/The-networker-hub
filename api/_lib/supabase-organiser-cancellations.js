/**
 * Locked-event cancellation flow.
 */
const { getSupabaseAdmin } = require('./supabase');
const { resolveOrganiserAccess } = require('./supabase-organiser-access');
const {
  sendEventCancelledEmailsForEvent,
  sendRefundProcessedEmailsForEvent,
} = require('./cancellation-emails');
const { verifyEventRefundsInStripe, issueEventRefundsInStripe } = require('./stripe-refunds');
const { isStripeConnectEnabled } = require('./stripe-connect');

const CANCELLATION_REASONS = new Set([
  'Venue issue',
  'Date change needed',
  'Not enough registrations',
  'Other',
]);

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || '')
  );
}

async function assertEventOwned(sb, session, eventId, groupIds) {
  const { data: row, error } = await sb.from('events').select('*').eq('id', eventId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) {
    const e = new Error('Event not found');
    e.status = 404;
    throw e;
  }
  if (!groupIds.includes(row.organiser_id)) {
    const e = new Error('Event not found');
    e.status = 403;
    throw e;
  }
  return row;
}

async function countOrganiserCancellationsPastYear(sb, groupIds) {
  if (!groupIds.length) return 0;
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 1);
  const { data: eventRows, error: evErr } = await sb
    .from('events')
    .select('id')
    .in('organiser_id', groupIds);
  if (evErr) throw new Error(evErr.message);
  const ids = (eventRows || []).map((r) => r.id);
  if (!ids.length) return 0;
  const { count, error } = await sb
    .from('event_cancellations')
    .select('id', { count: 'exact', head: true })
    .in('event_id', ids)
    .gte('created_at', since.toISOString());
  if (error) throw new Error(error.message);
  return count || 0;
}

async function loadEventRegistrationCounts(sb, eventId) {
  const { data: regs, error } = await sb
    .from('registrations')
    .select('id, payment_status, quantity, cancelled_at')
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);
  const active = (regs || []).filter(
    (row) => !row.cancelled_at && String(row.payment_status || '').trim() !== 'Refunded'
  );
  const { summarizeRegistrationSales } = require('./supabase-organiser-payouts');
  const { ticketsSold } = summarizeRegistrationSales(active);
  const paidBookings = active.filter((row) => String(row.payment_status || '').trim() === 'Paid').length;
  return { ticketsSold, paidBookings, activeBookings: active.length };
}

async function getCancellationContext(session, eventId) {
  const access = await resolveOrganiserAccess(session);
  const groupIds = access.groupIds || [];
  const sb = getSupabaseAdmin();
  await assertEventOwned(sb, session, eventId, groupIds);
  const sales = await loadEventRegistrationCounts(sb, eventId);
  const cancellationsPastYear = await countOrganiserCancellationsPastYear(sb, groupIds);
  return {
    eventId,
    ticketsSold: sales.ticketsSold,
    paidBookings: sales.paidBookings,
    activeBookings: sales.activeBookings,
    cancellationsPastYear,
    cancellationLimit: 3,
  };
}

async function cancelLockedEvent(session, eventId, payload) {
  const reason = String(payload.reason || '').trim();
  const details = String(payload.details || '').trim();
  let refundTermsConfirmed = Boolean(payload.refundTermsConfirmed);

  if (!CANCELLATION_REASONS.has(reason)) {
    const e = new Error('Select a cancellation reason');
    e.status = 400;
    throw e;
  }

  const access = await resolveOrganiserAccess(session);
  const groupIds = access.groupIds || [];
  const sb = getSupabaseAdmin();
  const row = await assertEventOwned(sb, session, eventId, groupIds);

  const sales = await loadEventRegistrationCounts(sb, eventId);
  const published = String(row.status || '').toLowerCase() === 'published';
  const salesLive = row.ticket_sales_enabled === true;
  if (!row.locked && sales.ticketsSold < 1 && !published && !salesLive) {
    const e = new Error('This event has no ticket sales — delete it instead');
    e.status = 400;
    throw e;
  }
  if (sales.paidBookings > 0 && !refundTermsConfirmed) {
    const e = new Error(
      'You must confirm that paying attendees will receive an automatic refund'
    );
    e.status = 400;
    throw e;
  }
  if (sales.paidBookings < 1) {
    refundTermsConfirmed = true;
  }
  if (String(row.status || '').toLowerCase() === 'cancelled') {
    const e = new Error('This event is already cancelled');
    e.status = 400;
    throw e;
  }

  const uid = isUuid(session.sub) ? session.sub : null;

  const { data: cancellation, error: insertErr } = await sb
    .from('event_cancellations')
    .insert({
      event_id: eventId,
      reason,
      details: details || null,
      refund_terms_confirmed: refundTermsConfirmed,
      cancelled_by: uid,
    })
    .select('*')
    .single();
  if (insertErr) throw new Error(insertErr.message);

  const { error: updateErr } = await sb
    .from('events')
    .update({
      status: 'cancelled',
      approval_status: 'Rejected',
    })
    .eq('id', eventId);
  if (updateErr) throw new Error(updateErr.message);

  const { data: updated } = await sb.from('events').select('*').eq('id', eventId).single();

  let emailResult = null;
  try {
    emailResult = await sendEventCancelledEmailsForEvent(sb, eventId, cancellation);
  } catch (e) {
    emailResult = { error: e.message || String(e) };
  }

  let refundResult = null;
  let refundsConfirmed = false;
  let refundsConfirmedResult = null;

  if (sales.paidBookings > 0) {
    const { data: registrations, error: regErr } = await sb
      .from('registrations')
      .select('id, payment_status, stripe_payment_intent_id, amount_paid, refund_email_sent_at')
      .eq('event_id', eventId)
      .eq('payment_status', 'Paid');
    if (regErr) throw new Error(regErr.message);

    refundResult = await issueEventRefundsInStripe(registrations || [], {
      connectEnabled: isStripeConnectEnabled(),
    });

    if (refundResult.allIssued) {
      const verification = await verifyEventRefundsInStripe(registrations || []);
      if (verification.allRefunded) {
        refundsConfirmedResult = await finalizeEventRefundsConfirmed(sb, cancellation.id, eventId);
        refundsConfirmed = true;
      }
    }
  }

  const cancellationOut = refundsConfirmedResult?.cancellation || cancellation;

  return {
    cancellation: cancellationOut,
    event: updated,
    emailResult,
    refundResult,
    refundsConfirmed,
    paidBookings: sales.paidBookings,
    refundsEmailResult: refundsConfirmedResult?.emailResult || null,
  };
}

async function finalizeEventRefundsConfirmed(sb, cancellationId, eventId) {
  const { data, error } = await sb
    .from('event_cancellations')
    .update({ refunds_confirmed_at: new Date().toISOString() })
    .eq('id', cancellationId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  const { error: holdErr } = await sb
    .from('events')
    .update({ payout_held: false })
    .eq('id', eventId);
  if (holdErr) throw new Error(holdErr.message);

  let emailResult = null;
  try {
    emailResult = await sendRefundProcessedEmailsForEvent(sb, eventId);
  } catch (e) {
    emailResult = { error: e.message || String(e) };
  }

  return { cancellation: data, emailResult };
}

async function confirmRefundsIssued(session, eventId) {
  const access = await resolveOrganiserAccess(session);
  const groupIds = access.groupIds || [];
  const sb = getSupabaseAdmin();
  await assertEventOwned(sb, session, eventId, groupIds);

  const { data: cancellation, error: findErr } = await sb
    .from('event_cancellations')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);
  if (!cancellation) {
    const e = new Error('No cancellation record found for this event');
    e.status = 404;
    throw e;
  }
  if (cancellation.refunds_confirmed_at) {
    return {
      cancellation,
      alreadyConfirmed: true,
      verification: { allRefunded: true, totalPaid: 0 },
      emailResult: { skipped: true, reason: 'already_confirmed' },
    };
  }

  const { data: registrations, error: regErr } = await sb
    .from('registrations')
    .select('id, payment_status, stripe_payment_intent_id, amount_paid, refund_email_sent_at')
    .eq('event_id', eventId)
    .eq('payment_status', 'Paid');
  if (regErr) throw new Error(regErr.message);

  const refundIssue = await issueEventRefundsInStripe(registrations || [], {
    connectEnabled: isStripeConnectEnabled(),
  });

  const verification = await verifyEventRefundsInStripe(registrations || []);
  if (!verification.allRefunded) {
    const pendingCount = verification.pending.length;
    const issueFailed = refundIssue.failed?.length || 0;
    let message =
      pendingCount === 1
        ? '1 paid booking is not fully refunded in Stripe yet.'
        : `${pendingCount} paid bookings are not fully refunded in Stripe yet.`;
    if (issueFailed > 0) {
      message += ' We could not issue every refund automatically — try again shortly or contact support.';
    } else {
      message += ' Stripe may still be processing — wait a moment and try again.';
    }
    const e = new Error(message);
    e.status = 400;
    e.code = 'refunds_not_verified';
    e.verification = verification;
    e.refundIssue = refundIssue;
    throw e;
  }

  const finalized = await finalizeEventRefundsConfirmed(sb, cancellation.id, eventId);

  return {
    cancellation: finalized.cancellation,
    verification,
    refundIssue,
    emailResult: finalized.emailResult,
  };
}

module.exports = {
  cancelLockedEvent,
  confirmRefundsIssued,
  getCancellationContext,
  CANCELLATION_REASONS: [...CANCELLATION_REASONS],
};
