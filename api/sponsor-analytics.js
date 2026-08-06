/**
 * Public first-party sponsor / partner click beacon.
 * No cookies / no identity — aggregate monthly pack reporting only.
 */
const { json, setCors } = require('./_lib/auth');
const { enforceRateLimit } = require('./_lib/rate-limit');
const { useSupabase } = require('./_lib/supabase');
const { recordSponsorClick } = require('./_lib/sponsor-clicks');

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

  const limited = enforceRateLimit(req, res, 'sponsor_click_log', {
    max: 60,
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
    const action = String(body.action || 'record_click').trim().toLowerCase();
    if (action !== 'record_click') {
      return json(res, 400, { ok: false, error: 'unknown_action' });
    }

    const result = await recordSponsorClick(body);
    if (!result.ok) {
      const status = result.error === 'no_signal' ? 200 : 400;
      return json(res, status, result);
    }
    return json(res, 200, { ok: true });
  } catch (e) {
    if (e.code === 'sponsor_clicks_table_missing') {
      return json(res, 200, {
        ok: true,
        skipped: true,
        reason: 'table_missing',
      });
    }
    return json(res, 500, {
      ok: false,
      error: e.code || 'sponsor_analytics_failed',
      message: e.message || 'Could not record sponsor click.',
    });
  }
};
