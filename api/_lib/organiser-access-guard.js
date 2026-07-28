/**
 * Organiser opt-in and email-verification gates for sensitive actions.
 */
const { isAdminRole } = require('./auth');
const {
  getHubAccount,
  countOrganiserProfiles,
  hasOrganiserAccess,
  isOrganiserEmailVerified,
} = require('./supabase-auth');

async function countPendingClaims(session) {
  try {
    const { listPendingClaimGroupsForSession } = require('./supabase-organiser-claims');
    const { listPendingClaimOpportunitiesForSession } = require('./supabase-opportunity-claims');
    const [groups, opportunities] = await Promise.all([
      listPendingClaimGroupsForSession(session),
      listPendingClaimOpportunitiesForSession(session),
    ]);
    return groups.length + opportunities.length;
  } catch {
    return 0;
  }
}

async function countPendingClaimGroups(session) {
  try {
    const { listPendingClaimGroupsForSession } = require('./supabase-organiser-claims');
    const rows = await listPendingClaimGroupsForSession(session);
    return rows.length;
  } catch {
    return 0;
  }
}

async function getOrganiserAccessStatus(session) {
  const uid = String(session?.sub || '').trim();
  const email = String(session?.email || '').trim().toLowerCase();
  const admin = isAdminRole(session?.role);

  if (!uid) {
    return {
      organiserAccess: false,
      organiserUiVisible: false,
      organiserEmailVerified: false,
      pendingClaimCount: 0,
      organiserProfiles: 0,
    };
  }

  const [hub, organiserProfiles, pendingClaimCount] = await Promise.all([
    getHubAccount(uid),
    countOrganiserProfiles(uid, email),
    countPendingClaims(session),
  ]);

  const organiserAccess =
    admin ||
    Boolean(hub?.organiser_access_at) ||
    organiserProfiles > 0 ||
    pendingClaimCount > 0;

  const organiserUiHidden = Boolean(hub?.organiser_ui_hidden_at);
  const organiserUiVisible =
    admin ||
    pendingClaimCount > 0 ||
    organiserProfiles > 0 ||
    (Boolean(hub?.organiser_access_at) && !organiserUiHidden);

  const organiserEmailVerified = admin || isOrganiserEmailVerified(hub);

  return {
    organiserAccess,
    organiserUiVisible,
    organiserUiHidden,
    organiserEmailVerified,
    pendingClaimCount,
    organiserProfiles,
    organiserAccessAt: hub?.organiser_access_at || null,
    organiserEmailVerifiedAt: hub?.organiser_email_verified_at || null,
    organiserUiHiddenAt: hub?.organiser_ui_hidden_at || null,
  };
}

function guardError(status, error, message) {
  return { ok: false, status, error, message };
}

async function assertOrganiserAccess(session) {
  if (isAdminRole(session?.role)) return { ok: true };
  const status = await getOrganiserAccessStatus(session);
  if (status.organiserAccess) return { ok: true };
  return guardError(
    403,
    'organiser_access_required',
    'Enable organiser access before using the organiser workspace.'
  );
}

async function assertOrganiserEmailVerified(session) {
  if (isAdminRole(session?.role)) return { ok: true };

  const access = await assertOrganiserAccess(session);
  if (!access.ok) return access;

  const hub = await getHubAccount(session.sub);
  if (isOrganiserEmailVerified(hub)) return { ok: true };

  return guardError(
    403,
    'organiser_email_not_verified',
    'Confirm your email address before publishing events, viewing attendees, receiving payouts, or claiming an organiser page.'
  );
}

function isPublishIntent(body) {
  if (!body || typeof body !== 'object') return false;
  if (body.publish === true || body.publish === 'true') return true;
  const action = String(body.action || '').trim().toLowerCase();
  if (action === 'republish' || action === 'publish') return true;
  const listing = String(body.listingStatus || body.status || '').toLowerCase();
  return listing === 'published' || listing === 'publish' || listing === 'live';
}

module.exports = {
  getOrganiserAccessStatus,
  assertOrganiserAccess,
  assertOrganiserEmailVerified,
  isPublishIntent,
  countPendingClaimGroups,
  countPendingClaims,
};
