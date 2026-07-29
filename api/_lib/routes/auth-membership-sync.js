const { setCors, json, sessionFromRequest } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { isUuid } = require('../uuid');
const { isStripeCheckoutConfigured } = require('../stripe-checkout');
const { repairMembershipRosterExpiry, syncRosterFromSubscription } = require('../membership-billing');

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

/**
 * POST /api/auth/membership-sync — refresh roster expiry from Stripe after Checkout.
 * Also heals rows where Basil API left expires_at blank.
 */
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
    return json(res, 401, { ok: false, error: 'not_authenticated' });
  }

  const body = parseBody(req);
  const organiserId = String(body.organiserId || body.organiser_id || body.groupId || '').trim();

  const sb = getSupabaseAdmin();
  let query = sb
    .from('organiser_member_roster')
    .select(
      'id, email, organiser_id, expires_at, stripe_subscription_id, subscription_status, status'
    )
    .eq('status', 'active')
    .ilike('email', email)
    .not('stripe_subscription_id', 'is', null);
  if (organiserId) {
    if (!isUuid(organiserId)) {
      return json(res, 400, { ok: false, error: 'invalid_organiser' });
    }
    query = query.eq('organiser_id', organiserId);
  }

  const { data: rows, error } = await query.limit(10);
  if (error) throw new Error(error.message);
  if (!(rows || []).length) {
    return json(res, 404, {
      ok: false,
      error: 'no_hub_subscription',
      message: 'No Hub membership subscription found for this account yet.',
    });
  }

  const { getStripeClient } = require('../stripe-checkout');
  const stripe = getStripeClient();
  const synced = [];
  for (const row of rows) {
    try {
      const subscription = await stripe.subscriptions.retrieve(String(row.stripe_subscription_id));
      const result = await syncRosterFromSubscription(subscription, {
        force: true,
        organiserId: row.organiser_id,
        email: row.email || email,
      });
      if (result?.ok && result.row) {
        synced.push({
          organiserId: row.organiser_id,
          expiresAt: result.row.expires_at || null,
          subscriptionStatus: result.row.subscription_status || null,
        });
      } else {
        const repaired = await repairMembershipRosterExpiry(row);
        if (repaired?.row) {
          synced.push({
            organiserId: row.organiser_id,
            expiresAt: repaired.row.expires_at || null,
            subscriptionStatus: repaired.row.subscription_status || null,
          });
        }
      }
    } catch (e) {
      console.error('[membership-sync]', row.id, e?.message || e);
    }
  }

  if (!synced.length) {
    return json(res, 502, {
      ok: false,
      error: 'sync_failed',
      message: 'Could not refresh membership expiry from Stripe yet. Try again in a moment.',
    });
  }

  return json(res, 200, { ok: true, synced });
};
