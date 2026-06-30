const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { resolveOrganiserAccess } = require('./supabase-organiser-access');
const { sendRegistrationEmails, sendApplicationDecisionEmails } = require('./registration-emails');
const { isUuid } = require('./uuid');

function parsePriceNum(raw) {
  if (raw == null || raw === '') return 0;
  const n = Number(String(raw).replace(/[£,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

async function loadRegistrationForReview(sb, registrationId) {
  const { data, error } = await sb
    .from('registrations')
    .select(
      `
      id,
      created_at,
      event_id,
      ticket_id,
      organiser_id,
      attendee_id,
      application_status,
      payment_status,
      amount_paid,
      quantity,
      screening_answer_industry,
      screening_answer_job_title,
      cancelled_at,
      attendees ( id, name, email ),
      events ( id, title, slug, organiser_id ),
      tickets ( id, name, price )
    `
    )
    .eq('id', registrationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function assertOrganiserCanReviewRegistration(session, registration) {
  if (!registration?.id) {
    const err = new Error('registration_not_found');
    err.status = 404;
    err.code = 'registration_not_found';
    throw err;
  }
  if (registration.cancelled_at) {
    const err = new Error('registration_cancelled');
    err.status = 400;
    err.code = 'registration_cancelled';
    throw err;
  }
  if (String(registration.application_status || '').trim() !== 'Pending') {
    const err = new Error('application_not_pending');
    err.status = 400;
    err.code = 'application_not_pending';
    throw err;
  }

  const access = await resolveOrganiserAccess(session);
  if (!access.role) {
    const err = new Error('not_authenticated');
    err.status = 401;
    err.code = 'not_authenticated';
    throw err;
  }

  const event = registration.events || {};
  const organiserId = String(registration.organiser_id || event.organiser_id || '').trim();
  const allowed = new Set(access.groupIds || []);
  if (!organiserId || !allowed.has(organiserId)) {
    const err = new Error('not_allowed');
    err.status = 403;
    err.code = 'not_allowed';
    throw err;
  }

  return access;
}

/**
 * Approve or deny a pending OSOP application (organiser only).
 */
async function reviewApplicationForOrganiser(session, registrationId, action) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');

  const id = String(registrationId || '').trim();
  const decision = String(action || '').trim().toLowerCase();
  if (!isUuid(id)) {
    const err = new Error('invalid_registration_id');
    err.status = 400;
    err.code = 'invalid_registration_id';
    throw err;
  }
  if (decision !== 'approve' && decision !== 'deny') {
    const err = new Error('invalid_action');
    err.status = 400;
    err.code = 'invalid_action';
    throw err;
  }

  const sb = getSupabaseAdmin();
  const registration = await loadRegistrationForReview(sb, id);
  await assertOrganiserCanReviewRegistration(session, registration);

  const ticket = registration.tickets || {};
  const unitPrice = parsePriceNum(ticket.price);
  const isFree = unitPrice <= 0;

  let patch;
  if (decision === 'deny') {
    patch = { application_status: 'Denied' };
  } else if (isFree) {
    patch = {
      application_status: 'Approved',
      payment_status: 'Free',
      amount_paid: 0,
    };
  } else {
    patch = {
      application_status: 'Approved',
      payment_status: 'Pending',
      amount_paid: 0,
    };
  }

  const { data: updated, error: updateError } = await sb
    .from('registrations')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (updateError) throw new Error(updateError.message);

  let emailResult = null;
  try {
    if (decision === 'deny') {
      emailResult = await sendApplicationDecisionEmails(sb, updated, { decision: 'denied' });
    } else if (isFree) {
      emailResult = await sendRegistrationEmails(sb, updated);
    } else {
      emailResult = await sendApplicationDecisionEmails(sb, updated, {
        decision: 'approved',
        ticketPrice: unitPrice,
      });
    }
  } catch (e) {
    emailResult = { error: e.message || String(e) };
  }

  return {
    action: decision,
    id: updated.id,
    applicationStatus: updated.application_status,
    paymentStatus: updated.payment_status,
    registration: updated,
    emailResult,
  };
}

module.exports = {
  reviewApplicationForOrganiser,
  loadRegistrationForReview,
};
