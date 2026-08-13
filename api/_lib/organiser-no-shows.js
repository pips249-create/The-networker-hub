/**
 * Organiser marks a registration as did-not-attend so they skip the review
 * email and cannot leave a review for that event.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');

function throwStatus(message, status) {
  const err = new Error(message);
  err.status = status || 400;
  err.code = message;
  throw err;
}

function eventHasStarted(eventRow) {
  const startRaw = eventRow?.starts_at || eventRow?.ends_at || null;
  if (!startRaw) return false;
  const ms = new Date(startRaw).getTime();
  return !Number.isNaN(ms) && ms <= Date.now();
}

async function loadOwnedRegistration(sb, registrationId, groupIds) {
  const id = String(registrationId || '').trim();
  if (!id) throwStatus('missing_registration_id', 400);

  const { data, error } = await sb
    .from('registrations')
    .select(
      'id, organiser_id, event_id, attendee_id, payment_status, application_status, cancelled_at, no_show_at, no_show_marked_by'
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throwStatus('registration_not_found', 404);

  const orgId = String(data.organiser_id || '').trim();
  if (!orgId || !(groupIds || []).includes(orgId)) {
    throwStatus('registration_not_found', 403);
  }
  return data;
}

async function assertNoExistingReview(sb, attendeeId, eventId) {
  const attId = String(attendeeId || '').trim();
  const evId = String(eventId || '').trim();
  if (!attId || !evId) return;
  const { data, error } = await sb
    .from('reviews')
    .select('id')
    .eq('attendee_id', attId)
    .eq('event_id', evId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.id) throwStatus('review_already_submitted', 400);
}

async function markRegistrationNoShow(session, { registrationId, groupIds, userId }) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const sb = getSupabaseAdmin();
  const registration = await loadOwnedRegistration(sb, registrationId, groupIds);

  if (registration.cancelled_at) throwStatus('registration_cancelled', 400);
  if (String(registration.application_status || '').trim() === 'Denied') {
    throwStatus('registration_not_eligible', 400);
  }
  if (String(registration.application_status || '').trim() === 'Pending') {
    throwStatus('registration_not_eligible', 400);
  }
  if (registration.no_show_at) {
    return { registration, already: true };
  }

  const { data: eventRow, error: evErr } = await sb
    .from('events')
    .select('id, starts_at, ends_at, status')
    .eq('id', registration.event_id)
    .maybeSingle();
  if (evErr) throw new Error(evErr.message);
  if (!eventRow) throwStatus('event_not_found', 404);
  if (String(eventRow.status || '').toLowerCase() === 'cancelled') {
    throwStatus('event_cancelled', 400);
  }
  if (!eventHasStarted(eventRow)) throwStatus('event_not_started', 400);

  await assertNoExistingReview(sb, registration.attendee_id, registration.event_id);

  const now = new Date().toISOString();
  const markedBy = String(userId || session?.sub || '').trim() || null;
  const { data, error } = await sb
    .from('registrations')
    .update({
      no_show_at: now,
      no_show_marked_by: markedBy,
    })
    .eq('id', registration.id)
    .is('no_show_at', null)
    .select('id, no_show_at')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throwStatus('registration_not_found', 404);

  return { registration: { ...registration, no_show_at: data.no_show_at }, already: false };
}

async function unmarkRegistrationNoShow(session, { registrationId, groupIds }) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const sb = getSupabaseAdmin();
  const registration = await loadOwnedRegistration(sb, registrationId, groupIds);

  if (!registration.no_show_at) {
    return { registration, already: true };
  }

  await assertNoExistingReview(sb, registration.attendee_id, registration.event_id);

  const { data, error } = await sb
    .from('registrations')
    .update({
      no_show_at: null,
      no_show_marked_by: null,
    })
    .eq('id', registration.id)
    .select('id, no_show_at')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throwStatus('registration_not_found', 404);

  return { registration: { ...registration, no_show_at: null }, already: false };
}

module.exports = {
  markRegistrationNoShow,
  unmarkRegistrationNoShow,
};
