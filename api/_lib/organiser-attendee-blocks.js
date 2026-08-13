/**
 * Organiser-page attendance blocks — stop a person booking future events
 * for that organiser page (not a Hub-wide ban).
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { issueRefundForRegistration } = require('./stripe-refunds');
const {
  sendBookingCancelledEmail,
  sendOrganiserBookingCancelledEmail,
  sendRefundProcessedEmail,
} = require('./cancellation-emails');

const BLOCK_STATUS_ACTIVE = 'active';
const BLOCK_STATUS_REMOVED = 'removed';

function normalizeBlockEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function throwBlockedError() {
  const err = new Error('organiser_attendance_blocked');
  err.status = 403;
  err.code = 'organiser_attendance_blocked';
  throw err;
}

async function findActiveBlock(sb, { organiserId, email, attendeeId }) {
  const orgId = String(organiserId || '').trim();
  if (!orgId) return null;

  const em = normalizeBlockEmail(email);
  if (em) {
    const byEmail = await sb
      .from('organiser_attendee_blocks')
      .select('*')
      .eq('organiser_id', orgId)
      .eq('status', BLOCK_STATUS_ACTIVE)
      .eq('email', em)
      .maybeSingle();
    if (byEmail.error) throw new Error(byEmail.error.message);
    if (byEmail.data) return byEmail.data;
  }

  const attId = String(attendeeId || '').trim();
  if (attId) {
    const byAttendee = await sb
      .from('organiser_attendee_blocks')
      .select('*')
      .eq('organiser_id', orgId)
      .eq('status', BLOCK_STATUS_ACTIVE)
      .eq('attendee_id', attId)
      .maybeSingle();
    if (byAttendee.error) throw new Error(byAttendee.error.message);
    if (byAttendee.data) return byAttendee.data;
  }

  return null;
}

async function assertNotBlockedByOrganiser(sb, { organiserId, email, attendeeId }) {
  const row = await findActiveBlock(sb, { organiserId, email, attendeeId });
  if (row) throwBlockedError();
  return { blocked: false };
}

async function resolveAttendeeIdFromEmail(sb, email) {
  const em = normalizeBlockEmail(email);
  if (!em) return null;
  const { data, error } = await sb
    .from('attendees')
    .select('id')
    .ilike('email', em)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id || null;
}

async function resolveBlockTarget(sb, { organiserId, email, attendeeId, registrationId }) {
  const orgId = String(organiserId || '').trim();
  let em = normalizeBlockEmail(email);
  let attId = String(attendeeId || '').trim() || null;
  let registration = null;

  const regId = String(registrationId || '').trim();
  if (regId) {
    const { data, error } = await sb
      .from('registrations')
      .select(
        'id, organiser_id, event_id, attendee_id, payment_status, application_status, cancelled_at, amount_paid, stripe_payment_intent_id, attendees ( id, email, name )'
      )
      .eq('id', regId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      const err = new Error('registration_not_found');
      err.status = 404;
      throw err;
    }
    registration = data;
    const regOrg = String(data.organiser_id || '').trim();
    if (orgId && regOrg && orgId !== regOrg) {
      const err = new Error('registration_organiser_mismatch');
      err.status = 403;
      throw err;
    }
    if (!em) em = normalizeBlockEmail(data.attendees?.email);
    if (!attId) attId = String(data.attendee_id || data.attendees?.id || '').trim() || null;
    return {
      organiserId: orgId || regOrg,
      email: em,
      attendeeId: attId,
      name: String(data.attendees?.name || '').trim(),
      registration,
    };
  }

  if (!orgId) {
    const err = new Error('missing_organiser_id');
    err.status = 400;
    throw err;
  }
  if (!em && attId) {
    const { data, error } = await sb
      .from('attendees')
      .select('id, email, name')
      .eq('id', attId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      const err = new Error('attendee_not_found');
      err.status = 404;
      throw err;
    }
    em = normalizeBlockEmail(data.email);
    return {
      organiserId: orgId,
      email: em,
      attendeeId: attId,
      name: String(data.name || '').trim(),
      registration: null,
    };
  }

  if (!em) {
    const err = new Error('missing_email');
    err.status = 400;
    throw err;
  }
  if (!attId) {
    attId = await resolveAttendeeIdFromEmail(sb, em);
  }
  return { organiserId: orgId, email: em, attendeeId: attId, name: '', registration: null };
}

/**
 * Cancel upcoming active bookings for this person on this organiser page,
 * refund paid tickets, and deny pending applications.
 */
async function cancelUpcomingForBlockedPerson(sb, { organiserId, email, attendeeId }) {
  const orgId = String(organiserId || '').trim();
  const em = normalizeBlockEmail(email);
  if (!orgId || !em) return { cancelled: [], denied: [] };

  const nowIso = new Date().toISOString();
  const { data: events, error: evErr } = await sb
    .from('events')
    .select('id, starts_at')
    .eq('organiser_id', orgId);
  if (evErr) throw new Error(evErr.message);

  const upcomingEventIds = (events || [])
    .filter((ev) => {
      if (!ev.starts_at) return true;
      return new Date(ev.starts_at).getTime() >= Date.now() - 60 * 60 * 1000;
    })
    .map((ev) => ev.id);
  if (!upcomingEventIds.length) return { cancelled: [], denied: [] };

  let attId = String(attendeeId || '').trim();
  if (!attId) {
    attId = await resolveAttendeeIdFromEmail(sb, em);
  }
  if (!attId) return { cancelled: [], denied: [] };

  const { data: regs, error: regErr } = await sb
    .from('registrations')
    .select(
      'id, attendee_id, event_id, organiser_id, payment_status, amount_paid, cancelled_at, application_status, stripe_payment_intent_id'
    )
    .eq('organiser_id', orgId)
    .eq('attendee_id', attId)
    .in('event_id', upcomingEventIds)
    .is('cancelled_at', null)
    .neq('payment_status', 'Refunded');
  if (regErr) throw new Error(regErr.message);

  const cancelled = [];
  const denied = [];

  for (const registration of regs || []) {
    const appStatus = String(registration.application_status || '').trim();
    if (appStatus === 'Pending') {
      const { error } = await sb
        .from('registrations')
        .update({
          application_status: 'Denied',
          application_denial_reason: 'Unable to attend this organisers events.',
          application_decided_at: nowIso,
          cancelled_at: nowIso,
          payment_status:
            String(registration.payment_status || '').trim() === 'Free'
              ? 'Refunded'
              : registration.payment_status,
        })
        .eq('id', registration.id);
      if (error) throw new Error(error.message);
      denied.push(registration.id);
      continue;
    }
    if (appStatus === 'Denied') continue;

    const paymentStatus = String(registration.payment_status || '').trim();
    const patch = { cancelled_at: nowIso };
    if (paymentStatus === 'Free' || paymentStatus === 'Pending') {
      patch.payment_status = 'Refunded';
    }

    const { error: updateError } = await sb
      .from('registrations')
      .update(patch)
      .eq('id', registration.id);
    if (updateError) throw new Error(updateError.message);

    let refundResult = null;
    const shouldRefund = paymentStatus === 'Paid' && Number(registration.amount_paid) > 0;
    if (shouldRefund) {
      try {
        refundResult = await issueRefundForRegistration(registration);
        if (refundResult?.issued) {
          await sb
            .from('registrations')
            .update({ payment_status: 'Refunded', cancelled_at: nowIso })
            .eq('id', registration.id);
        }
      } catch (e) {
        refundResult = { issued: false, error: e.message || String(e) };
      }
    }

    const refundIssued = Boolean(refundResult?.issued && !refundResult?.skipped);
    const emailOptions = { refundIssued };
    let emailResult = null;
    let organiserEmailResult = null;
    let refundEmailResult = null;
    try {
      emailResult = await sendBookingCancelledEmail(sb, registration.id, emailOptions);
    } catch (e) {
      emailResult = { sent: false, error: e.message || String(e) };
    }
    try {
      organiserEmailResult = await sendOrganiserBookingCancelledEmail(
        sb,
        registration.id,
        emailOptions
      );
    } catch (e) {
      organiserEmailResult = { sent: false, error: e.message || String(e) };
    }
    if (refundIssued) {
      try {
        refundEmailResult = await sendRefundProcessedEmail(
          sb,
          registration.id,
          registration.amount_paid
        );
      } catch (e) {
        refundEmailResult = { sent: false, error: e.message || String(e) };
      }
    }

    cancelled.push({
      registrationId: registration.id,
      refundIssued,
      refundPending: Boolean(shouldRefund && !refundIssued),
      emailResult,
      organiserEmailResult,
      refundEmailResult,
    });
  }

  return { cancelled, denied };
}

async function blockAttendeeForOrganiser(opts) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const sb = getSupabaseAdmin();
  const target = await resolveBlockTarget(sb, opts);
  const orgId = String(target.organiserId || '').trim();
  const em = normalizeBlockEmail(target.email);
  if (!orgId || !em) {
    const err = new Error('missing_block_target');
    err.status = 400;
    throw err;
  }

  const reason = String(opts.reason || '')
    .trim()
    .slice(0, 500);
  const createdBy = String(opts.createdBy || opts.userId || '').trim() || null;
  const now = new Date().toISOString();

  const existing = await sb
    .from('organiser_attendee_blocks')
    .select('*')
    .eq('organiser_id', orgId)
    .eq('email', em)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);

  let block;
  if (existing.data) {
    const { data, error } = await sb
      .from('organiser_attendee_blocks')
      .update({
        status: BLOCK_STATUS_ACTIVE,
        reason: reason || existing.data.reason || null,
        attendee_id: target.attendeeId || existing.data.attendee_id || null,
        created_by: createdBy || existing.data.created_by || null,
        updated_at: now,
      })
      .eq('id', existing.data.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    block = data;
  } else {
    const { data, error } = await sb
      .from('organiser_attendee_blocks')
      .insert({
        organiser_id: orgId,
        email: em,
        attendee_id: target.attendeeId || null,
        reason: reason || null,
        created_by: createdBy,
        status: BLOCK_STATUS_ACTIVE,
        updated_at: now,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    block = data;
  }

  const cancelUpcoming = opts.cancelUpcoming !== false;
  let cancellations = { cancelled: [], denied: [] };
  if (cancelUpcoming) {
    cancellations = await cancelUpcomingForBlockedPerson(sb, {
      organiserId: orgId,
      email: em,
      attendeeId: target.attendeeId,
    });
  }

  return {
    block,
    name: target.name,
    cancelledCount: (cancellations.cancelled || []).length,
    deniedCount: (cancellations.denied || []).length,
    cancellations,
  };
}

async function unblockAttendeeForOrganiser(opts) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const sb = getSupabaseAdmin();
  const blockId = String(opts.blockId || opts.id || '').trim();
  const orgId = String(opts.organiserId || '').trim();
  const now = new Date().toISOString();

  if (blockId) {
    let q = sb
      .from('organiser_attendee_blocks')
      .update({ status: BLOCK_STATUS_REMOVED, updated_at: now })
      .eq('id', blockId);
    if (orgId) q = q.eq('organiser_id', orgId);
    const { data, error } = await q.select('*').maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      const err = new Error('block_not_found');
      err.status = 404;
      throw err;
    }
    return { block: data };
  }

  const em = normalizeBlockEmail(opts.email);
  if (!orgId || !em) {
    const err = new Error('missing_block_target');
    err.status = 400;
    throw err;
  }

  const { data, error } = await sb
    .from('organiser_attendee_blocks')
    .update({ status: BLOCK_STATUS_REMOVED, updated_at: now })
    .eq('organiser_id', orgId)
    .eq('email', em)
    .eq('status', BLOCK_STATUS_ACTIVE)
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    const err = new Error('block_not_found');
    err.status = 404;
    throw err;
  }
  return { block: data };
}

function mapBlockRow(row) {
  const email = normalizeBlockEmail(row.email || row.attendees?.email);
  const name = String(row.attendees?.name || '').trim();
  return {
    id: row.id,
    organiserId: row.organiser_id,
    email,
    attendeeId: row.attendee_id || null,
    name: name || (email ? email.split('@')[0] : 'Attendee'),
    reason: String(row.reason || '').trim(),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listBlocksForOrganiser(organiserId, { status = 'active' } = {}) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const sb = getSupabaseAdmin();
  const orgId = String(organiserId || '').trim();
  if (!orgId) return [];

  const st = String(status || 'active').toLowerCase();
  let q = sb
    .from('organiser_attendee_blocks')
    .select('id, created_at, updated_at, organiser_id, email, attendee_id, reason, status')
    .eq('organiser_id', orgId)
    .order('created_at', { ascending: false });

  if (st === 'active' || st === 'removed') {
    q = q.eq('status', st);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(mapBlockRow);
}

async function listBlocksForOrganiserIds(organiserIds, { status = 'active' } = {}) {
  const ids = [...new Set((organiserIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return [];
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const sb = getSupabaseAdmin();

  const st = String(status || 'active').toLowerCase();
  let q = sb
    .from('organiser_attendee_blocks')
    .select('id, created_at, updated_at, organiser_id, email, attendee_id, reason, status')
    .in('organiser_id', ids)
    .order('created_at', { ascending: false });

  if (st === 'active' || st === 'removed') {
    q = q.eq('status', st);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(mapBlockRow);
}

module.exports = {
  BLOCK_STATUS_ACTIVE,
  BLOCK_STATUS_REMOVED,
  normalizeBlockEmail,
  findActiveBlock,
  assertNotBlockedByOrganiser,
  blockAttendeeForOrganiser,
  unblockAttendeeForOrganiser,
  listBlocksForOrganiser,
  listBlocksForOrganiserIds,
  cancelUpcomingForBlockedPerson,
};
