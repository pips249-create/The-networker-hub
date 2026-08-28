/**
 * Role-based gates for organiser team members (editor vs marketing).
 */
const { resolveOrganiserAccess } = require('./supabase-organiser-access');

function guardError(status, error, message) {
  return { ok: false, status, error, message };
}

function accessFromResolved(access) {
  if (!access || !access.role) {
    return guardError(403, 'not_allowed', 'You do not have access to this workspace.');
  }
  return { ok: true, access };
}

async function resolveOrganiserRoleAccess(session) {
  const access = await resolveOrganiserAccess(session);
  return accessFromResolved(access);
}

function assertCanManageEvents(access) {
  if (!access || access.canManageEvents === false) {
    return guardError(
      403,
      'marketing_read_only',
      'Marketing access is limited to Promote tools. Ask the account owner if you need to edit events.'
    );
  }
  return { ok: true, access };
}

function assertCanViewRegistrations(access) {
  if (!access || access.canViewRegistrations === false) {
    return guardError(
      403,
      'marketing_read_only',
      'Marketing access cannot view registrations or attendee lists.'
    );
  }
  return { ok: true, access };
}

function assertCanManagePayments(access) {
  if (!access || access.canManagePayments === false) {
    return guardError(
      403,
      'not_allowed',
      'Only the account owner can manage bank details and payouts.'
    );
  }
  return { ok: true, access };
}

function assertCanAccessCommunicate(access) {
  if (!access || access.canAccessCommunicate === false) {
    return guardError(
      403,
      'marketing_read_only',
      'Marketing access is limited to Promote tools.'
    );
  }
  return { ok: true, access };
}

module.exports = {
  resolveOrganiserRoleAccess,
  assertCanManageEvents,
  assertCanViewRegistrations,
  assertCanManagePayments,
  assertCanAccessCommunicate,
  accessFromResolved,
};
