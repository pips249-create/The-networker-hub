const { getOrganiserApi } = require('../organiser-provider');
const { jsonPublicError } = require('../public-error');

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
  const { json, setCors, requireOrganiserSession, requestPayout, getPayoutPreview } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  if (!requestPayout || !getPayoutPreview) {
    return json(res, 501, { error: 'payouts_not_supported', message: 'Requires Supabase.' });
  }

  const eventId = String(
    (req.method === 'GET' ? req.query?.eventId : parseBody(req).eventId) || ''
  ).trim();
  if (!eventId) return json(res, 400, { error: 'missing_event_id' });

  try {
    if (req.method === 'GET') {
      const preview = await getPayoutPreview(auth.session, eventId);
      return json(res, 200, { ok: true, preview });
    }

    if (req.method === 'POST') {
      const result = await requestPayout(auth.session, eventId);
      return json(res, 201, {
        ok: true,
        payout: result.payout,
        breakdown: result.breakdown,
        message: 'Payout request submitted — we will review it shortly.',
      });
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    return jsonPublicError(res, json, e, { code: 'payout_request_failed', logLabel: '[organiser-payouts]' });
  }
};
