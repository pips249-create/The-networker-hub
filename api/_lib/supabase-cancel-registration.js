const { getSupabaseAdmin } = require('./supabase');
const { resolveAttendeeId } = require('./supabase-favourites');
const { sendBookingCancelledEmail, sendOrganiserBookingCancelledEmail, sendRefundProcessedEmail } = require('./cancellation-emails');
const {
  isRefundEligibleForCancellation,
  isSelfServiceCancellationAllowed,
  cancellationBlockedMessage,
} = require('./cancellation-email-sections');
const { issueRefundForRegistration } = require('./stripe-refunds');

async function cancelRegistrationForAttendee(session, registrationId) {
  const sb = getSupabaseAdmin();
  const attendeeId = await resolveAttendeeId(sb, session);
  if (!attendeeId) {
    const e = new Error('Not signed in');
    e.status = 401;
    throw e;
  }

  const { data: registration, error } = await sb
    .from('registrations')
    .select(
      'id, attendee_id, event_id, organiser_id, payment_status, amount_paid, cancelled_at, application_status, stripe_payment_intent_id'
    )
    .eq('id', registrationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!registration || registration.attendee_id !== attendeeId) {
    const e = new Error('Booking not found');
    e.status = 404;
    throw e;
  }
  if (registration.cancelled_at || registration.payment_status === 'Refunded') {
    const e = new Error('This booking is already cancelled');
    e.status = 400;
    throw e;
  }
  if (String(registration.application_status || '').trim() === 'Denied') {
    const e = new Error('This booking cannot be cancelled');
    e.status = 400;
    throw e;
  }

  const { data: eventRow, error: eventError } = await sb
    .from('events')
    .select('id, status, starts_at, refund_policy, refund_policy_details, refund_cutoff_days')
    .eq('id', registration.event_id)
    .maybeSingle();
  if (eventError) throw new Error(eventError.message);
  if (!eventRow) {
    const e = new Error('Event not found');
    e.status = 404;
    throw e;
  }

  if (!isSelfServiceCancellationAllowed(eventRow, registration)) {
    const e = new Error(cancellationBlockedMessage(eventRow));
    e.status = 400;
    e.code = 'cancellation_not_allowed';
    throw e;
  }

  const refundEligible = isRefundEligibleForCancellation(eventRow, registration);
  const now = new Date().toISOString();
  const patch = { cancelled_at: now };
  const paymentStatus = String(registration.payment_status || '').trim();
  if (paymentStatus === 'Free') {
    patch.payment_status = 'Refunded';
  }

  const { error: updateError } = await sb
    .from('registrations')
    .update(patch)
    .eq('id', registrationId);
  if (updateError) throw new Error(updateError.message);

  let refundResult = null;
  if (refundEligible) {
    try {
      refundResult = await issueRefundForRegistration(registration);
      if (refundResult?.issued) {
        await sb
          .from('registrations')
          .update({ payment_status: 'Refunded', cancelled_at: now })
          .eq('id', registrationId);
      }
    } catch (e) {
      refundResult = { issued: false, error: e.message || String(e) };
    }
  }

  let emailResult = null;
  let organiserEmailResult = null;
  let refundEmailResult = null;
  const refundIssued = Boolean(refundResult?.issued && !refundResult?.skipped);
  const emailOptions = {
    refundIssued,
    sessionEmail: String(session?.email || '').trim(),
  };
  try {
    emailResult = await sendBookingCancelledEmail(sb, registrationId, emailOptions);
  } catch (e) {
    emailResult = { sent: false, error: e.message || String(e), code: e.code || null };
  }
  try {
    organiserEmailResult = await sendOrganiserBookingCancelledEmail(sb, registrationId, emailOptions);
  } catch (e) {
    organiserEmailResult = { sent: false, error: e.message || String(e), code: e.code || null };
  }
  if (refundIssued) {
    try {
      refundEmailResult = await sendRefundProcessedEmail(sb, registrationId, registration.amount_paid);
    } catch (e) {
      refundEmailResult = { sent: false, error: e.message || String(e), code: e.code || null };
    }
  }

  return {
    registrationId,
    paymentStatus: registration.payment_status,
    amountPaid: registration.amount_paid,
    refundEligible,
    refundIssued,
    refundResult,
    emailResult,
    organiserEmailResult,
    refundEmailResult,
  };
}

module.exports = {
  cancelRegistrationForAttendee,
};
