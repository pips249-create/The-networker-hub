const {
  setCors,
  json,
  sessionFromRequest,
  hubViewFromRequest,
  setHubViewCookie,
  isClientRole,
  isAdminRole,
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
    const mode = String(body.mode || body.hubView || '').toLowerCase();
    if (mode !== 'attendee' && mode !== 'organiser') {
      return json(res, 400, { error: 'invalid_mode' });
    }
    if (!isClientRole(session.role)) {
      // Non-client accounts (admin): allow preview of either workspace.
      if (mode === 'attendee' || (mode === 'organiser' && isAdminRole(session.role))) {
        setHubViewCookie(res, mode);
        return json(res, 200, {
          ok: true,
          hubView: mode,
          redirect: mode === 'organiser' ? '/organiser/' : '/account/',
        });
      }
      return json(res, 403, {
        error: 'clients_only',
        message: 'Only client accounts can switch between attendee and organiser mode.',
      });
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
            ? '/account/settings#organiser-workspace'
            : '/organiser/enable',
        });
      }
    }
    setHubViewCookie(res, mode);
    return json(res, 200, {
      ok: true,
      hubView: mode,
      redirect: mode === 'organiser' ? '/organiser/' : '/account/',
    });
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
