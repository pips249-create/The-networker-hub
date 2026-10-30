/**
 * Public catalogue counts for live international hubs.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { applyPublicOrganiserBrowseFilter } = require('./supabase-organisers-browse');

const SUPPORTED_HUBS = new Set(['GB']);

function applyUpcomingEventsFilter(query) {
  return query.gt('starts_at', new Date().toISOString()).not('starts_at', 'is', null);
}

async function getInternationalHubStats(countryCode) {
  const code = String(countryCode || '')
    .trim()
    .toUpperCase();
  if (!SUPPORTED_HUBS.has(code)) {
    return { ok: false, error: 'unsupported_country' };
  }
  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      countryCode: code,
      configured: false,
      events: null,
      organisers: null,
      opportunities: null,
    };
  }

  const sb = getSupabaseAdmin();

  let eventsQuery = sb
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('approval_status', 'Approved')
    .eq('status', 'published');
  eventsQuery = applyUpcomingEventsFilter(eventsQuery);

  let organisersQuery = sb.from('organisers').select('id', { count: 'exact', head: true });
  organisersQuery = applyPublicOrganiserBrowseFilter(organisersQuery);

  const nowIso = new Date().toISOString();
  let opportunitiesQuery = sb
    .from('business_opportunities')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
    .eq('approval_status', 'Approved')
    // Match listingPaymentCurrent: active term, or legacy with no expiry.
    .or('listing_expires_at.is.null,listing_expires_at.gt.' + nowIso);

  const [eventsRes, organisersRes, opportunitiesRes] = await Promise.all([
    eventsQuery,
    organisersQuery,
    opportunitiesQuery,
  ]);

  if (eventsRes.error) throw new Error(eventsRes.error.message || 'events_count_failed');
  if (organisersRes.error) throw new Error(organisersRes.error.message || 'organisers_count_failed');
  if (opportunitiesRes.error) {
    throw new Error(opportunitiesRes.error.message || 'opportunities_count_failed');
  }

  return {
    ok: true,
    countryCode: code,
    configured: true,
    events: eventsRes.count || 0,
    organisers: organisersRes.count || 0,
    opportunities: opportunitiesRes.count || 0,
  };
}

module.exports = {
  getInternationalHubStats,
  SUPPORTED_HUBS,
};
