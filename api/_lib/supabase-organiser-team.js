/**
 * Team members API — delegates to organiser access module.
 */
const access = require('./supabase-organiser-access');

module.exports = {
  resolveOrganiserAccess: access.resolveOrganiserAccess,
  getOrCreateOrganiserAccount: access.getOrCreateOrganiserAccount,
  listTeamMembers: access.listTeamMembers,
  inviteTeamMember: access.inviteTeamMember,
  removeTeamMember: access.removeTeamMember,
  resendTeamInvite: access.resendTeamInvite,
  updateTeamMemberGroups: access.updateTeamMemberGroups,
};
