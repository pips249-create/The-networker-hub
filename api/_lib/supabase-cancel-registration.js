const { getSupabaseAdmin } = require('./supabase');
const { resolveAttendeeId } = require('./supabase-favourites');
const { sendBookingCancelledEmail, sendOrganiserBookingCancelledEmail } = require('./cancellation-emails');
const { isRefundEligibleForCancellation } = require('./cancellation-email-sections');

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
      'id, attendee_id, event_id, payment_status, amount_paid, cancelled_at, application_status'
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
  if (String(eventRow.status || '').toLowerCase() === 'cancelled') {
    const e = new Error('This event has already been cancelled by the organiser');
    e.status = 400;
    throw e;
  }

  const startsAt = eventRow.starts_at ? new Date(eventRow.starts_at) : null;
  if (startsAt && !Number.isNaN(startsAt.getTime()) && startsAt.getTime() < Date.now()) {
    const e = new Error('Past events cannot be cancelled from your account');
    e.status = 400;
    throw e;
  }

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

  let emailResult = null;
  let organiserEmailResult = null;
  try {
    emailResult = await sendBookingCancelledEmail(sb, registrationId);
  } catch (e) {
    emailResult = { error: e.message || String(e) };
  }
  try {
    organiserEmailResult = await sendOrganiserBookingCancelledEmail(sb, registrationId);
  } catch (e) {
    organiserEmailResult = { error: e.message || String(e) };
  }

  return {
    registrationId,
    refundEligible: isRefundEligibleForCancellation(eventRow, registration),
    emailResult,
    organiserEmailResult,
  };
}

module.exports = {
  cancelRegistrationForAttendee,
};
