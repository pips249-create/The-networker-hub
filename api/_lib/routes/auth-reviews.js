const { setCors, json, sessionFromRequest } = require('../auth');
const { submitReview } = require('../supabase-reviews');
const { isSupabaseConfigured } = require('../supabase');

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

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  if (!session) return json(res, 401, { error: 'not_authenticated' });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  try {
    const body = parseBody(req);
    const review = await submitReview(session, body);
    return json(res, 200, {
      ok: true,
      review,
      reviewerReward: review.reviewerReward || null,
    });
  } catch (e) {
    const msg = e.message || String(e);
    const clientErrors = new Set([
      'missing_event_id',
      'invalid_rating',
      'review_text_too_short',
      'review_text_too_long',
      'event_not_found',
      'review_already_submitted',
      'event_not_finished',
      'not_eligible',
      'attendee_not_found',
      'missing_organiser',
    ]);
    if (clientErrors.has(msg)) {
      return json(res, 400, { ok: false, error: msg });
    }
    return json(res, 500, { ok: false, error: 'review_failed', message: msg });
  }
};
