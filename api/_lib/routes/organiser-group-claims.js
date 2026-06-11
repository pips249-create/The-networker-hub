const { getOrganiserApi } = require('../organiser-provider');

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
    claimGroupForSession,
    rejectGroupForSession,
  } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const auth = requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  if (!claimGroupForSession || !rejectGroupForSession) {
    return json(res, 503, {
      error: 'claims_unavailable',
      message: 'Group claim flow requires Supabase.',
    });
  }

  const body = parseBody(req);
  const groupId = String(body.groupId || body.id || '').trim();
  const action = String(body.action || '').trim().toLowerCase();
  const notes = String(body.notes || body.message || '').trim();

  if (!groupId) return json(res, 400, { error: 'missing_group_id' });
  if (!['claim', 'reject'].includes(action)) {
    return json(res, 400, { error: 'invalid_action' });
  }

  try {
    if (action === 'claim') {
      const group = await claimGroupForSession(auth.session, groupId);
      return json(res, 200, {
        ok: true,
        action: 'claim',
        group,
        message: 'Group profile claimed. You can now manage events and tickets for ' + group.name + '.',
      });
    }

    const result = await rejectGroupForSession(auth.session, groupId, notes);
    return json(res, 200, {
      ok: true,
      action: 'reject',
      disputeId: result.disputeId,
      message:
        'Thanks — we have removed this profile from your dashboard and notified the Hub team to review the listing.',
      emailResult: result.emailResult,
    });
  } catch (e) {
    const msg = e.message || String(e);
    if (msg === 'claim_not_available') {
      return json(res, e.status || 404, { error: 'claim_not_available', message: 'This group profile is not available to claim.' });
    }
    return json(res, e.status || 500, { error: 'claim_action_failed', message: msg });
  }
};
