/**
 * Public first-party sales-pitch beacon (opens + PDF downloads for /p-tnh-* decks).
 * No cookies / no identity — aggregate Command Centre stats only.
 */
const { json, setCors } = require('./_lib/auth');
const { enforceRateLimit } = require('./_lib/rate-limit');
const { useSupabase } = require('./_lib/supabase');
const { recordPitchPageAction } = require('./_lib/pitch-page-log');

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

  const limited = enforceRateLimit(req, res, 'pitch_page_log', {
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
    const result = await recordPitchPageAction({
      action: body.action || 'view',
      path: body.path,
      label: body.label,
      referrer: body.referrer || body.referrerHost || body.referrer_host,
    });
    if (!result.ok) {
      const status = result.error === 'invalid_path' || result.error === 'invalid_action' ? 400 : 200;
      return json(res, status, result);
    }
    return json(res, 200, { ok: true });
  } catch (e) {
    if (e.code === 'pitch_page_views_table_missing') {
      return json(res, 200, {
        ok: true,
        skipped: true,
        reason: 'table_missing',
      });
    }
    return json(res, 500, {
      ok: false,
      error: e.code || 'pitch_analytics_failed',
      message: e.message || 'Could not record pitch analytics.',
    });
  }
};
