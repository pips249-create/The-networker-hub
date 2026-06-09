const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { resolveAttendeeId } = require('./supabase-favourites');
const { buildStats } = require('./attendee');
const { eventHasEnded, isEligibleRegistration } = require('./supabase-reviews');
const { eventImageUrl } = require('./event-image');

function deriveReviewStatus(hasReview, row) {
  const ev = row.events || {};
  if (!eventHasEnded(ev)) return 'upcoming';
  if (hasReview) return 'reviewed';
  if (!isEligibleRegistration(row)) return 'ineligible';
  return 'pending';
}

function mapRegistrationRow(row, reviewByEventId) {
  const ev = row.events || {};
  const organiser = ev.organisers || {};
  const ticket = row.tickets || {};
  const eventId = row.event_id || ev.id || '';
  const review = reviewByEventId.get(eventId);
  const date = ev.starts_at || null;
  const ticketName = String(ticket.name || 'General Admission').trim();

  return {
    id: row.id,
    eventId,
    slug: ev.slug || '',
    title: ev.title || 'Event',
    date,
    endDate: ev.ends_at || null,
    imageUrl: eventImageUrl(ev) || null,
    ticketLabel: '1 × ' + ticketName,
    paymentStatus: row.payment_status || 'Pending',
    amountPaid: row.amount_paid != null ? Number(row.amount_paid) : 0,
    organiserId: ev.organiser_id || organiser.id || '',
    organiserName: organiser.name || '',
    organiserSlug: organiser.slug || '',
    reviewStatus: deriveReviewStatus(Boolean(review), row),
    rating: review?.rating ?? null,
    reviewText: review?.reviewText ?? null,
    canReview: deriveReviewStatus(Boolean(review), row) === 'pending',
  };
}

async function listRegistrationsForAttendee(sb, attendeeId) {
  const res = await sb
    .from('registrations')
    .select(
      `
      id,
      created_at,
      event_id,
      payment_status,
      application_status,
      amount_paid,
      events (
        id,
        title,
        slug,
        starts_at,
        ends_at,
        image_url,
        photo_url,
        organiser_id,
        organisers (
          id,
          name,
          slug
        )
      ),
      tickets (
        id,
        name
      )
    `
    )
    .eq('attendee_id', attendeeId)
    .neq('payment_status', 'Refunded')
    .order('created_at', { ascending: false });

  if (res.error) throw new Error(res.error.message);
  return res.data || [];
}

async function listReviewsForAttendee(sb, attendeeId) {
  const res = await sb
    .from('reviews')
    .select('event_id, rating, review_text')
    .eq('attendee_id', attendeeId);
  if (res.error) throw new Error(res.error.message);
  const map = new Map();
  (res.data || []).forEach((row) => {
    if (row.event_id) {
      map.set(row.event_id, {
        rating: row.rating,
        reviewText: row.review_text,
      });
    }
  });
  return map;
}

async function getAttendeeDashboardFromSupabase(session) {
  if (!isSupabaseConfigured()) {
    return { registrations: [], stats: buildStats([]) };
  }

  const sb = getSupabaseAdmin();
  const attendeeId = await resolveAttendeeId(sb, session);
  if (!attendeeId) {
    return { registrations: [], stats: buildStats([]) };
  }

  const [rows, reviewByEventId] = await Promise.all([
    listRegistrationsForAttendee(sb, attendeeId),
    listReviewsForAttendee(sb, attendeeId),
  ]);

  const registrations = rows.map((row) => mapRegistrationRow(row, reviewByEventId));
  return {
    registrations,
    stats: buildStats(registrations),
  };
}

module.exports = {
  getAttendeeDashboardFromSupabase,
  deriveReviewStatus,
  mapRegistrationRow,
};
