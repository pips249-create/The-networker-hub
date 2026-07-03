/**
 * Single serverless function for all /api/admin/* routes (Hobby plan function limit).
 */
const { getSubRoute } = require('./_lib/route-path');
const { json, setCors } = require('./_lib/auth');

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
  emails: require('./_lib/routes/admin-emails'),
  'event-health': require('./_lib/routes/admin-event-health'),
  organisers: require('./_lib/routes/admin-organisers'),
  opportunities: require('./_lib/routes/admin-opportunities'),
  impersonate: require('./_lib/routes/admin-impersonate'),
  import: require('./_lib/routes/admin-import'),
  campaigns: require('./_lib/routes/admin-campaigns'),
  newsletter: require('./_lib/routes/admin-newsletter'),
  rankings: require('./_lib/routes/admin-rankings'),
  spotlight: require('./_lib/routes/admin-spotlight'),
  bookings: require('./_lib/routes/admin-bookings'),
};

module.exports = async function handler(req, res) {
  setCors(req, res);
  const route = getSubRoute(req, '/api/admin');
  const fn = routes[route];
  if (!fn) {
    return json(res, 404, { error: 'not_found', path: route || '(empty)' });
  }
  return fn(req, res);
};
