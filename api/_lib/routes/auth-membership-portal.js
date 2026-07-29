const { setCors, json, sessionFromRequest } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { isUuid } = require('../uuid');
const {
  isStripeCheckoutConfigured,
  createMembershipBillingPortalSession,
  siteBaseUrl,
} = require('../stripe-checkout');

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

/** POST /api/auth/membership-portal — Stripe Customer Portal for Hub-billed memberships. */
module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }
  if (!isStripeCheckoutConfigured()) {
    return json(res, 503, { ok: false, error: 'stripe_not_configured' });
  }

  const session = sessionFromRequest(req);
  const email = String(session?.email || '')
    .trim()
    .toLowerCase();
  if (!email) {
    return json(res, 401, { ok: false, error: 'not_authenticated', message: 'Sign in to manage membership.' });
  }

  const body = parseBody(req);
  const organiserId = String(body.organiserId || body.organiser_id || body.groupId || '').trim();
  if (!isUuid(organiserId)) {
    return json(res, 400, { ok: false, error: 'invalid_organiser', message: 'Choose a group to manage.' });
  }

  const sb = getSupabaseAdmin();
  const { data: row, error } = await sb
    .from('organiser_member_roster')
    .select('id, stripe_customer_id, stripe_subscription_id, status')
    .eq('organiser_id', organiserId)
    .ilike('email', email)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row?.stripe_customer_id) {
    return json(res, 404, {
      ok: false,
      error: 'no_hub_subscription',
      message: 'No Hub-billed membership found for this group. Use Pay / renew instead.',
    });
  }

  try {
    const portal = await createMembershipBillingPortalSession({
      customerId: row.stripe_customer_id,
      returnUrl: String(body.returnUrl || body.return_url || '').trim() || siteBaseUrl() + '/account/#memberships',
    });
    return json(res, 200, { ok: true, url: portal.url });
  } catch (e) {
    return json(res, 502, {
      ok: false,
      error: 'portal_failed',
      message: e.message || 'Could not open billing portal',
    });
  }
};
