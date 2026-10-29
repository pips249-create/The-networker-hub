/**
 * Poll connected Eventbrite orgs and auto-import new matching events.
 * GET/POST /api/cron/eventbrite-event-sync
 */
const { json } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { authorizeCron } = require('../cron-auth');
const { syncAllConnectedEventbriteOrgs } = require('../eventbrite-org-event-sync');

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
    const summary = await syncAllConnectedEventbriteOrgs(sb, {
      source: 'cron',
      maxAccounts: 25,
      maxCreate: 15,
    });
    return json(res, 200, summary);
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: 'eventbrite_event_sync_failed',
      message: e.message || String(e),
    });
  }
};
