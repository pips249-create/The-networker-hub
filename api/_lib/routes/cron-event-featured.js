const { json } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { authorizeCron } = require('../cron-auth');
const { runFeaturedListingMaintenance } = require('../event-featured');
const { expireFeaturedOrganisers } = require('../admin-spotlight-data');
const { expirePrepaidCityPartnerSlots } = require('../city-partner-subscriptions');
const { expireManualSponsorshipPlacements } = require('../expire-manual-sponsorships');

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
    const [result, organisersExpired, cityPartnersExpired, manualSponsorshipsExpired] =
      await Promise.all([
        runFeaturedListingMaintenance(sb),
        expireFeaturedOrganisers(sb),
        expirePrepaidCityPartnerSlots(sb),
        expireManualSponsorshipPlacements(sb),
      ]);
    return json(res, 200, {
      ok: true,
      ...result,
      organisersExpired,
      cityPartnersExpired,
      manualSponsorshipsExpired,
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: 'event_featured_maintenance_failed',
      message: e.message || String(e),
    });
  }
};
