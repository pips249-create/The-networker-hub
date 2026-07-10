const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { resolveOrganiserAccess } = require('./supabase-organiser-access');
const {
  sendRegistrationEmails,
  sendApplicationDecisionEmails,
  sendOrganiserApplicationAlertEmail,
} = require('./registration-emails');
const { assertApplicationSeatAvailable } = require('./application-capacity');
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
 * Approve or deny a pending Category Exclusivity application (organiser only).
 */
function normalizeDenialReason(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  return text.slice(0, 400);
}

async function reviewApplicationForOrganiser(session, registrationId, action, options = {}) {
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

  if (decision === 'approve') {
    await assertApplicationSeatAvailable(sb, ticket);
  }

  let patch;
  const decidedAt = new Date().toISOString();
  if (decision === 'deny') {
    patch = {
      application_status: 'Denied',
      application_denial_reason: normalizeDenialReason(options.denialReason),
      application_decided_at: decidedAt,
    };
  } else if (isFree) {
    patch = {
      application_status: 'Approved',
      payment_status: 'Free',
      amount_paid: 0,
      application_decided_at: decidedAt,
    };
  } else {
    patch = {
      application_status: 'Approved',
      payment_status: 'Pending',
      amount_paid: 0,
      application_decided_at: decidedAt,
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

async function resendApplicationOrganiserAlert(session, registrationId) {
  const sb = getSupabaseAdmin();
  const registration = await loadRegistrationForReview(sb, registrationId);
  await assertOrganiserCanReviewRegistration(session, registration);
  const fallbackEmail = String(session?.email || '').trim().toLowerCase();
  return sendOrganiserApplicationAlertEmail(sb, registration, { fallbackEmail });
}

async function assertOrganiserCanAccessRegistration(session, registration) {
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

async function resendApprovalEmailForOrganiser(session, registrationId) {
  const sb = getSupabaseAdmin();
  const id = String(registrationId || '').trim();
  if (!isUuid(id)) {
    const err = new Error('invalid_registration_id');
    err.status = 400;
    err.code = 'invalid_registration_id';
    throw err;
  }

  const registration = await loadRegistrationForReview(sb, id);
  await assertOrganiserCanAccessRegistration(session, registration);

  if (String(registration.application_status || '').trim() !== 'Approved') {
    const err = new Error('application_not_approved');
    err.status = 400;
    err.code = 'application_not_approved';
    throw err;
  }
  if (String(registration.payment_status || '').trim() !== 'Pending') {
    const err = new Error('payment_not_pending');
    err.status = 400;
    err.code = 'payment_not_pending';
    throw err;
  }

  const ticket = registration.tickets || {};
  const unitPrice = parsePriceNum(ticket.price);
  if (unitPrice <= 0) {
    const err = new Error('not_awaiting_payment');
    err.status = 400;
    err.code = 'not_awaiting_payment';
    throw err;
  }

  const emailResult = await sendApplicationDecisionEmails(sb, registration, {
    decision: 'approved',
    ticketPrice: unitPrice,
  });

  return { emailResult, to: registration.attendees?.email || '' };
}

async function assertOrganiserCanReconsiderArchived(session, registration) {
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
  if (String(registration.application_status || '').trim() !== 'Denied') {
    const err = new Error('application_not_archived');
    err.status = 400;
    err.code = 'application_not_archived';
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
 * Move an archived (denied) Category Exclusivity application back to pending, or approve it now.
 */
async function reconsiderArchivedApplicationForOrganiser(session, registrationId, mode) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');

  const id = String(registrationId || '').trim();
  const reconsiderMode = String(mode || '').trim().toLowerCase();
  if (!isUuid(id)) {
    const err = new Error('invalid_registration_id');
    err.status = 400;
    err.code = 'invalid_registration_id';
    throw err;
  }
  if (reconsiderMode !== 'pending' && reconsiderMode !== 'approve') {
    const err = new Error('invalid_reconsider_mode');
    err.status = 400;
    err.code = 'invalid_reconsider_mode';
    throw err;
  }

  const sb = getSupabaseAdmin();
  const registration = await loadRegistrationForReview(sb, id);
  await assertOrganiserCanReconsiderArchived(session, registration);

  const ticket = registration.tickets || {};
  const unitPrice = parsePriceNum(ticket.price);
  const isFree = unitPrice <= 0;
  const decidedAt = new Date().toISOString();

  let patch;
  let emailResult = null;

  if (reconsiderMode === 'pending') {
    patch = {
      application_status: 'Pending',
      application_denial_reason: null,
      application_decided_at: null,
    };
  } else {
    await assertApplicationSeatAvailable(sb, ticket, { excludeRegistrationId: id });
    if (isFree) {
      patch = {
        application_status: 'Approved',
        payment_status: 'Free',
        amount_paid: 0,
        application_denial_reason: null,
        application_decided_at: decidedAt,
      };
    } else {
      patch = {
        application_status: 'Approved',
        payment_status: 'Pending',
        amount_paid: 0,
        application_denial_reason: null,
        application_decided_at: decidedAt,
      };
    }
  }

  const { data: updated, error: updateError } = await sb
    .from('registrations')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (updateError) throw new Error(updateError.message);

  if (reconsiderMode === 'approve') {
    try {
      if (isFree) {
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
  }

  return {
    action: reconsiderMode === 'approve' ? 'approve' : 'pending',
    reconsiderMode,
    id: updated.id,
    applicationStatus: updated.application_status,
    paymentStatus: updated.payment_status,
    registration: updated,
    emailResult,
  };
}

module.exports = {
  reviewApplicationForOrganiser,
  reconsiderArchivedApplicationForOrganiser,
  resendApplicationOrganiserAlert,
  resendApprovalEmailForOrganiser,
  loadRegistrationForReview,
};
