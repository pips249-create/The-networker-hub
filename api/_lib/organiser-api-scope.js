/**
 * Lightweight organiser API scope — session, groups, and event IDs only.
 * Use for endpoints that must not rebuild the full dashboard workspace.
 */
const sbOrg = require('./supabase-organiser');
const { listEventIdsForOrganiserGroups } = require('./supabase-organiser-events');
const { organiserPersonalScopeFromRequest } = require('./auth');

async function resolveOrganiserApiScope(req) {
  const { requireOrganiserSession } = require('./organiser');
  const wsAuth = requireOrganiserSession(req);
  if (!wsAuth.ok) return wsAuth;

  const { session } = wsAuth;
  const isAdmin = sbOrg.isPlatformAdmin(session);
  const personalScope = isAdmin && organiserPersonalScopeFromRequest(req);
  const adminView = isAdmin && !personalScope;

  let groups = [];
  try {
    groups = await sbOrg.listGroupsForSession(session, adminView);
  } catch (e) {
    return {
      ok: false,
      status: 500,
      error: 'groups_fetch_failed',
      message: e.message,
      groups: [],
    };
  }

  const groupIds = groups.map((g) => g.id);
  let eventIds = [];
  try {
    eventIds = await listEventIdsForOrganiserGroups(groupIds, adminView);
  } catch (e) {
    return {
      ok: false,
      status: 500,
      error: 'events_fetch_failed',
      message: e.message,
      groups,
    };
  }

  return {
    ok: true,
    session,
    groups,
    groupIds,
    eventIds,
    adminView,
    personalScope,
    isAdmin,
  };
}

module.exports = {
  resolveOrganiserApiScope,
};
