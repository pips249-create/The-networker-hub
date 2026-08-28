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
  applyImpersonationToSessionUser,
} = require('../auth');
const { useSupabase } = require('../supabase');
const sbAuth = require('../supabase-auth');
const { getOrganiserAccessStatus } = require('../organiser-access-guard');
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
        if (session.impersonator) {
          return json(res, 200, {
            ok: true,
            user: {
              sub: session.sub,
              email: session.email,
              role: 'client',
              name: session.name || '',
            },
            hubView: hubViewFromRequest(req),
            organiserProfiles: 0,
            organiserAccess: true,
            organiserUiVisible: true,
            organiserEmailVerified: true,
            pendingClaimCount: 0,
            canOrganise: true,
            canToggleHubMode: false,
            impersonating: true,
            impersonatorEmail: session.impersonator.email || null,
          });
        }
        clearSessionCookie(res);
        return json(res, 200, { ok: false, user: null });
      }

      const role = session.impersonator ? 'client' : normalizeRole(user.role);
      const fresh = {
        sub: user.id,
        email: user.email,
        role,
        name: user.name,
      };
      if (session.impersonator) {
        applyImpersonationToSessionUser(fresh, session);
      }
      setSessionCookie(res, fresh);

      await sbAuth.backfillAttendeeUserId(fresh.sub, fresh.email);

      const organiserProfiles = await sbAuth.countOrganiserProfiles(fresh.sub, fresh.email);
      const organiserTermsAccepted = await sbAuth.hasOrganiserTermsAccepted(fresh.sub);
      const organiserOpportunityTermsAccepted = await sbAuth.hasOrganiserOpportunityTermsAccepted(
        fresh.sub
      );
      const accessStatus = await getOrganiserAccessStatus(fresh);
      const impersonating = !!session.impersonator;

      return json(res, 200, {
        ok: true,
        user: fresh,
        hubView: hubViewFromRequest(req),
        organiserProfiles,
        organiserTermsAccepted,
        organiserOpportunityTermsAccepted,
        organiserAccess: accessStatus.organiserAccess || impersonating,
        organiserUiVisible: accessStatus.organiserUiVisible || impersonating,
        organiserEmailVerified: accessStatus.organiserEmailVerified || impersonating,
        pendingClaimCount: accessStatus.pendingClaimCount,
        canOrganise:
          accessStatus.organiserAccess ||
          organiserProfiles > 0 ||
          accessStatus.pendingClaimCount > 0 ||
          isAdminRole(role) ||
          impersonating,
        canToggleHubMode:
          isClientRole(role) &&
          !impersonating &&
          accessStatus.organiserUiVisible,
        impersonating,
        impersonatorEmail: session.impersonator ? session.impersonator.email : null,
      });
    }

    const { findUserByEmail } = require('../auth');
    const { listGroupsForUser } = require('../organiser-provider').getOrganiserApi();
    const user = await findUserByEmail(session.email);
    if (!user || !user.passwordHash) {
      if (session.impersonator) {
        return json(res, 200, {
          ok: true,
          user: {
            sub: session.sub,
            email: session.email,
            role: 'client',
            name: session.name || '',
          },
          hubView: hubViewFromRequest(req),
          organiserProfiles: 0,
          canOrganise: true,
          canToggleHubMode: false,
          impersonating: true,
          impersonatorEmail: session.impersonator.email || null,
          organiserUiVisible: true,
          organiserAccess: true,
        });
      }
      clearSessionCookie(res);
      return json(res, 200, { ok: false, user: null });
    }

    const role = session.impersonator ? 'client' : normalizeRole(user.role);
    const fresh = {
      sub: user.id,
      email: user.email,
      role,
      name: user.name,
    };
    if (session.impersonator) {
      applyImpersonationToSessionUser(fresh, session);
    }

    setSessionCookie(res, fresh);

    let organiserProfiles = 0;
    try {
      const groups = await listGroupsForUser(fresh.sub, fresh.email);
      organiserProfiles = groups.length;
    } catch {
      /* optional */
    }

    const impersonating = !!session.impersonator;
    return json(res, 200, {
      ok: true,
      user: fresh,
      hubView: hubViewFromRequest(req),
      organiserProfiles,
      canOrganise: organiserProfiles > 0 || isAdminRole(role) || impersonating,
      canToggleHubMode: isClientRole(role) && !impersonating,
      impersonating,
      impersonatorEmail: session.impersonator ? session.impersonator.email : null,
      organiserUiVisible: organiserProfiles > 0 || impersonating,
      organiserAccess: organiserProfiles > 0 || impersonating,
    });
  } catch {
    const impersonating = !!session.impersonator;
    return json(res, 200, {
      ok: true,
      user: {
        email: session.email,
        role: impersonating ? 'client' : normalizeRole(session.role),
        name: session.name,
        sub: session.sub,
      },
      canToggleHubMode: isClientRole(session.role) && !impersonating,
      impersonating,
      impersonatorEmail: session.impersonator ? session.impersonator.email : null,
      organiserUiVisible: impersonating,
      organiserAccess: impersonating,
    });
  }
};
