/**
 * Single serverless function for all /api/admin/* routes (Hobby plan function limit).
 */
const { getSubRoute } = require('./_lib/route-path');
const { json, setCors, sessionFromRequest, requireAdmin } = require('./_lib/auth');

const routes = {
  metrics: require('./_lib/routes/admin-metrics'),
  insights: require('./_lib/routes/admin-insights'),
  events: require('./_lib/routes/admin-events'),
  users: require('./_lib/routes/admin-users'),
  moderation: require('./_lib/routes/admin-moderation'),
  financials: require('./_lib/routes/admin-financials'),
  sponsor: require('./_lib/routes/admin-sponsor'),
  'home-partners': require('./_lib/routes/admin-home-partners'),
  'event-carousel': require('./_lib/routes/admin-event-carousel'),
  'city-partner-waitlist': require('./_lib/routes/admin-city-partner-waitlist'),
  emails: require('./_lib/routes/admin-emails'),
  'event-health': require('./_lib/routes/admin-event-health'),
  organisers: require('./_lib/routes/admin-organisers'),
  opportunities: require('./_lib/routes/admin-opportunities'),
  impersonate: require('./_lib/routes/admin-impersonate'),
  import: require('./_lib/routes/admin-import'),
  campaigns: require('./_lib/routes/admin-campaigns'),
  rankings: require('./_lib/routes/admin-rankings'),
  spotlight: require('./_lib/routes/admin-spotlight'),
  bookings: require('./_lib/routes/admin-bookings'),
  complaints: require('./_lib/routes/admin-complaints'),
  'revenue-deals': require('./_lib/routes/admin-revenue-deals'),
  'revenue-targets': require('./_lib/routes/admin-revenue-targets'),
};

module.exports = async function handler(req, res) {
  try {
    setCors(req, res);

    const session = sessionFromRequest(req);
    const gate = requireAdmin(session);
    if (!gate.ok) {
      return json(res, gate.status, { error: gate.error, message: gate.message });
    }

    const route = getSubRoute(req, '/api/admin');
    const fn = routes[route];
    if (!fn) {
      return json(res, 404, { error: 'not_found', path: route || '(empty)' });
    }
    return await fn(req, res);
  } catch (e) {
    console.error('[admin] unhandled', e?.message || e);
    return json(res, 500, {
      ok: false,
      error: 'admin_handler_failed',
      message: e?.message || 'Admin request failed',
    });
  }
};
