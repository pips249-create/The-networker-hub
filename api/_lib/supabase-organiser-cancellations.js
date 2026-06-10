/**
 * Locked-event cancellation flow.
 */
const { getSupabaseAdmin } = require('./supabase');
const { resolveOrganiserAccess } = require('./supabase-organiser-access');
const {
  sendEventCancelledEmailsForEvent,
  sendRefundProcessedEmailsForEvent,
} = require('./cancellation-emails');

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

async function cancelLockedEvent(session, eventId, payload) {
  const reason = String(payload.reason || '').trim();
  const details = String(payload.details || '').trim();
  const refundTermsConfirmed = Boolean(payload.refundTermsConfirmed);

  if (!CANCELLATION_REASONS.has(reason)) {
    const e = new Error('Select a cancellation reason');
    e.status = 400;
    throw e;
  }
  if (!refundTermsConfirmed) {
    const e = new Error('You must confirm you will refund all attendees within 14 days');
    e.status = 400;
    throw e;
  }

  const access = await resolveOrganiserAccess(session);
  const groupIds = access.groupIds || [];
  const sb = getSupabaseAdmin();
  const row = await assertEventOwned(sb, session, eventId, groupIds);

  if (!row.locked) {
    const e = new Error('This event is not locked — use the standard unpublish flow');
    e.status = 400;
    throw e;
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

  return { cancellation, event: updated, emailResult };
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

  const { data, error } = await sb
    .from('event_cancellations')
    .update({ refunds_confirmed_at: new Date().toISOString() })
    .eq('id', cancellation.id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  let emailResult = null;
  try {
    emailResult = await sendRefundProcessedEmailsForEvent(sb, eventId);
  } catch (e) {
    emailResult = { error: e.message || String(e) };
  }

  return { cancellation: data, emailResult };
}

module.exports = {
  cancelLockedEvent,
  confirmRefundsIssued,
  CANCELLATION_REASONS: [...CANCELLATION_REASONS],
};
