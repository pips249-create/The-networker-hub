const { getOrganiserApi } = require('../organiser-provider');
const { assertOrganiserEmailVerified } = require('../organiser-access-guard');
const {
  listPendingClaimsForOrganiser,
  respondToAttendanceClaim,
} = require('../attendance-claims');

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

function humanError(code) {
  const map = {
    invalid_decision: 'Choose yes or no.',
    missing_claim_id: 'That attendance claim could not be found.',
    claim_not_found: 'That attendance claim could not be found.',
    invalid_or_expired_token: 'This confirmation link is invalid or has expired.',
    not_allowed: 'You do not have access to this claim.',
    claim_not_pending: 'This claim is no longer waiting for a response.',
    claim_expired: 'This claim expired before a response.',
  };
  return map[code] || null;
}

module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const { json, setCors, requireOrganiserSession } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  const verified = await assertOrganiserEmailVerified(auth.session);
  if (!verified.ok) {
    return json(res, verified.status, {
      error: verified.error,
      message: verified.message,
    });
  }

  try {
    if (req.method === 'GET') {
      const claims = await listPendingClaimsForOrganiser(auth.session);
      return json(res, 200, { ok: true, claims });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const result = await respondToAttendanceClaim({
        session: auth.session,
        claimId: body.claimId || body.claim_id,
        decision: body.decision || body.action,
      });
      const confirmed = result.claim?.status === 'confirmed';
      const already = Boolean(result.alreadyResponded);
      return json(res, 200, {
        ok: true,
        ...result,
        decision: confirmed ? 'yes' : 'no',
        message: already
          ? confirmed
            ? 'You already confirmed this attendance claim.'
            : 'You already declined this attendance claim.'
          : confirmed
            ? 'Attendance confirmed — they can leave an organiser-confirmed review.'
            : 'Claim declined.',
      });
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    const code = e.code || e.message || 'claim_failed';
    const message = humanError(code);
    if (message) {
      return json(res, 400, { ok: false, error: code, message });
    }
    return json(res, 500, { ok: false, error: 'claim_failed', message: e.message || String(e) });
  }
};
