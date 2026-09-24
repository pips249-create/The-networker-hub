const { setCors, json } = require('../auth');
const { isSupabaseConfigured, getSupabaseAdmin } = require('../supabase');
const { verifyReviewLinkToken } = require('../review-link-token');
const { submitReviewFromEmailToken, eventHasEnded, isEligibleRegistration } = require('../supabase-reviews');
const { formatEventDateTime } = require('../favourite-sales-emails');
const { enforceRateLimitAsync } = require('../rate-limit');

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body || {};
}

async function loadReviewLinkContext(token) {
  const payload = verifyReviewLinkToken(token);
  if (!payload) return { error: 'invalid_review_link' };

  const sb = getSupabaseAdmin();
  const [regRes, eventRes, reviewRes] = await Promise.all([
    sb
      .from('registrations')
      .select('id, attendee_id, event_id, payment_status, application_status, cancelled_at, no_show_at')
      .eq('id', payload.registrationId)
      .maybeSingle(),
    sb
      .from('events')
      .select('id, title, slug, starts_at, ends_at, organiser_id')
      .eq('id', payload.eventId)
      .maybeSingle(),
    sb
      .from('reviews')
      .select('id')
      .eq('attendee_id', payload.attendeeId)
      .eq('event_id', payload.eventId)
      .maybeSingle(),
  ]);

  if (regRes.error) throw new Error(regRes.error.message);
  if (eventRes.error) throw new Error(eventRes.error.message);
  if (reviewRes.error) throw new Error(reviewRes.error.message);

  const reg = regRes.data;
  const eventRow = eventRes.data;
  if (
    !reg?.id ||
    String(reg.attendee_id) !== payload.attendeeId ||
    String(reg.event_id) !== payload.eventId ||
    !eventRow?.id
  ) {
    return { error: 'invalid_review_link' };
  }

  let organiserName = '';
  if (eventRow.organiser_id) {
    const { data: org } = await sb
      .from('organisers')
      .select('name')
      .eq('id', eventRow.organiser_id)
      .maybeSingle();
    organiserName = String(org?.name || '').trim();
  }

  const { event_date } = formatEventDateTime(eventRow.starts_at);
  const metaParts = [];
  if (event_date) metaParts.push(event_date);
  if (organiserName) metaParts.push(organiserName);

  const alreadyReviewed = Boolean(reviewRes.data?.id);
  let canReview = !alreadyReviewed && eventHasEnded(eventRow) && isEligibleRegistration(reg);
  if (reg.no_show_at) canReview = false;
  if (reg.cancelled_at) canReview = false;

  return {
    ok: true,
    eventId: eventRow.id,
    eventTitle: String(eventRow.title || 'Event').trim(),
    eventMeta: metaParts.join(' · '),
    organiserName: organiserName || 'the organiser',
    alreadyReviewed,
    canReview,
    eventSlug: eventRow.slug || null,
  };
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  if (req.method === 'GET') {
    const url = new URL(req.url || '', 'https://internal.local');
    const token = String(url.searchParams.get('token') || '').trim();
    if (!token) return json(res, 400, { ok: false, error: 'missing_token' });
    try {
      const ctx = await loadReviewLinkContext(token);
      if (ctx.error) return json(res, 400, { ok: false, error: ctx.error });
      return json(res, 200, ctx);
    } catch (e) {
      return json(res, 500, { ok: false, error: 'review_link_failed', message: e.message || String(e) });
    }
  }

  if (req.method === 'POST') {
    const limited = await enforceRateLimitAsync(req, res, 'email_review_submit', {
      max: 12,
      windowMs: 300_000,
    });
    if (limited) return;

    const body = parseBody(req);
    const token = String(body.token || '').trim();
    if (!token) return json(res, 400, { ok: false, error: 'missing_token' });

    try {
      const review = await submitReviewFromEmailToken(token, {
        eventId: body.eventId || body.event_id,
        rating: body.rating,
        reviewText: body.reviewText || body.review_text,
      });
      return json(res, 200, {
        ok: true,
        review,
        reviewerReward: review.reviewerReward || null,
      });
    } catch (e) {
      const msg = e.message || String(e);
      const clientErrors = new Set([
        'invalid_review_link',
        'missing_event_id',
        'invalid_rating',
        'review_text_too_long',
        'event_not_found',
        'review_already_submitted',
        'event_not_finished',
        'not_eligible',
        'did_not_attend',
        'attendee_not_found',
        'missing_organiser',
      ]);
      if (clientErrors.has(msg)) {
        return json(res, 400, { ok: false, error: msg });
      }
      return json(res, 500, { ok: false, error: 'review_failed', message: msg });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
