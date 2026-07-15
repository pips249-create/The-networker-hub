const { getOrganiserApi } = require('../organiser-provider');
const {
  replyToReviewAsOrganiser,
  listReviewsForOrganiserGroups,
  MAX_ORGANISER_REPLY,
} = require('../supabase-reviews');
const { getGroupRankingsForOrganiser } = require('../organiser-group-ranking');
const { resolveOrganiserApiScope } = require('../organiser-api-scope');

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
  const api = getOrganiserApi();
  const { json, setCors, requireOrganiserSession } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') {
    const scope = await resolveOrganiserApiScope(req);
    if (!scope.ok) {
      return json(res, scope.status || 500, {
        error: scope.error,
        message: scope.message,
      });
    }
    try {
      const groupMap = new Map((scope.groups || []).map((group) => [group.id, group]));
      const [reviews, groupRankings] = await Promise.all([
        listReviewsForOrganiserGroups(scope.groupIds, groupMap, scope.adminView),
        getGroupRankingsForOrganiser(scope.groupIds).catch(() => ({})),
      ]);
      return json(res, 200, { ok: true, reviews, groupRankings });
    } catch (err) {
      return json(res, 500, {
        error: 'reviews_fetch_failed',
        message: err.message || 'Could not load reviews.',
      });
    }
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const auth = requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  const body = parseBody(req);
  const reviewId = String(body.reviewId || body.review_id || body.id || '').trim();
  const reply = body.reply != null ? body.reply : body.organiser_response;
  if (!reviewId) {
    return json(res, 400, { ok: false, error: 'missing_review_id' });
  }

  try {
    const result = await replyToReviewAsOrganiser(auth.session, reviewId, reply);
    return json(res, 200, {
      ok: true,
      review: result,
      message: result.reply ? 'Reply saved.' : 'Reply cleared.',
    });
  } catch (err) {
    const code = err.code || err.message || 'reply_failed';
    const status = err.status || 400;
    const messages = {
      invalid_review_id: 'That review could not be found.',
      review_not_found: 'That review could not be found.',
      not_allowed: 'You can only reply to reviews for your own groups.',
      not_authenticated: 'Please sign in again.',
      reply_too_long: 'Keep your reply under ' + MAX_ORGANISER_REPLY + ' characters.',
      supabase_not_configured: 'Reviews are temporarily unavailable.',
    };
    return json(res, status, {
      ok: false,
      error: code,
      message: messages[code] || err.message || 'Could not save reply.',
    });
  }
};
