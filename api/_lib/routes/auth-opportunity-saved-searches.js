const { setCors, json, sessionFromRequest } = require('../auth');
const {
  listOpportunitySavedSearches,
  createOpportunitySavedSearch,
  deleteOpportunitySavedSearch,
} = require('../supabase-opportunity-saved-searches');
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = sessionFromRequest(req);
  if (!session) return json(res, 401, { error: 'not_authenticated' });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured', searches: [] });
  }

  try {
    if (req.method === 'GET') {
      const searches = await listOpportunitySavedSearches(session);
      return json(res, 200, { ok: true, searches });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const search = await createOpportunitySavedSearch(session, {
        label: body.label,
        criteria: body.criteria,
        notifyEmail: body.notifyEmail,
      });
      const searches = await listOpportunitySavedSearches(session);
      return json(res, 200, { ok: true, search, searches });
    }

    if (req.method === 'DELETE') {
      const body = parseBody(req);
      const searchId = body.searchId || body.id || req.query?.searchId;
      await deleteOpportunitySavedSearch(session, searchId);
      const searches = await listOpportunitySavedSearches(session);
      return json(res, 200, { ok: true, searches });
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'opportunity_saved_searches_failed', message: e.message });
  }
};
