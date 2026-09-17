const { getOrganiserApi } = require('../organiser-provider');
const { jsonPublicError } = require('../public-error');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { adminViewFromSession, resolveOrganiserGroupScope } = require('../organiser-api-scope');
const {
  connectedBookingAllowedForSession,
  newWebhookSecret,
  signWebhookPayload,
  isConnectedPlanActive,
  countPublishedGroupsForAccount,
  groupLimitForPlan,
  PLAN_GROUP_LIMITS,
} = require('../connected-booking');
const { isSelfServeConnectedPlan } = require('../connected-booking-pricing');
const {
  isStripeCheckoutConfigured,
  createConnectedBookingCheckoutSession,
  createConnectedBookingBillingPortalSession,
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

async function loadOrganiserAccountRow(sb, accountId) {
  const accountSelectWithCustomer =
    'id, connected_booking_plan, connected_booking_status, connected_booking_webhook_secret, connected_booking_stripe_subscription_id, connected_booking_stripe_customer_id';
  const accountSelectBase =
    'id, connected_booking_plan, connected_booking_status, connected_booking_webhook_secret, connected_booking_stripe_subscription_id';

  let account = null;
  let accErr = null;
  ({ data: account, error: accErr } = await sb
    .from('organiser_accounts')
    .select(accountSelectWithCustomer)
    .eq('id', accountId)
    .maybeSingle());
  if (accErr && /connected_booking|does not exist|column/i.test(accErr.message || '')) {
    ({ data: account, error: accErr } = await sb
      .from('organiser_accounts')
      .select(accountSelectBase)
      .eq('id', accountId)
      .maybeSingle());
  }
  if (accErr) {
    const e = new Error(
      'Connected booking database columns are missing. Run Supabase migration 292_external_connected_booking.sql (and 293_connected_booking_stripe_customer.sql for billing).'
    );
    e.code = 'connected_booking_schema_missing';
    e.status = 503;
    throw e;
  }
  return account;
}

async function loadRecentSyncLog(sb, accountId) {
  try {
    const { data, error } = await sb
      .from('external_booking_sync_log')
      .select('id, created_at, event_id, external_order_id, outcome, message, http_status')
      .eq('organiser_account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(15);
    if (error) {
      if (/external_booking_sync_log|does not exist|relation/i.test(error.message || '')) {
        return { logs: [], schemaWarning: 'Sync log table missing — run migration 292.' };
      }
      throw new Error(error.message);
    }
    return { logs: data || [], schemaWarning: null };
  } catch (e) {
    console.warn('[organiser-connected-booking] sync log unavailable', e?.message || e);
    return { logs: [], schemaWarning: 'Sync log unavailable.' };
  }
}

function connectedBookingErrorFallback(err) {
  if (err && err.code === 'connected_booking_schema_missing' && err.message) {
    return String(err.message).trim();
  }
  return 'Connected booking could not load. Run Supabase migrations 292 and 293 on production, then refresh.';
}

async function resolveOrganiserAccountId(sb, session, adminView) {
  const scope = await resolveOrganiserGroupScope(session, adminView);
  const accountId = String(scope.organiserAccountId || '').trim();
  if (accountId) return accountId;
  const userId = String(session.sub || '').trim();
  if (!userId) return null;
  const { data, error } = await sb
    .from('organiser_accounts')
    .select('id')
    .eq('supabase_user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id || null;
}

/** GET/PATCH /api/organiser/connected-booking — plan status, webhook secret, docs hints. */
module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const { json, setCors, requireOrganiserSession, isPlatformAdmin } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  if (!connectedBookingAllowedForSession(auth.session)) {
    return json(res, 403, {
      ok: false,
      error: 'preview_restricted',
      message:
        'Connected booking preview is limited to approved organiser accounts. Sign in with the preview email on file, or contact us to be added.',
      signedInAs: String(auth.session.email || '').trim().toLowerCase(),
    });
  }
  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  const sb = getSupabaseAdmin();
  const { adminView } = adminViewFromSession(auth.session, req);

  try {
    const accountId = await resolveOrganiserAccountId(sb, auth.session, adminView);
    if (!accountId) {
      return json(res, 200, {
        ok: false,
        error: 'organiser_account_not_found',
        message:
          'We could not find an organiser account for this login. Open My Events from the organiser workspace first, or claim your group profile.',
      });
    }

    const account = await loadOrganiserAccountRow(sb, accountId);
    if (!account) return json(res, 404, { ok: false, error: 'organiser_account_not_found' });

    if (req.method === 'GET') {
      const groupCount = await countPublishedGroupsForAccount(sb, accountId);
      const limit = groupLimitForPlan(account.connected_booking_plan);
      const syncResult = await loadRecentSyncLog(sb, accountId);

      const site = String(process.env.SITE_URL || 'https://www.thenetworkeruk.com').replace(/\/$/, '');
      const stripeCheckout = isStripeCheckoutConfigured();
      const hasCustomer = Boolean(String(account.connected_booking_stripe_customer_id || '').trim());
      const status = account.connected_booking_status || 'inactive';
      const canStartCheckout =
        stripeCheckout && (status === 'inactive' || status === 'cancelled' || status === 'past_due');

      return json(res, 200, {
        ok: true,
        featureEnabled: true,
        plan: account.connected_booking_plan || null,
        status,
        active: isConnectedPlanActive(account),
        groupCount,
        groupLimit: limit,
        hasWebhookSecret: Boolean(String(account.connected_booking_webhook_secret || '').trim()),
        webhookUrl: site + '/api/integrations/booking',
        accountId: account.id,
        billing: {
          stripeCheckoutConfigured: stripeCheckout,
          canSubscribe: canStartCheckout,
          canManageBilling: stripeCheckout && hasCustomer && Boolean(account.connected_booking_stripe_subscription_id),
          selfServePlans: ['starter', 'growth', 'scale'],
        },
        pricing: {
          starter: { groups: PLAN_GROUP_LIMITS.starter, monthlyExVat: 39 },
          growth: { groups: PLAN_GROUP_LIMITS.growth, monthlyExVat: 99 },
          scale: { groups: PLAN_GROUP_LIMITS.scale, monthlyExVat: 199 },
          enterprise: { groups: null, note: 'Email Rosie and Catherine for 20+ groups.' },
        },
        recentSync: syncResult.logs,
        schemaWarning: syncResult.schemaWarning || undefined,
      });
    }

    if (req.method === 'PATCH') {
      const body = parseBody(req);
      const patch = {};

      if (body.action === 'rotate_webhook_secret') {
        patch.connected_booking_webhook_secret = newWebhookSecret();
      }

      if (isPlatformAdmin(auth.session) && body.connectedBookingStatus != null) {
        const st = String(body.connectedBookingStatus || body.connected_booking_status || '').trim();
        if (['inactive', 'active', 'past_due', 'cancelled'].includes(st)) {
          patch.connected_booking_status = st;
        }
      }
      if (isPlatformAdmin(auth.session) && body.connectedBookingPlan != null) {
        const pl = String(body.connectedBookingPlan || body.connected_booking_plan || '').trim();
        if (['starter', 'growth', 'scale', 'enterprise'].includes(pl)) {
          patch.connected_booking_plan = pl;
        }
      }

      if (!Object.keys(patch).length) {
        return json(res, 400, { ok: false, error: 'no_changes' });
      }

      const { data: updated, error: updErr } = await sb
        .from('organiser_accounts')
        .update(patch)
        .eq('id', accountId)
        .select(
          'id, connected_booking_plan, connected_booking_status, connected_booking_webhook_secret'
        )
        .single();
      if (updErr) throw new Error(updErr.message);

      const revealSecret =
        patch.connected_booking_webhook_secret && updated?.connected_booking_webhook_secret;

      return json(res, 200, {
        ok: true,
        plan: updated.connected_booking_plan,
        status: updated.connected_booking_status,
        webhookSecret: revealSecret || undefined,
      });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const email = String(auth.session.email || '').trim().toLowerCase();
      if (!email) {
        return json(res, 403, { ok: false, error: 'missing_email' });
      }

      if (body.action === 'create_checkout') {
        if (!isStripeCheckoutConfigured()) {
          return json(res, 503, { ok: false, error: 'stripe_not_configured' });
        }
        const plan = String(body.plan || body.connectedBookingPlan || '').trim().toLowerCase();
        if (!isSelfServeConnectedPlan(plan)) {
          return json(res, 400, { ok: false, error: 'invalid_plan' });
        }
        const st = String(account.connected_booking_status || 'inactive');
        if (st === 'active' && isConnectedPlanActive(account)) {
          const hasCustomer = Boolean(String(account.connected_booking_stripe_customer_id || '').trim());
          if (hasCustomer) {
            try {
              const portal = await createConnectedBookingBillingPortalSession({
                customerId: account.connected_booking_stripe_customer_id,
              });
              return json(res, 200, {
                ok: true,
                alreadySubscribed: true,
                url: portal.url,
              });
            } catch (e) {
              return json(res, 409, { ok: false, error: 'already_subscribed' });
            }
          }
          return json(res, 409, { ok: false, error: 'already_subscribed' });
        }
        const session = await createConnectedBookingCheckoutSession({
          plan,
          organiserAccountId: accountId,
          email,
        });
        return json(res, 200, { ok: true, url: session.url, sessionId: session.id });
      }

      if (body.action === 'billing_portal') {
        if (!isStripeCheckoutConfigured()) {
          return json(res, 503, { ok: false, error: 'stripe_not_configured' });
        }
        const customerId = String(account.connected_booking_stripe_customer_id || '').trim();
        if (!customerId) {
          return json(res, 400, { ok: false, error: 'no_billing_customer' });
        }
        const portal = await createConnectedBookingBillingPortalSession({ customerId });
        return json(res, 200, { ok: true, url: portal.url });
      }

      if (body.action === 'test_signature') {
        const secret = String(account.connected_booking_webhook_secret || '').trim();
        if (!secret) {
          return json(res, 400, { ok: false, error: 'missing_webhook_secret' });
        }
        const sample = JSON.stringify({
          eventId: '00000000-0000-4000-8000-000000000001',
          orderId: 'test-order-1',
          email: 'test@example.com',
          name: 'Test User',
          quantity: 1,
          status: 'confirmed',
        });
        return json(res, 200, {
          ok: true,
          signature: signWebhookPayload(secret, Buffer.from(sample, 'utf8')),
          sampleBody: JSON.parse(sample),
        });
      }
      return json(res, 400, { ok: false, error: 'unknown_action' });
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    return jsonPublicError(res, json, e, {
      code: e.code || 'connected_booking_failed',
      fallback: connectedBookingErrorFallback(e),
      logLabel: '[organiser-connected-booking]',
      extra: { ok: false },
    });
  }
};
