/**
 * Lightweight organiser API scope — session, groups, and event IDs only.
 * Use for endpoints that must not rebuild the full dashboard workspace.
 *
 * Group IDs must match the organiser dashboard (email-matched pages included).
 * Tickets/events used to call listGroupsForSession alone, which dropped those
 * pages and returned event_not_owned for live listings.
 */
const sbOrg = require('./supabase-organiser');
const {
  listEventIdsForOrganiserGroups,
  prepareOrganiserWorkspaceScope,
} = require('./supabase-organiser-events');
const { organiserPersonalScopeFromRequest } = require('./auth');

function adminViewFromSession(session, req) {
  const isAdmin = sbOrg.isPlatformAdmin(session);
  const personalScope = isAdmin && organiserPersonalScopeFromRequest(req);
  return { isAdmin, personalScope, adminView: isAdmin && !personalScope };
}

async function resolveOrganiserGroupScope(session, adminView) {
  const { groups, groupIds, access, groupsError } = await prepareOrganiserWorkspaceScope(
    session,
    adminView
  );
  if (groupsError && !(groupIds || []).length) {
    const e = new Error(groupsError);
    e.status = 500;
    e.code = 'groups_fetch_failed';
    throw e;
  }
  return { groups: groups || [], groupIds: groupIds || [], access };
}

async function resolveOrganiserApiScope(req) {
  const { requireOrganiserSession } = require('./organiser');
  const wsAuth = requireOrganiserSession(req);
  if (!wsAuth.ok) return wsAuth;

  const { session } = wsAuth;
  const { isAdmin, personalScope, adminView } = adminViewFromSession(session, req);

  let groups = [];
  let groupIds = [];
  try {
    const scope = await resolveOrganiserGroupScope(session, adminView);
    groups = scope.groups;
    groupIds = scope.groupIds;
  } catch (e) {
    return {
      ok: false,
      status: e.status || 500,
      error: e.code || 'groups_fetch_failed',
      message: e.message,
      groups: [],
    };
  }

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
  adminViewFromSession,
  resolveOrganiserGroupScope,
  resolveOrganiserApiScope,
};
