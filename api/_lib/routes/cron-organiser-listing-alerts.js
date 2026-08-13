const { json } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { authorizeCron } = require('../cron-auth');
const {
  sendDueOrganiserListingAlertEmails,
  sendDueMemberRosterListingAlertEmails,
} = require('../organiser-listing-alert-emails');
const { drainDueRosterEmails } = require('../organiser-roster-email-queue');

/**
 * Daily catch-up (08:30 UTC). Only sends when there are new un-alerted listings —
 * not a daily newsletter. Saved-organiser alerts go out as one roundup per group.
 * Membership new-event digests queued overnight are drained here too.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  if (!authorizeCron(req, res)) return;

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  try {
    const sb = getSupabaseAdmin();
    const favourites = await sendDueOrganiserListingAlertEmails(sb);
    const roster = await sendDueMemberRosterListingAlertEmails(sb);
    const rosterDrain = await drainDueRosterEmails(sb, { batchSize: 80, maxBatches: 12 });
    return json(res, 200, {
      ok: true,
      favourites,
      roster,
      rosterDrain,
      sent: (favourites.sent || 0) + (roster.sent || 0) + (rosterDrain.sent || 0),
      skipped: (favourites.skipped || 0) + (roster.skipped || 0) + (rosterDrain.skipped || 0),
      errors: [
        ...(favourites.errors || []),
        ...(roster.errors || []),
        ...(rosterDrain.errors || []),
      ],
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: 'organiser_listing_alerts_failed',
      message: e.message || String(e),
    });
  }
};
