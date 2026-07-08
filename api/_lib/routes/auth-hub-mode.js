const {
  setCors,
  json,
  sessionFromRequest,
  hubViewFromRequest,
  setHubViewCookie,
  isClientRole,
} = require('../auth');
const { getOrganiserAccessStatus } = require('../organiser-access-guard');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = sessionFromRequest(req);
  if (!session) return json(res, 401, { error: 'not_authenticated' });

  if (req.method === 'GET') {
    return json(res, 200, { ok: true, hubView: hubViewFromRequest(req) });
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    if (!isClientRole(session.role)) {
      return json(res, 403, {
        error: 'clients_only',
        message: 'Only client accounts can switch between attendee and organiser mode.',
      });
    }
    const mode = String(body.mode || body.hubView || '').toLowerCase();
    if (mode !== 'attendee' && mode !== 'organiser') {
      return json(res, 400, { error: 'invalid_mode' });
    }
    if (mode === 'organiser') {
      const accessStatus = await getOrganiserAccessStatus(session);
      if (!accessStatus.organiserUiVisible) {
        return json(res, 403, {
          error: 'organiser_access_required',
          message: accessStatus.organiserAccess
            ? 'Restore organiser workspace in Account settings, or enable organiser access first.'
            : 'Enable organiser access before opening the organiser workspace.',
          redirect: accessStatus.organiserAccess
            ? '/account/settings.html#organiser-workspace'
            : '/organiser/enable.html',
        });
      }
    }
    setHubViewCookie(res, mode);
    return json(res, 200, {
      ok: true,
      hubView: mode,
      redirect: mode === 'organiser' ? '/organiser/index.html' : '/account/index.html',
    });
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
