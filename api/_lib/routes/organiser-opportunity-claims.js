const { getOrganiserApi } = require('../organiser-provider');
const { assertOrganiserEmailVerified } = require('../organiser-access-guard');
const { isAdminRole } = require('../auth');

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
  const {
    json,
    setCors,
    requireOrganiserSession,
    claimOpportunityForSession,
    rejectOpportunityForSession,
  } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const auth = await requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  const { resolveOrganiserAccess } = require('../supabase-organiser-access');
  const access = await resolveOrganiserAccess(auth.session);
  if (!access.canCreateGroups && !isAdminRole(auth.session.role)) {
    return json(res, 403, {
      error: 'forbidden',
      message: 'Only the account owner can claim or reject business opportunity listings.',
    });
  }

  if (!claimOpportunityForSession || !rejectOpportunityForSession) {
    return json(res, 503, {
      error: 'claims_unavailable',
      message: 'Opportunity claim flow requires Supabase.',
    });
  }

  const body = parseBody(req);
  const opportunityId = String(body.opportunityId || body.id || '').trim();
  const action = String(body.action || '').trim().toLowerCase();
  const notes = String(body.notes || body.message || '').trim();

  if (!opportunityId) return json(res, 400, { error: 'missing_opportunity_id' });
  if (!['claim', 'reject'].includes(action)) {
    return json(res, 400, { error: 'invalid_action' });
  }

  try {
    if (action === 'claim') {
      const verified = await assertOrganiserEmailVerified(auth.session);
      if (!verified.ok) {
        return json(res, verified.status, {
          error: verified.error,
          message: verified.message,
        });
      }
      const opportunity = await claimOpportunityForSession(auth.session, opportunityId);
      return json(res, 200, {
        ok: true,
        action: 'claim',
        opportunity,
        message:
          'Business opportunity claimed. You can now manage enquiries and edit the listing from My business opportunities.',
      });
    }

    const result = await rejectOpportunityForSession(auth.session, opportunityId, notes);
    return json(res, 200, {
      ok: true,
      action: 'reject',
      disputeId: result.disputeId,
      message:
        'Thanks — we have removed this listing from your dashboard and notified the Hub team to review it.',
      emailResult: result.emailResult,
    });
  } catch (e) {
    const msg = e.message || String(e);
    if (msg === 'claim_not_available') {
      return json(res, e.status || 404, {
        error: 'claim_not_available',
        message: 'This business opportunity is not available to claim.',
      });
    }
    return json(res, e.status || 500, { error: 'claim_action_failed', message: msg });
  }
};
