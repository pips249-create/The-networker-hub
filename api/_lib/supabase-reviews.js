const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { resolveAttendeeId } = require('./supabase-favourites');

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
  const res = await sb
    .from('registrations')
    .select('id, payment_status, application_status')
    .eq('attendee_id', attendeeId)
    .eq('event_id', eventId)
    .neq('payment_status', 'Refunded')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
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

  const reviewText = String(input.reviewText || input.review_text || '').trim();
  if (reviewText.length < 10) throw new Error('review_text_too_short');
  if (reviewText.length > 2000) throw new Error('review_text_too_long');

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
      review_text: reviewText,
    })
    .select('id, rating, review_text, created_at')
    .single();

  if (ins.error) throw new Error(ins.error.message);

  return {
    id: ins.data.id,
    eventId,
    eventTitle: ev.title || 'Event',
    organiserId,
    rating: ins.data.rating,
    reviewText: ins.data.review_text,
    createdAt: ins.data.created_at,
  };
}

function reviewerDisplayName(attendee) {
  const name = String(attendee?.name || '').trim();
  if (name) return name;
  const email = String(attendee?.email || '').trim();
  if (email) return email.split('@')[0];
  return 'Attendee';
}

function reviewerInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

async function listReviewsForOrganiserGroups(groupIds, groupsById, adminView) {
  if (!isSupabaseConfigured()) return [];
  const ids = groupIds || [];
  const sb = getSupabaseAdmin();

  async function runQuery(withAttendees) {
    const select = withAttendees
      ? 'id, created_at, rating, review_text, organiser_response, organiser_id, event_id, events ( title ), attendees ( name, email )'
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
  } catch {
    rows = await runQuery(false);
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
      groupName: group?.name || 'Group',
      eventTitle: String(row.events?.title || 'Event').trim(),
      date: row.created_at || '',
    };
  });
}

module.exports = {
  submitReview,
  eventHasEnded,
  isEligibleRegistration,
  listReviewsForOrganiserGroups,
};
