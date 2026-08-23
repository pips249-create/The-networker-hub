/**
 * Public catalogue counts for live international hubs.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { applyPublicOrganiserBrowseFilter } = require('./supabase-organisers-browse');
const { listPublishedOpportunities } = require('./supabase-opportunities');

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

  const [eventsRes, organisersRes, opportunities] = await Promise.all([
    eventsQuery,
    organisersQuery,
    listPublishedOpportunities(),
  ]);

  if (eventsRes.error) throw new Error(eventsRes.error.message || 'events_count_failed');
  if (organisersRes.error) throw new Error(organisersRes.error.message || 'organisers_count_failed');

  return {
    ok: true,
    countryCode: code,
    configured: true,
    events: eventsRes.count || 0,
    organisers: organisersRes.count || 0,
    opportunities: Array.isArray(opportunities) ? opportunities.length : 0,
  };
}

module.exports = {
  getInternationalHubStats,
  SUPPORTED_HUBS,
};
