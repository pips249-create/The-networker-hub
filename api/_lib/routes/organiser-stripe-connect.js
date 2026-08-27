const { getOrganiserApi } = require('../organiser-provider');
const { isAdminRole } = require('../auth');
const { assertOrganiserEmailVerified } = require('../organiser-access-guard');
const { jsonPublicError } = require('../public-error');
const {
  isStripeConnectEnabled,
  syncOrganiserConnectStatus,
  createConnectOnboardingLink,
  createExpressDashboardLinkForOrganiser,
  linkOrganiserConnectFromPeer,
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

  const auth = await requireOrganiserSession(req);
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
  const action = String(body.action || req.query?.action || 'status').toLowerCase();
  if (!groupId) return json(res, 400, { error: 'missing_group_id' });

  const { resolveOrganiserAccess } = require('../supabase-organiser-access');
  const access = await resolveOrganiserAccess(auth.session);
  // Platform admins can open Connect for any group (dashboard admin overview).
  // Non-admins must own / have team access to the group; only owners manage bank details.
  if (!isAdminRole(auth.session.role) && !access.groupIds.includes(groupId)) {
    return json(res, 403, {
      error: 'forbidden',
      message:
        'You can only add bank details for organiser pages linked to your account. Switch to your own workspace or ask the group owner.',
    });
  }
  if (!isAdminRole(auth.session.role) && !access.canManagePayments) {
    return json(res, 403, {
      error: 'forbidden',
      message: 'Only the account owner can add bank details or open the Stripe dashboard.',
    });
  }

  try {
    if (req.method === 'GET' && action === 'dashboard') {
      const link = await createExpressDashboardLinkForOrganiser(groupId);
      return json(res, 200, { ok: true, url: link.url, accountId: link.accountId });
    }

    if (req.method === 'GET') {
      const status = await syncOrganiserConnectStatus(groupId);
      const due = [...new Set([...(status.currentlyDue || []), ...(status.pastDue || [])])];
      const incompleteHint = !status.ready
        ? due.some((f) => String(f).includes('external_account'))
          ? 'Stripe still needs your bank account and identity details. Click Add bank details again to finish.'
          : 'Stripe setup is incomplete. Click Add bank details again to finish the remaining steps.'
        : null;
      return json(res, 200, {
        ok: true,
        ...status,
        incompleteHint,
        fieldsStillDue: due,
      });
    }

    const postAction = String(body.action || 'onboard').toLowerCase();
    if (postAction === 'link') {
      const sourceGroupId = String(body.sourceGroupId || '').trim();
      if (!sourceGroupId) return json(res, 400, { error: 'missing_source_group_id' });
      if (sourceGroupId === groupId) {
        return json(res, 400, { error: 'invalid_source_group_id' });
      }
      if (
        !isAdminRole(auth.session.role) &&
        !access.groupIds.includes(sourceGroupId)
      ) {
        return json(res, 403, {
          error: 'forbidden',
          message: 'You can only reuse bank details from your own organiser pages.',
        });
      }
      const status = await linkOrganiserConnectFromPeer(groupId, sourceGroupId);
      return json(res, 200, { ok: true, ...status });
    }

    if (postAction !== 'onboard') {
      return json(res, 400, { error: 'invalid_action' });
    }

    const link = await createConnectOnboardingLink(
      groupId,
      body.returnPath || '/organiser/#events-revenue'
    );
    return json(res, 200, {
      ok: true,
      url: link.url,
      accountId: link.accountId,
      expiresAt: link.expiresAt,
    });
  } catch (e) {
    return jsonPublicError(res, json, e, { code: 'stripe_connect_failed', logLabel: '[organiser-stripe-connect]' });
  }
};
