const {
  sessionFromRequest,
  setSessionCookie,
  clearSessionCookie,
  setCors,
  json,
  hubViewFromRequest,
  normalizeRole,
  isAdminRole,
  isClientRole,
} = require('../auth');
const { useSupabase } = require('../supabase');
const sbAuth = require('../supabase-auth');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  if (!session) return json(res, 200, { ok: false, user: null });

  try {
    if (useSupabase()) {
      const user = await sbAuth.findUserByEmail(session.email);
      if (!user) {
        clearSessionCookie(res);
        return json(res, 200, { ok: false, user: null });
      }

      const role = normalizeRole(user.role);
      const fresh = {
        sub: user.id,
        email: user.email,
        role,
        name: user.name,
      };
      if (session.impersonator) {
        fresh.impersonator = session.impersonator;
      }

      setSessionCookie(res, fresh);

      await sbAuth.backfillAttendeeUserId(fresh.sub, fresh.email);

      const organiserProfiles = await sbAuth.countOrganiserProfiles(fresh.sub, fresh.email);

      return json(res, 200, {
        ok: true,
        user: fresh,
        hubView: hubViewFromRequest(req),
        organiserProfiles,
        canOrganise: organiserProfiles > 0 || isAdminRole(role),
        canToggleHubMode: isClientRole(role) && !session.impersonator,
        impersonating: !!session.impersonator,
        impersonatorEmail: session.impersonator ? session.impersonator.email : null,
      });
    }

    const { findUserByEmail } = require('../auth');
    const { listGroupsForUser } = require('../organiser');
    const user = await findUserByEmail(session.email);
    if (!user || !user.passwordHash) {
      clearSessionCookie(res);
      return json(res, 200, { ok: false, user: null });
    }

    const role = normalizeRole(user.role);
    const fresh = {
      sub: user.id,
      email: user.email,
      role,
      name: user.name,
    };
    if (session.impersonator) {
      fresh.impersonator = session.impersonator;
    }

    setSessionCookie(res, fresh);

    let organiserProfiles = 0;
    try {
      const groups = await listGroupsForUser(fresh.sub, fresh.email);
      organiserProfiles = groups.length;
    } catch {
      /* optional */
    }

    return json(res, 200, {
      ok: true,
      user: fresh,
      hubView: hubViewFromRequest(req),
      organiserProfiles,
      canOrganise: organiserProfiles > 0 || isAdminRole(role),
      canToggleHubMode: isClientRole(role) && !session.impersonator,
      impersonating: !!session.impersonator,
      impersonatorEmail: session.impersonator ? session.impersonator.email : null,
    });
  } catch {
    return json(res, 200, {
      ok: true,
      user: {
        email: session.email,
        role: normalizeRole(session.role),
        name: session.name,
        sub: session.sub,
      },
      canToggleHubMode: isClientRole(session.role) && !session.impersonator,
      impersonating: !!session.impersonator,
      impersonatorEmail: session.impersonator ? session.impersonator.email : null,
    });
  }
};
