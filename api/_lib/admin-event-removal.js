/**
 * Admin force-remove: cancel event, refund attendees, notify organiser.
 */
const {
  sendEventCancelledEmailsForEvent,
  sendRefundProcessedEmailsForEvent,
} = require('./cancellation-emails');
const { sendOrganiserEventRemovedEmail } = require('./admin-event-removal-emails');
const { issueEventRefundsInStripe, waitForEventRefundsInStripe } = require('./stripe-refunds');
const { isStripeConnectEnabled } = require('./stripe-connect');

const ADMIN_REMOVAL_REASONS = [
  'Breach of Hub rules',
  'Misleading listing',
  'Duplicate or test event',
  'Quality issue',
  'Organiser request',
  'Other',
];

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || '')
  );
}

function eventNeedsAdminRemovalFlow(row, registrationCount) {
  if (registrationCount > 0) return true;
  if (row?.locked) return true;
  if (String(row?.status || '').toLowerCase() === 'cancelled') return registrationCount > 0;
  return false;
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
  const totalRegistrations = (regs || []).length;
  return { ticketsSold, paidBookings, activeBookings: active.length, totalRegistrations };
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

async function adminRemoveEvent(sb, eventId, opts) {
  const reason = String(opts?.reason || '').trim();
  const details = String(opts.details || '').trim();
  const adminUserId = isUuid(opts?.adminUserId) ? opts.adminUserId : null;

  if (!ADMIN_REMOVAL_REASONS.includes(reason)) {
    const e = new Error('Select a removal reason');
    e.status = 400;
    throw e;
  }

  const { data: row, error } = await sb.from('events').select('*').eq('id', eventId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) {
    return { id: eventId, skipped: true, reason: 'not_found', title: '' };
  }

  const title = String(row.title || '').trim() || 'Untitled';
  const sales = await loadEventRegistrationCounts(sb, eventId);
  const { count: paidRegistrationCount, error: paidCountErr } = await sb
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('payment_status', 'Paid');
  if (paidCountErr) throw new Error(paidCountErr.message);
  const paidBookings = paidRegistrationCount || 0;
  const alreadyCancelled = String(row.status || '').toLowerCase() === 'cancelled';

  let cancellation = null;

  const { data: existingCancellation } = await sb
    .from('event_cancellations')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingCancellation && existingCancellation.removed_by_admin) {
    cancellation = existingCancellation;
  } else if (!existingCancellation) {
    const { data: inserted, error: insertErr } = await sb
      .from('event_cancellations')
      .insert({
        event_id: eventId,
        reason,
        details: details || null,
        refund_terms_confirmed: true,
        cancelled_by: adminUserId,
        removed_by_admin: true,
      })
      .select('*')
      .single();
    if (insertErr) throw new Error(insertErr.message);
    cancellation = inserted;
  } else {
    const { data: updated, error: updateErr } = await sb
      .from('event_cancellations')
      .update({
        reason,
        details: details || existingCancellation.details || null,
        removed_by_admin: true,
        refund_terms_confirmed: true,
      })
      .eq('id', existingCancellation.id)
      .select('*')
      .single();
    if (updateErr) throw new Error(updateErr.message);
    cancellation = updated;
  }

  if (!alreadyCancelled) {
    const { error: updateErr } = await sb
      .from('events')
      .update({
        status: 'cancelled',
        approval_status: 'Rejected',
      })
      .eq('id', eventId);
    if (updateErr) throw new Error(updateErr.message);
  }

  const cancelledAt = new Date().toISOString();
  const { error: regCancelErr } = await sb
    .from('registrations')
    .update({ cancelled_at: cancelledAt })
    .eq('event_id', eventId)
    .is('cancelled_at', null)
    .neq('application_status', 'Denied');
  if (regCancelErr) throw new Error(regCancelErr.message);

  const attendeeMessage = [reason, details].filter(Boolean).join(' — ');
  let emailResult = null;
  try {
    emailResult = await sendEventCancelledEmailsForEvent(sb, eventId, cancellation, {
      hubRemoved: true,
      organiserMessage: attendeeMessage,
    });
  } catch (e) {
    emailResult = { error: e.message || String(e) };
  }

  let refundResult = null;
  let refundsConfirmed = false;
  let refundsConfirmedResult = null;

  if (paidBookings > 0) {
    const { data: registrations, error: regErr } = await sb
      .from('registrations')
      .select('id, payment_status, stripe_payment_intent_id, amount_paid, refund_email_sent_at')
      .eq('event_id', eventId)
      .eq('payment_status', 'Paid');
    if (regErr) throw new Error(regErr.message);

    if ((registrations || []).length) {
      refundResult = await issueEventRefundsInStripe(registrations || [], {
        connectEnabled: isStripeConnectEnabled(),
      });

      if (refundResult.allIssued) {
        const verification = await waitForEventRefundsInStripe(registrations || [], {
          attempts: 5,
          delayMs: 1500,
        });
        if (verification.allRefunded) {
          refundsConfirmedResult = await finalizeEventRefundsConfirmed(sb, cancellation.id, eventId);
          refundsConfirmed = true;
        }
      }
    }
  }

  let organiserEmailResult = null;
  try {
    organiserEmailResult = await sendOrganiserEventRemovedEmail(sb, {
      eventId,
      eventRow: row,
      reason,
      details,
      paidBookings,
      refundsConfirmed,
    });
  } catch (e) {
    organiserEmailResult = { sent: false, error: e.message || String(e) };
  }

  let moderationResult = null;
  if (row.organiser_id) {
    try {
      const { recordConductWarningFromAdminRemoval } = require('./organiser-moderation');
      moderationResult = await recordConductWarningFromAdminRemoval(sb, {
        organiserId: row.organiser_id,
        reason,
        details,
        eventId,
        eventCancellationId: cancellation.id,
        adminUserId,
      });
    } catch (e) {
      moderationResult = { error: e.message || String(e) };
    }
  }

  return {
    id: eventId,
    removed: true,
    title,
    paidBookings,
    activeBookings: sales.activeBookings,
    emailResult,
    organiserEmailResult,
    moderationResult,
    refundResult,
    refundsConfirmed,
    refundsEmailResult: refundsConfirmedResult?.emailResult || null,
  };
}

module.exports = {
  ADMIN_REMOVAL_REASONS,
  eventNeedsAdminRemovalFlow,
  adminRemoveEvent,
};
