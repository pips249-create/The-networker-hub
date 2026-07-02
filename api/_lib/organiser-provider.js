/**
 * Organiser API — Supabase only.
 */
const core = require('./organiser');
const groups = require('./supabase-organiser');
const events = require('./supabase-organiser-events');
const team = require('./supabase-organiser-team');
const payouts = require('./supabase-organiser-payouts');
const cancellations = require('./supabase-organiser-cancellations');
const attendees = require('./supabase-organiser-attendees');
const opportunities = require('./supabase-opportunities');
const claims = require('./supabase-organiser-claims');

function getOrganiserApi() {
  return {
    json: core.json,
    setCors: core.setCors,
    requireOrganiserSession: core.requireOrganiserSession,
    ...groups,
    ...events,
    ...team,
    ...payouts,
    ...attendees,
    ...opportunities,
    reviewApplicationForOrganiser: require('./supabase-application-decisions').reviewApplicationForOrganiser,
    resendApplicationOrganiserAlert: require('./supabase-application-decisions').resendApplicationOrganiserAlert,
    resendApprovalEmailForOrganiser: require('./supabase-application-decisions').resendApprovalEmailForOrganiser,
    cancelLockedEvent: cancellations.cancelLockedEvent,
    getCancellationContext: cancellations.getCancellationContext,
    confirmRefundsIssued: cancellations.confirmRefundsIssued,
    listPendingClaimGroupsForSession: claims.listPendingClaimGroupsForSession,
    claimGroupForSession: claims.claimGroupForSession,
    rejectGroupForSession: claims.rejectGroupForSession,
  };
}

module.exports = { getOrganiserApi };
