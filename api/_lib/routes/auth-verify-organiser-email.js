const { setCors, json, sessionFromRequest } = require('../auth');
const { useSupabase } = require('../supabase');
const { verifyOrganiserEmailToken } = require('../organiser-email-verification');
const { getOrganiserAccessStatus } = require('../organiser-access-guard');

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = sessionFromRequest(req);
  if (!session?.sub) return json(res, 401, { error: 'not_authenticated' });

  if (!useSupabase()) {
    return json(res, 503, { error: 'not_configured', message: 'Supabase is not configured.' });
  }

  if (req.method === 'GET') {
    const status = await getOrganiserAccessStatus(session);
    return json(res, 200, { ok: true, ...status });
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const body = parseBody(req);
  const token = String(body.token || body.code || '').trim();
  if (!token) {
    return json(res, 400, { error: 'missing_token', message: 'Enter the 6-digit confirmation code from your email.' });
  }

  try {
    const result = await verifyOrganiserEmailToken({ userId: session.sub, token });
    const status = await getOrganiserAccessStatus(session);
    return json(res, 200, {
      ok: true,
      verified: true,
      organiserEmailVerifiedAt: result.organiser_email_verified_at,
      ...status,
      redirect: '/organiser/',
      message: 'Email confirmed. You can now publish events and manage attendees.',
    });
  } catch (e) {
    const code = e.message === 'token_expired' ? 'token_expired' : 'invalid_token';
    return json(res, e.status || 400, {
      error: code,
      message:
        code === 'token_expired'
          ? 'This confirmation code has expired. Request a new one and try again.'
          : 'That confirmation code is invalid or has already been used.',
    });
  }
};
