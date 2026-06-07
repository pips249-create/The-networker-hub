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

module.exports = {
  submitReview,
  eventHasEnded,
  isEligibleRegistration,
};
