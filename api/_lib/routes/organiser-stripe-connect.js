const { getOrganiserApi } = require('../organiser-provider');
const { assertOrganiserEmailVerified } = require('../organiser-access-guard');
const {
  isStripeConnectEnabled,
  syncOrganiserConnectStatus,
  createConnectOnboardingLink,
} = require('../stripe-connect');

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

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  const auth = requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  const verified = await assertOrganiserEmailVerified(auth.session);
  if (!verified.ok) {
    return json(res, verified.status, {
      error: verified.error,
      message: verified.message,
    });
  }

  if (!isStripeConnectEnabled()) {
    return json(res, 503, {
      error: 'stripe_connect_disabled',
      message: 'Stripe Connect is not enabled on this server.',
    });
  }

  const body = parseBody(req);
  const groupId = String(body.groupId || body.id || req.query?.groupId || req.query?.id || '').trim();
  if (!groupId) return json(res, 400, { error: 'missing_group_id' });

  const { resolveOrganiserAccess } = require('../supabase-organiser-access');
  const access = await resolveOrganiserAccess(auth.session);
  if (!access.groupIds.includes(groupId)) {
    return json(res, 403, { error: 'forbidden' });
  }

  try {
    if (req.method === 'GET') {
      const status = await syncOrganiserConnectStatus(groupId);
      return json(res, 200, { ok: true, ...status });
    }

    const action = String(body.action || 'onboard').toLowerCase();
    if (action !== 'onboard') {
      return json(res, 400, { error: 'invalid_action' });
    }

    const link = await createConnectOnboardingLink(
      groupId,
      body.returnPath || '/organiser/index.html#events-revenue'
    );
    return json(res, 200, {
      ok: true,
      url: link.url,
      accountId: link.accountId,
      expiresAt: link.expiresAt,
    });
  } catch (e) {
    return json(res, e.status || 500, {
      error: 'stripe_connect_failed',
      message: e.message || String(e),
    });
  }
};
