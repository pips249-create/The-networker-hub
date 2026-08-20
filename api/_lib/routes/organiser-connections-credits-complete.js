const { getOrganiserApi } = require('../organiser-provider');
const { organiserPersonalScopeFromRequest } = require('../auth');
const { listAccessibleGroupsForSession } = require('../supabase-organiser-access');
const { isStripeCheckoutConfigured, retrieveCheckoutSession } = require('../stripe-checkout');
const { handleConnectionsCreditsCheckout } = require('../connections-credits');
const { getConnectionsAllowance } = require('../event-connections-email');

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

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

/** Fallback when Stripe webhook is delayed — confirm credit purchase. */
module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const { json, setCors, requireOrganiserSession, isPlatformAdmin } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const auth = requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  if (!isStripeCheckoutConfigured()) {
    return json(res, 503, { ok: false, error: 'stripe_not_configured' });
  }

  try {
    const body = parseBody(req);
    const sessionId = String(body.sessionId || body.session_id || '').trim();
    if (!sessionId) return json(res, 400, { ok: false, error: 'missing_session_id' });

    const session = await retrieveCheckoutSession(sessionId);
    const organiserId = String(session?.metadata?.organiser_id || '').trim();
    if (!isUuid(organiserId)) {
      return json(res, 400, { ok: false, error: 'invalid_checkout_session' });
    }

    const adminView =
      isPlatformAdmin(auth.session) && !organiserPersonalScopeFromRequest(req);
    const { groups } = await listAccessibleGroupsForSession(auth.session, adminView);
    const owns = (groups || []).some((g) => String(g.id) === organiserId);
    if (!owns && !adminView) {
      return json(res, 403, { ok: false, error: 'group_not_owned' });
    }

    const result = await handleConnectionsCreditsCheckout(session);
    const allowance = await getConnectionsAllowance(organiserId).catch(() => null);
    return json(res, 200, { ok: true, result, allowance });
  } catch (e) {
    return json(res, e.status || 500, {
      ok: false,
      error: 'credits_complete_failed',
      message: e.message || String(e),
    });
  }
};
