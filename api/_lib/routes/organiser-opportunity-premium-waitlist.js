const { getOrganiserApi } = require('../organiser-provider');
const { jsonPublicError } = require('../public-error');
const {
  joinPremiumWaitlist,
  premiumWaitlistStatus,
} = require('../opportunity-premium-waitlist');

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
  const { json, setCors, requireOrganiserSession } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  if (req.method === 'GET') {
    try {
      const status = await premiumWaitlistStatus(auth.session);
      return json(res, 200, { ok: true, ...status });
    } catch (e) {
      return jsonPublicError(res, json, e, { code: 'waitlist_status_failed', logLabel: '[organiser-opportunity-premium-waitlist]' });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = parseBody(req);
      const opportunityId = String(body.opportunityId || body.id || '').trim() || null;
      const result = await joinPremiumWaitlist(auth.session, opportunityId);
      return json(res, 200, { ok: true, ...result });
    } catch (e) {
      const msg = e.message || String(e);
      if (msg === 'not_authenticated') return json(res, 401, { error: msg });
      return json(res, 500, { error: 'waitlist_join_failed', message: msg });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
