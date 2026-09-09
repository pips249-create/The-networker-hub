const { getOrganiserApi } = require('../organiser-provider');
const { adminViewFromSession, resolveOrganiserGroupScope } = require('../organiser-api-scope');
const { jsonPublicError } = require('../public-error');
const {
  listOrganiserSetupReviews,
  acceptOrganiserEventSetup,
} = require('../organiser-setup-review');

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

  const auth = await requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  const { adminView } = adminViewFromSession(auth.session, req);
  if (adminView || auth.session?.impersonator) {
    return json(res, 403, {
      error: 'admin_view',
      message: 'Setup review is for the organiser account, not admin impersonation.',
    });
  }

  try {
    const scope = await resolveOrganiserGroupScope(auth.session, adminView);
    const groupIds = scope.groupIds || [];

    if (req.method === 'GET') {
      const reviews = await listOrganiserSetupReviews(groupIds);
      return json(res, 200, { ok: true, reviews });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const eventId = String(body.eventId || '').trim();
      const userId = auth.session.userId || auth.session.sub;
      const result = await acceptOrganiserEventSetup({
        userId,
        eventId,
        groupIds,
      });
      try {
        const { logFromSession } = require('../entity-activity-log');
        await logFromSession(auth.session, null, {
          entity_type: 'event',
          entity_id: eventId,
          action: 'setup_review_accepted',
          summary: 'Accepted ticket setup and organiser terms',
        });
      } catch {
        /* activity log must not block acceptance */
      }
      return json(res, 200, { ok: true, ...result });
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    const status = e.status || 500;
    if (status >= 400 && status < 500) {
      return json(res, status, {
        error: e.message || 'request_failed',
        message: e.message,
      });
    }
    return jsonPublicError(res, json, e, {
      code: e.code || 'setup_review_failed',
      logLabel: '[organiser-setup-review]',
    });
  }
};
