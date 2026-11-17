const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { resolveAttendeeId } = require('./supabase-favourites');
const { resolveOrganiserAccess } = require('./supabase-organiser-access');
const { reviewerDisplayName, reviewerInitials } = require('./reviewer-display-name');
const { buildReviewerReward, reviewerRewardToastMessage } = require('./reviewer-reward');
const { isUuid } = require('./uuid');

const MAX_ORGANISER_REPLY = 2000;
const MAX_REVIEW_TEXT = 2000;

function sanitizeReviewPlainText(raw, maxLen) {
  let text = String(raw == null ? '' : raw)
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  text = text.trim();
  const limit = Number(maxLen) || MAX_REVIEW_TEXT;
  if (text.length > limit) text = text.slice(0, limit).trim();
  return text;
}

const ELIGIBLE_PAYMENT = new Set(['Paid', 'Free']);

function eventHasEnded(ev) {
  const endRaw = ev?.ends_at || ev?.starts_at || null;
  if (!endRaw) return false;
  const d = new Date(endRaw);
  return !Number.isNaN(d.getTime()) && d < new Date();
}

function isEligibleRegistration(reg) {
  if (!reg) return false;
  if (!ELIGIBLE_PAYMENT.has(reg.payment_status)) return false;
  if (reg.application_status && reg.application_status !== 'Approved') return false;
  return true;
}

async function findRegistrationForReview(sb, attendeeId, eventId) {
  let res = await sb
    .from('registrations')
    .select('id, payment_status, application_status, no_show_at')
    .eq('attendee_id', attendeeId)
    .eq('event_id', eventId)
    .neq('payment_status', 'Refunded')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (res.error && /no_show_at|column/i.test(res.error.message || '')) {
    res = await sb
      .from('registrations')
      .select('id, payment_status, application_status')
      .eq('attendee_id', attendeeId)
      .eq('event_id', eventId)
      .neq('payment_status', 'Refunded')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
  }
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

async function submitReviewForAttendeeId(attendeeId, input) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');

  const eventId = String(input.eventId || input.event_id || '').trim();
  if (!eventId) throw new Error('missing_event_id');

  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('invalid_rating');
  }

  const rawReview = String(input.reviewText || input.review_text || '');
  if (rawReview.trim().length > MAX_REVIEW_TEXT) throw new Error('review_text_too_long');
  const reviewText = sanitizeReviewPlainText(rawReview, MAX_REVIEW_TEXT);

  const sb = getSupabaseAdmin();
  const resolvedAttendeeId = String(attendeeId || '').trim();
  if (!resolvedAttendeeId) throw new Error('attendee_not_found');

  const [eventRes, existingReview] = await Promise.all([
    sb
      .from('events')
      .select('id, title, organiser_id, starts_at, ends_at')
      .eq('id', eventId)
      .maybeSingle(),
    sb
      .from('reviews')
      .select('id')
      .eq('attendee_id', resolvedAttendeeId)
      .eq('event_id', eventId)
      .maybeSingle(),
  ]);

  if (eventRes.error) throw new Error(eventRes.error.message);
  if (existingReview.error) throw new Error(existingReview.error.message);
  if (!eventRes.data?.id) throw new Error('event_not_found');
  if (existingReview.data?.id) throw new Error('review_already_submitted');

  const ev = eventRes.data;
  if (!eventHasEnded(ev)) throw new Error('event_not_finished');

  const registration = await findRegistrationForReview(sb, resolvedAttendeeId, eventId);
  if (registration && registration.no_show_at) {
    throw new Error('did_not_attend');
  }

  let provenance = 'verified';
  let attendanceClaimId = null;
  if (isEligibleRegistration(registration)) {
    provenance = 'verified';
  } else {
    const { findConfirmedClaimForReview } = require('./attendance-claims');
    const claim = await findConfirmedClaimForReview(sb, resolvedAttendeeId, eventId);
    if (!claim || claim.expired) {
      throw new Error(claim?.reason === 'review_window_expired' ? 'claim_review_expired' : 'not_eligible');
    }
    provenance = 'organiser_confirmed';
    attendanceClaimId = claim.id;
  }

  const organiserId = ev.organiser_id || null;
  if (!organiserId) throw new Error('missing_organiser');

  const insertRow = {
    attendee_id: resolvedAttendeeId,
    event_id: eventId,
    organiser_id: organiserId,
    rating,
    review_text: reviewText || null,
    provenance,
  };
  if (attendanceClaimId) insertRow.attendance_claim_id = attendanceClaimId;

  let ins = await sb
    .from('reviews')
    .insert(insertRow)
    .select('id, rating, review_text, created_at, provenance')
    .single();

  // Pre-migration environments: retry without provenance columns.
  if (ins.error && /provenance|attendance_claim_id|column/i.test(ins.error.message || '')) {
    if (provenance === 'organiser_confirmed') {
      throw new Error('attendance_claims_unavailable');
    }
    ins = await sb
      .from('reviews')
      .insert({
        attendee_id: resolvedAttendeeId,
        event_id: eventId,
        organiser_id: organiserId,
        rating,
        review_text: reviewText || null,
      })
      .select('id, rating, review_text, created_at')
      .single();
  }

  if (ins.error) throw new Error(ins.error.message);

  if (attendanceClaimId && ins.data?.id) {
    await sb
      .from('attendance_claims')
      .update({
        review_id: ins.data.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', attendanceClaimId)
      .eq('attendee_id', resolvedAttendeeId);
  }

  let reviewCount = 1;
  try {
    const { count, error: countErr } = await sb
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('attendee_id', resolvedAttendeeId);
    if (!countErr && count != null) reviewCount = Number(count) || 1;
  } catch {
    reviewCount = 1;
  }

  const reviewerReward = buildReviewerReward(reviewCount, {
    previousCount: Math.max(0, reviewCount - 1),
  });
  reviewerReward.toastMessage = reviewerRewardToastMessage(reviewerReward);

  return {
    id: ins.data.id,
    eventId,
    eventTitle: ev.title || 'Event',
    organiserId,
    rating: ins.data.rating,
    reviewText: ins.data.review_text,
    createdAt: ins.data.created_at,
    provenance: ins.data.provenance || provenance,
    reviewerReward,
  };
}

async function submitReview(session, input) {
  const sb = getSupabaseAdmin();
  const attendeeId = await resolveAttendeeId(sb, session);
  if (!attendeeId) throw new Error('attendee_not_found');
  return submitReviewForAttendeeId(attendeeId, input);
}

/**
 * Ended-event page CTA state: only confirmed attendees (Hub ticket or organiser-confirmed
 * claim) get a Leave a review action. Everyone else sees soft copy / claim path.
 */
async function getEventReviewCtaState(session, eventId) {
  const id = String(eventId || '').trim();
  if (!isUuid(id)) {
    return { ok: true, status: 'missing_event', canReview: false, canClaim: false };
  }
  if (!isSupabaseConfigured()) {
    return { ok: true, status: 'unavailable', canReview: false, canClaim: false };
  }
  if (!session) {
    return {
      ok: true,
      status: 'signed_out',
      canReview: false,
      canClaim: false,
      message: 'Attended? Check your email for a review link, or sign in to claim attendance.',
    };
  }

  const sb = getSupabaseAdmin();
  const attendeeId = await resolveAttendeeId(sb, session);
  if (!attendeeId) {
    return {
      ok: true,
      status: 'need_profile',
      canReview: false,
      canClaim: false,
      message: 'Finish your attendee profile to leave a review or claim attendance.',
    };
  }

  const { data: eventRow, error: evErr } = await sb
    .from('events')
    .select('id, title, starts_at, ends_at, status, organiser_id')
    .eq('id', id)
    .maybeSingle();
  if (evErr) throw new Error(evErr.message);
  if (!eventRow?.id) {
    return { ok: true, status: 'event_not_found', canReview: false, canClaim: false };
  }
  if (!eventHasEnded(eventRow)) {
    return {
      ok: true,
      status: 'event_not_finished',
      canReview: false,
      canClaim: false,
      message: 'You can leave a review after the event has finished.',
    };
  }

  const { data: existingReview, error: revErr } = await sb
    .from('reviews')
    .select('id, provenance')
    .eq('attendee_id', attendeeId)
    .eq('event_id', id)
    .maybeSingle();
  if (revErr) throw new Error(revErr.message);
  if (existingReview?.id) {
    return {
      ok: true,
      status: 'already_reviewed',
      canReview: false,
      canClaim: false,
      provenance: existingReview.provenance || 'verified',
      message: 'Thanks — your review for this event is already live.',
    };
  }

  const registration = await findRegistrationForReview(sb, attendeeId, id);
  if (registration && registration.no_show_at) {
    return {
      ok: true,
      status: 'did_not_attend',
      canReview: false,
      canClaim: false,
      message: 'This booking was marked as did not attend, so a review is not available.',
    };
  }
  if (isEligibleRegistration(registration)) {
    return {
      ok: true,
      status: 'leave_review',
      canReview: true,
      canClaim: false,
      provenance: 'verified',
      eventId: id,
      eventTitle: String(eventRow.title || 'Event').trim(),
      message: 'Leave a verified review for this event.',
    };
  }

  const { findConfirmedClaimForReview } = require('./attendance-claims');
  const claim = await findConfirmedClaimForReview(sb, attendeeId, id);
  if (claim && !claim.expired) {
    return {
      ok: true,
      status: 'leave_review',
      canReview: true,
      canClaim: false,
      provenance: 'organiser_confirmed',
      eventId: id,
      eventTitle: String(eventRow.title || 'Event').trim(),
      message: 'The organiser confirmed you attended — leave your review.',
    };
  }
  if (claim && claim.reason === 'review_window_expired') {
    return {
      ok: true,
      status: 'claim_review_expired',
      canReview: false,
      canClaim: false,
      message: 'Your review window after the organiser confirmed attendance has ended.',
    };
  }

  const { data: pendingClaim } = await sb
    .from('attendance_claims')
    .select('id, status, expires_at')
    .eq('attendee_id', attendeeId)
    .eq('event_id', id)
    .eq('status', 'pending')
    .maybeSingle();
  if (pendingClaim?.id) {
    return {
      ok: true,
      status: 'claim_pending',
      canReview: false,
      canClaim: false,
      message: 'Waiting for the organiser to confirm you attended. We’ll email you when you can review.',
    };
  }

  const eventStatus = String(eventRow.status || '')
    .trim()
    .toLowerCase();
  const claimableStatus = eventStatus === 'published' || eventStatus === 'archived';
  const endRaw = eventRow.ends_at || eventRow.starts_at;
  const endMs = endRaw ? new Date(endRaw).getTime() : NaN;
  const ageDays = Number.isNaN(endMs) ? Infinity : (Date.now() - endMs) / (24 * 60 * 60 * 1000);
  const withinClaimWindow = ageDays <= 90;

  if (claimableStatus && withinClaimWindow && !isEligibleRegistration(registration)) {
    return {
      ok: true,
      status: 'can_claim',
      canReview: false,
      canClaim: true,
      eventId: id,
      eventTitle: String(eventRow.title || 'Event').trim(),
      message:
        'Went without a Hub ticket? Ask the organiser to confirm you attended, then leave an organiser-confirmed review.',
    };
  }

  return {
    ok: true,
    status: 'not_eligible',
    canReview: false,
    canClaim: false,
    message: 'Attended? Check your email for a review link from The Networker UK.',
  };
}

async function submitReviewFromEmailToken(token, input) {
  const { verifyReviewLinkToken } = require('./review-link-token');
  const payload = verifyReviewLinkToken(token);
  if (!payload) throw new Error('invalid_review_link');

  const sb = getSupabaseAdmin();
  const { data: reg, error: regErr } = await sb
    .from('registrations')
    .select('id, attendee_id, event_id, payment_status, application_status, cancelled_at, no_show_at')
    .eq('id', payload.registrationId)
    .maybeSingle();
  if (regErr) throw new Error(regErr.message);
  if (!reg?.id) throw new Error('invalid_review_link');
  if (String(reg.attendee_id) !== payload.attendeeId || String(reg.event_id) !== payload.eventId) {
    throw new Error('invalid_review_link');
  }
  if (reg.cancelled_at) throw new Error('not_eligible');
  if (reg.no_show_at) throw new Error('did_not_attend');

  const eventId = String(input.eventId || input.event_id || payload.eventId || '').trim();
  if (eventId !== payload.eventId) throw new Error('invalid_review_link');

  return submitReviewForAttendeeId(payload.attendeeId, Object.assign({}, input, { eventId }));
}

async function replyToReviewAsOrganiser(session, reviewId, replyText) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');

  const id = String(reviewId || '').trim();
  if (!isUuid(id)) {
    const err = new Error('invalid_review_id');
    err.status = 400;
    err.code = 'invalid_review_id';
    throw err;
  }

  const rawReply = String(replyText == null ? '' : replyText);
  if (rawReply.trim().length > MAX_ORGANISER_REPLY) {
    const err = new Error('reply_too_long');
    err.status = 400;
    err.code = 'reply_too_long';
    throw err;
  }
  const reply = sanitizeReviewPlainText(rawReply, MAX_ORGANISER_REPLY);

  const access = await resolveOrganiserAccess(session);
  if (!access.role) {
    const err = new Error('not_authenticated');
    err.status = 401;
    err.code = 'not_authenticated';
    throw err;
  }

  const sb = getSupabaseAdmin();
  const existing = await sb
    .from('reviews')
    .select('id, organiser_id, organiser_response')
    .eq('id', id)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (!existing.data?.id) {
    const err = new Error('review_not_found');
    err.status = 404;
    err.code = 'review_not_found';
    throw err;
  }

  const organiserId = String(existing.data.organiser_id || '').trim();
  const allowed = new Set(access.groupIds || []);
  if (!organiserId || !allowed.has(organiserId)) {
    const err = new Error('not_allowed');
    err.status = 403;
    err.code = 'not_allowed';
    throw err;
  }

  const updated = await sb
    .from('reviews')
    .update({ organiser_response: reply || null })
    .eq('id', id)
    .select('id, organiser_response')
    .single();
  if (updated.error) throw new Error(updated.error.message);

  return {
    id: updated.data.id,
    reply: String(updated.data.organiser_response || '').trim() || null,
  };
}

async function listReviewsForOrganiserGroups(groupIds, groupsById, adminView) {
  if (!isSupabaseConfigured()) return [];
  const ids = groupIds || [];
  const sb = getSupabaseAdmin();

  async function runQuery(withAttendees) {
    const select = withAttendees
      ? 'id, created_at, rating, review_text, organiser_response, organiser_id, event_id, provenance, events ( title ), attendees ( name, email, public_review_name )'
      : 'id, created_at, rating, review_text, organiser_response, organiser_id, event_id, provenance, events ( title )';
    let query = sb
      .from('reviews')
      .select(select)
      .order('created_at', { ascending: false })
      .limit(500);

    if (!adminView) {
      if (!ids.length) return [];
      if (ids.length === 1) query = query.eq('organiser_id', ids[0]);
      else query = query.in('organiser_id', ids);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  }

  let rows = [];
  try {
    rows = await runQuery(true);
  } catch (err) {
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('provenance')) {
      try {
        const select =
          'id, created_at, rating, review_text, organiser_response, organiser_id, event_id, events ( title ), attendees ( name, email, public_review_name )';
        let query = sb
          .from('reviews')
          .select(select)
          .order('created_at', { ascending: false })
          .limit(500);
        if (!adminView) {
          if (!ids.length) return [];
          if (ids.length === 1) query = query.eq('organiser_id', ids[0]);
          else query = query.in('organiser_id', ids);
        }
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        rows = data || [];
      } catch (err2) {
        const msg2 = String(err2?.message || '').toLowerCase();
        if (msg2.includes('public_review_name')) {
          rows = await runQuery(false);
        } else {
          rows = await runQuery(false);
        }
      }
    } else if (msg.includes('public_review_name')) {
      try {
        const select =
          'id, created_at, rating, review_text, organiser_response, organiser_id, event_id, events ( title ), attendees ( name, email )';
        let query = sb
          .from('reviews')
          .select(select)
          .order('created_at', { ascending: false })
          .limit(500);
        if (!adminView) {
          if (!ids.length) return [];
          if (ids.length === 1) query = query.eq('organiser_id', ids[0]);
          else query = query.in('organiser_id', ids);
        }
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        rows = data || [];
      } catch {
        rows = await runQuery(false);
      }
    } else {
      rows = await runQuery(false);
    }
  }

  return rows.map((row) => {
    const groupId = row.organiser_id || '';
    const group = groupsById && groupsById.get ? groupsById.get(groupId) : null;
    const authorName = reviewerDisplayName(row.attendees);
    const provenance = String(row.provenance || 'verified');
    return {
      id: row.id,
      rating: row.rating,
      body: String(row.review_text || '').trim(),
      reply: String(row.organiser_response || '').trim() || null,
      authorName,
      initials: reviewerInitials(authorName),
      groupId,
      organiserId: groupId,
      groupName: group?.name || 'Group',
      eventId: row.event_id || null,
      eventTitle: String(row.events?.title || 'Event').trim(),
      date: row.created_at || '',
      provenance,
      badge:
        provenance === 'organiser_confirmed' ? 'Organiser confirmed' : 'Verified attendee',
    };
  });
}

module.exports = {
  submitReview,
  submitReviewForAttendeeId,
  submitReviewFromEmailToken,
  getEventReviewCtaState,
  replyToReviewAsOrganiser,
  eventHasEnded,
  isEligibleRegistration,
  findRegistrationForReview,
  listReviewsForOrganiserGroups,
  reviewerDisplayName,
  reviewerInitials,
  MAX_ORGANISER_REPLY,
};
