/**
 * Organiser API: Supabase when DATA_PROVIDER=supabase, else Airtable.
 */
const { useSupabase } = require('./supabase');

function getOrganiserApi() {
  if (useSupabase()) {
    const core = require('./organiser');
    const groups = require('./supabase-organiser');
    const events = require('./supabase-organiser-events');
    const team = require('./supabase-organiser-team');
    const payouts = require('./supabase-organiser-payouts');
    const cancellations = require('./supabase-organiser-cancellations');
    const attendees = require('./supabase-organiser-attendees');
    const opportunities = require('./supabase-opportunities');
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
      cancelLockedEvent: cancellations.cancelLockedEvent,
      confirmRefundsIssued: cancellations.confirmRefundsIssued,
    };
  }
  return {
    ...require('./organiser'),
    listAttendeesForOrganiserEvents: require('./organiser-attendees').listAttendeesForOrganiserEvents,
  };
}

module.exports = { getOrganiserApi };
