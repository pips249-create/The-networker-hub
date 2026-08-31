/**
 * Organiser session helpers shared by Supabase organiser routes.
 * (Legacy Airtable organiser CRUD removed — see migrate.js / scripts/MIGRATE.md.)
 */
const {
  json,
  sessionFromRequest,
  setCors,
  isAdminRole,
  sessionWithLiveAdminRole,
} = require('./auth');

/** Any signed-in user can manage organiser profiles linked to their account. */
async function requireOrganiserSession(req) {
  const session = sessionFromRequest(req);
  if (!session) return { ok: false, status: 401, error: 'not_authenticated' };
  if (!session.email) return { ok: false, status: 403, error: 'missing_email' };
  // Cookie admin role can lag after DB revoke — re-check before platform-wide organiser access.
  const liveSession = await sessionWithLiveAdminRole(session);
  return { ok: true, session: liveSession };
}

function isPlatformAdmin(session) {
  return isAdminRole(session?.role);
}

module.exports = {
  json,
  setCors,
  requireOrganiserSession,
  isPlatformAdmin,
};
