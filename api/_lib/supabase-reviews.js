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

async function submitReview(session, input) {
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
  const attendeeId = await resolveAttendeeId(sb, session);
  if (!attendeeId) throw new Error('attendee_not_found');

  const [eventRes, existingReview] = await Promise.all([
    sb
      .from('events')
      .select('id, title, organiser_id, starts_at, ends_at')
      .eq('id', eventId)
      .maybeSingle(),
    sb
      .from('reviews')
      .select('id')
      .eq('attendee_id', attendeeId)
      .eq('event_id', eventId)
      .maybeSingle(),
  ]);

  if (eventRes.error) throw new Error(eventRes.error.message);
  if (existingReview.error) throw new Error(existingReview.error.message);
  if (!eventRes.data?.id) throw new Error('event_not_found');
  if (existingReview.data?.id) throw new Error('review_already_submitted');

  const ev = eventRes.data;
  if (!eventHasEnded(ev)) throw new Error('event_not_finished');

  const registration = await findRegistrationForReview(sb, attendeeId, eventId);
  if (registration && registration.no_show_at) {
    throw new Error('did_not_attend');
  }
  if (!isEligibleRegistration(registration)) {
    throw new Error('not_eligible');
  }

  const organiserId = ev.organiser_id || null;
  if (!organiserId) throw new Error('missing_organiser');

  const ins = await sb
    .from('reviews')
    .insert({
      attendee_id: attendeeId,
      event_id: eventId,
      organiser_id: organiserId,
      rating,
      review_text: reviewText || null,
    })
    .select('id, rating, review_text, created_at')
    .single();

  if (ins.error) throw new Error(ins.error.message);

  let reviewCount = 1;
  try {
    const { count, error: countErr } = await sb
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('attendee_id', attendeeId);
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
    reviewerReward,
  };
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
      ? 'id, created_at, rating, review_text, organiser_response, organiser_id, event_id, events ( title ), attendees ( name, email, public_review_name )'
      : 'id, created_at, rating, review_text, organiser_response, organiser_id, event_id, events ( title )';
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
    if (msg.includes('public_review_name')) {
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
    };
  });
}

module.exports = {
  submitReview,
  replyToReviewAsOrganiser,
  eventHasEnded,
  isEligibleRegistration,
  listReviewsForOrganiserGroups,
  reviewerDisplayName,
  reviewerInitials,
  MAX_ORGANISER_REPLY,
};
