const { getOrganiserApi } = require('../organiser-provider');
const { organiserPersonalScopeFromRequest } = require('../auth');
const { listAccessibleGroupsForSession } = require('../supabase-organiser-access');
const { jsonPublicError } = require('../public-error');
const {
  isStripeCheckoutConfigured,
  createGroupUpdateCreditsCheckoutSession,
  siteBaseUrl,
} = require('../stripe-checkout');
const { getCreditPack, listCreditPacks, normalizePackId } = require('../group-update-credits');

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

/** Start Stripe Checkout for extra monthly group-update send credits. */
module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const { json, setCors, requireOrganiserSession, isPlatformAdmin } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return json(res, 200, { ok: true, packs: listCreditPacks() });
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const auth = await requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  if (!isStripeCheckoutConfigured()) {
    return json(res, 503, {
      ok: false,
      error: 'stripe_not_configured',
      message:
        'Add STRIPE_SECRET_KEY (sk_test_… for test mode) to your environment, then redeploy or restart vercel dev.',
    });
  }

  try {
    const body = parseBody(req);
    const organiserId = String(body.organiserId || body.groupId || '').trim();
    const packId = normalizePackId(body.packId || body.pack || body.credits);
    const pack = getCreditPack(packId);
    if (!isUuid(organiserId)) return json(res, 400, { ok: false, error: 'invalid_organiser_id' });
    if (!pack) return json(res, 400, { ok: false, error: 'invalid_pack' });

    const adminView =
      isPlatformAdmin(auth.session) && !organiserPersonalScopeFromRequest(req);
    const { groups } = await listAccessibleGroupsForSession(auth.session, adminView);
    const group = (groups || []).find((g) => String(g.id) === organiserId);
    if (!group && !adminView) {
      return json(res, 403, { ok: false, error: 'group_not_owned' });
    }

    const base = siteBaseUrl();
    const successUrl =
      base +
      '/organiser/?credits_session={CHECKOUT_SESSION_ID}#group-updates';
    const cancelUrl = base + '/organiser/#group-updates';

    const session = await createGroupUpdateCreditsCheckoutSession({
      organiserId,
      packId: pack.id,
      groupName: (group && group.name) || 'Your group',
      email: auth.session.email,
      successUrl,
      cancelUrl,
    });

    return json(res, 200, {
      ok: true,
      url: session.url,
      sessionId: session.id,
      pack: {
        id: pack.id,
        credits: pack.credits,
        amountPence: pack.amountPence,
        label: pack.label,
      },
    });
  } catch (e) {
    return jsonPublicError(res, json, e, { code: e.code || 'credits_checkout_failed', logLabel: '[organiser-group-update-credits-checkout]' });
  }
};
