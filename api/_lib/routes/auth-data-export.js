const { sessionFromRequest, json, setCors } = require('../auth');
const { isSupabaseConfigured } = require('../supabase');
const { enforceRateLimitAsync } = require('../rate-limit');
const { buildUserDataExport } = require('../user-data-export');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'not_configured' });
  }

  const session = sessionFromRequest(req);
  if (!session || !session.sub || !session.email) {
    return json(res, 401, { ok: false, error: 'unauthorized', message: 'Sign in to download your data.' });
  }

  const limited = await enforceRateLimitAsync(req, res, 'auth_data_export', {
    max: 3,
    windowMs: 3_600_000,
    identity: session.sub,
  });
  if (!limited.allowed) {
    return json(res, 429, {
      ok: false,
      error: 'rate_limited',
      message: 'You can download your data a few times per hour. Please wait and try again.',
      retryAfterSec: limited.retryAfterSec,
    });
  }

  try {
    const payload = await buildUserDataExport(session);
    const stamp = payload.exported_at.slice(0, 10);
    const filename = 'thenetworker-uk-data-export-' + stamp + '.json';
    const body = JSON.stringify(payload, null, 2);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.end(body);
  } catch (e) {
    console.error('[auth-data-export]', e);
    return json(res, 500, {
      ok: false,
      error: 'export_failed',
      message: 'Could not prepare your data export. Try again or email hi@thenetworkeruk.com.',
    });
  }
};
