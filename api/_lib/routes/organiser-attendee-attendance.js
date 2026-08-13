const { getOrganiserApi } = require('../organiser-provider');
const { assertOrganiserEmailVerified } = require('../organiser-access-guard');
const { resolveOrganiserApiScope } = require('../organiser-api-scope');
const {
  markRegistrationNoShow,
  unmarkRegistrationNoShow,
} = require('../organiser-no-shows');

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

function humanError(e) {
  const code = String(e.code || e.message || '');
  const map = {
    missing_registration_id: 'Choose who to update.',
    registration_not_found: 'That registration could not be found.',
    registration_cancelled: 'That booking is already cancelled.',
    registration_not_eligible: 'Only confirmed bookings can be marked as did not attend.',
    event_not_found: 'That event could not be found.',
    event_cancelled: 'This event was cancelled.',
    event_not_started: 'You can mark no-shows once the event has started.',
    review_already_submitted:
      'They already left a review for this event, so this booking cannot be marked as a no-show.',
  };
  return map[code] || e.message || 'Something went wrong.';
}

module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const { json, setCors, requireOrganiserSession } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

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
  const registrationId = String(body.registrationId || body.registration_id || '').trim();
  const action = String(body.action || '').trim().toLowerCase();

  if (!registrationId) {
    return json(res, 400, { ok: false, error: 'missing_registration_id' });
  }
  if (action !== 'no_show' && action !== 'attended') {
    return json(res, 400, { ok: false, error: 'invalid_action' });
  }

  try {
    const scope = await resolveOrganiserApiScope(req);
    if (!scope.ok) {
      return json(res, scope.status || 401, { ok: false, error: scope.error });
    }
    const groupIds = scope.groupIds || [];
    const result =
      action === 'no_show'
        ? await markRegistrationNoShow(auth.session, {
            registrationId,
            groupIds,
            userId: auth.session?.sub,
          })
        : await unmarkRegistrationNoShow(auth.session, {
            registrationId,
            groupIds,
          });

    return json(res, 200, {
      ok: true,
      isNoShow: Boolean(result.registration?.no_show_at),
      message:
        action === 'no_show'
          ? 'Marked as did not attend. They will not get a review email for this event.'
          : 'Marked as attended. They can leave a review for this event.',
    });
  } catch (e) {
    const status = e.status || 500;
    return json(res, status, {
      ok: false,
      error: e.code || e.message || 'server_error',
      message: humanError(e),
    });
  }
};
