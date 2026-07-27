/**
 * Public browse analytics — anonymised events search/filter logging.
 */
const { json, setCors } = require('./_lib/auth');
const { enforceRateLimit } = require('./_lib/rate-limit');
const { useSupabase } = require('./_lib/supabase');
const { recordBrowseSearch } = require('./_lib/browse-search-log');

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
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  const limited = enforceRateLimit(req, res, 'browse_search_log', {
    max: 40,
    windowMs: 300_000,
  });
  if (!limited.allowed) {
    return json(res, 429, {
      ok: false,
      error: 'rate_limited',
      retryAfterSec: limited.retryAfterSec,
    });
  }

  if (!useSupabase()) {
    return json(res, 200, { ok: true, configured: false, skipped: true });
  }

  try {
    const body = parseBody(req);
    const action = String(body.action || 'record_search').trim().toLowerCase();
    if (action !== 'record_search') {
      return json(res, 400, { ok: false, error: 'unknown_action' });
    }

    const result = await recordBrowseSearch(body);
    if (!result.ok) {
      const status = result.error === 'no_signal' ? 200 : 400;
      return json(res, status, result);
    }
    return json(res, 200, { ok: true });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: e.code || 'browse_analytics_failed',
      message: e.message || 'Could not record browse search.',
    });
  }
};
