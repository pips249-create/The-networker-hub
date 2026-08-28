/**
 * GET /api/public-config — non-secret client bootstrap (e.g. Turnstile site key).
 */
const { json, setCors } = require('./_lib/auth');
const { wrapHandler } = require('./_lib/sentry');
const { turnstilePublicConfig } = require('./_lib/turnstile');

module.exports = wrapHandler(async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=60');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  return json(res, 200, {
    ok: true,
    turnstile: turnstilePublicConfig(),
  });
});