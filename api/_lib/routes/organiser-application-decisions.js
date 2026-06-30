const { getOrganiserApi } = require('../organiser-provider');

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
  const { json, setCors, requireOrganiserSession, reviewApplicationForOrganiser } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const auth = requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  if (!reviewApplicationForOrganiser) {
    return json(res, 501, {
      error: 'application_decisions_not_supported',
      message: 'Requires Supabase.',
    });
  }

  const body = parseBody(req);
  const registrationId = String(body.registrationId || body.registration_id || body.id || '').trim();
  const action = String(body.action || '').trim().toLowerCase();

  if (!registrationId) {
    return json(res, 400, { ok: false, error: 'missing_registration_id' });
  }
  if (action !== 'approve' && action !== 'deny') {
    return json(res, 400, { ok: false, error: 'invalid_action' });
  }

  try {
    const result = await reviewApplicationForOrganiser(auth.session, registrationId, action);
    const name =
      String(registrationId).slice(0, 8);
    const message =
      action === 'approve'
        ? 'Application approved. The attendee has been notified by email.'
        : 'Application denied. The attendee has been notified by email.';
    return json(res, 200, { ok: true, ...result, message });
  } catch (e) {
    return json(res, e.status || 500, {
      ok: false,
      error: e.code || e.message || 'review_failed',
      message: e.message,
    });
  }
};
