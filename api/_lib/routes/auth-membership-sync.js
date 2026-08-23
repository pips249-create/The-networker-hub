const { setCors, json, sessionFromRequest } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { isUuid } = require('../uuid');
const { isStripeCheckoutConfigured } = require('../stripe-checkout');
const { repairMembershipRosterExpiry, syncRosterFromSubscription, retrieveMembershipSubscription, findMembershipSubscriptionForEmail } = require('../membership-billing');

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
 * Also heals rows where Basil API left expires_at blank, or checkout never linked the sub id.
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
    .ilike('email', email);
  if (organiserId) {
    if (!isUuid(organiserId)) {
      return json(res, 400, { ok: false, error: 'invalid_organiser' });
    }
    query = query.eq('organiser_id', organiserId);
  }

  const { data: allRows, error } = await query.limit(20);
  if (error) throw new Error(error.message);
  let rows = (allRows || []).filter((r) => r.stripe_subscription_id);

  // Checkout sometimes activated the Stripe sub without writing stripe_subscription_id.
  if (!rows.length) {
    try {
      const found = await findMembershipSubscriptionForEmail(email, organiserId || null);
      if (found) {
        const linked = await syncRosterFromSubscription(found, {
          force: true,
          email,
          organiserId: organiserId || found.metadata?.organiser_id,
        });
        if (linked?.ok && linked.row) {
          return json(res, 200, {
            ok: true,
            synced: [
              {
                organiserId: linked.row.organiser_id,
                expiresAt: linked.row.expires_at || null,
                subscriptionStatus: linked.row.subscription_status || null,
              },
            ],
          });
        }
      }
    } catch (e) {
      console.error('[membership-sync] email lookup', e?.message || e);
    }
    return json(res, 404, {
      ok: false,
      error: 'no_hub_subscription',
      message: 'No membership subscription found for this account yet.',
    });
  }

  const synced = [];
  for (const row of rows) {
    try {
      let result = null;
      try {
        const subscription = await retrieveMembershipSubscription(String(row.stripe_subscription_id));
        result = await syncRosterFromSubscription(subscription, {
          force: true,
          organiserId: row.organiser_id,
          email: row.email || email,
        });
      } catch (retrieveErr) {
        console.error('[membership-sync] retrieve', row.id, retrieveErr?.message || retrieveErr);
      }
      if (result?.ok && result.row) {
        synced.push({
          organiserId: row.organiser_id,
          expiresAt: result.row.expires_at || null,
          subscriptionStatus: result.row.subscription_status || null,
        });
      } else {
        const repaired = await repairMembershipRosterExpiry(row, { force: true });
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
