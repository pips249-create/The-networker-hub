/**
 * Public first-party Promote landing beacon (UTM clicks from LinkedIn captions).
 * No cookies / no identity — aggregate ROI only.
 */
const { json, setCors } = require('./_lib/auth');
const { wrapHandler } = require('./_lib/sentry');
const { enforceRateLimit } = require('./_lib/rate-limit');
const { useSupabase } = require('./_lib/supabase');
const { recordPromoteAction } = require('./_lib/organiser-promote-log');

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

module.exports = wrapHandler(async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  const limited = enforceRateLimit(req, res, 'promote_landing', {
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

  const body = parseBody(req);
  const campaign = String(body.utmCampaign || body.utm_campaign || '')
    .trim()
    .toLowerCase();
  if (campaign && campaign !== 'organiser_share') {
    return json(res, 200, { ok: true, skipped: true, reason: 'not_organiser_share' });
  }

  try {
    const result = await recordPromoteAction({
      action: 'landing',
      source: String(body.source || 'event_page').slice(0, 64),
      eventId: body.eventId || null,
      organiserId: body.organiserId || null,
      templateId: body.utmContent || body.utm_content || null,
      metadata: {
        utmSource: String(body.utmSource || body.utm_source || '').slice(0, 64) || null,
        utmMedium: String(body.utmMedium || body.utm_medium || '').slice(0, 64) || null,
        path: String(body.path || '').slice(0, 200) || null,
      },
    });
    return json(res, 200, result);
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: e.code || 'promote_analytics_failed',
      message: e.message || 'Could not record landing.',
    });
  }
});