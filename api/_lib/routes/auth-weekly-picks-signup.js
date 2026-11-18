const { json, setCors } = require('../auth');
const { addWeeklyPicksSignup } = require('../weekly-picks-signup');
const { enforceRateLimitAsync } = require('../rate-limit');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const limited = await enforceRateLimitAsync(req, res, 'weekly_picks_signup', {
    max: 8,
    windowMs: 300_000,
  });
  if (!limited.allowed) {
    return json(res, 429, {
      error: 'rate_limited',
      message: 'Too many attempts. Please wait a few minutes and try again.',
      retryAfterSec: limited.retryAfterSec,
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  try {
    const result = await addWeeklyPicksSignup({
      email: body.email,
      location: body.location,
      regionSlug: body.regionSlug || body.region_slug,
      source: body.source,
    });
    return json(res, 200, {
      ok: true,
      alreadyRegistered: result.alreadyRegistered,
      email: result.email,
      hubUserUpdated: result.hubUserUpdated,
      message: result.alreadyRegistered
        ? 'You’re already on the weekly list.'
        : 'You’re on the list — Friday picks are coming.',
    });
  } catch (e) {
    const code = e.code || 'signup_failed';
    const status =
      code === 'invalid_email' ? 400 : code === 'not_configured' ? 503 : 500;
    return json(res, status, {
      error: code,
      message: e.message || 'Could not save your email.',
    });
  }
};
