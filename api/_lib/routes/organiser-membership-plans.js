const { getOrganiserApi } = require('../organiser-provider');
const { assertOrganiserEmailVerified } = require('../organiser-access-guard');
const {
  getMembershipPlanForOrganiser,
  upsertMembershipPlan,
} = require('../membership-billing');
const {
  connectRequiredForPaidCheckout,
  getOrganiserConnectById,
} = require('../stripe-connect');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');

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

async function assertGroupAccess(api, session, organiserId) {
  const groups = await api.listGroupsForSession(session);
  if (!api.groupOwnedBySession(session, groups, organiserId)) {
    const err = new Error('group_not_owned');
    err.status = 403;
    throw err;
  }
}

/** GET/PUT /api/organiser/membership-plans?organiserId= */
module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const { json, setCors, requireOrganiserSession } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  const verified = await assertOrganiserEmailVerified(auth.session);
  if (!verified.ok) {
    return json(res, verified.status, {
      error: verified.error,
      message: verified.message,
    });
  }

  const body = parseBody(req);
  const organiserId = String(
    req.query?.organiserId ||
      req.query?.organiser_id ||
      req.query?.groupId ||
      body.organiserId ||
      body.organiser_id ||
      body.groupId ||
      ''
  ).trim();

  if (!organiserId) {
    return json(res, 400, { ok: false, error: 'missing_organiser_id' });
  }

  try {
    await assertGroupAccess(api, auth.session, organiserId);

    if (req.method === 'GET') {
      const plan = await getMembershipPlanForOrganiser(organiserId);
      let connect = null;
      if (isSupabaseConfigured() && connectRequiredForPaidCheckout()) {
        connect = await getOrganiserConnectById(getSupabaseAdmin(), organiserId);
      }
      return json(res, 200, {
        ok: true,
        plan,
        connectReady: connect ? Boolean(connect.ready) : !connectRequiredForPaidCheckout(),
        feeLabel: plan?.feeLabel || 'Hub fee (4.5% + 20p)',
        feeExplanation:
          plan?.feeExplanation ||
          'Members pay the Hub fee on top. You receive 100% of the membership price you set.',
      });
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      if (connectRequiredForPaidCheckout()) {
        const connect = await getOrganiserConnectById(getSupabaseAdmin(), organiserId);
        const enabling =
          body.active !== false &&
          (body.monthlyAmountPounds != null ||
            body.annualAmountPounds != null ||
            body.monthly_amount_pounds != null ||
            body.annual_amount_pounds != null);
        if (enabling && !connect?.ready) {
          return json(res, 400, {
            ok: false,
            error: 'stripe_connect_required',
            message:
              'Add your bank details (Stripe Connect) before offering paid memberships through the Hub.',
          });
        }
      }

      const plan = await upsertMembershipPlan(organiserId, body);
      return json(res, 200, { ok: true, plan });
    }

    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  } catch (e) {
    const status = e.status || 500;
    return json(res, status, {
      ok: false,
      error: e.code || e.message || 'membership_plans_failed',
      message: e.message || String(e),
    });
  }
};
