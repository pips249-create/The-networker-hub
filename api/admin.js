/**
 * Single serverless function for all /api/admin/* routes (Hobby plan function limit).
 */
const { getSubRoute } = require('./_lib/route-path');
const { json, setCors } = require('./_lib/auth');

const routes = {
  metrics: require('./_lib/routes/admin-metrics'),
  events: require('./_lib/routes/admin-events'),
  users: require('./_lib/routes/admin-users'),
  moderation: require('./_lib/routes/admin-moderation'),
  financials: require('./_lib/routes/admin-financials'),
  sponsor: require('./_lib/routes/admin-sponsor'),
  emails: require('./_lib/routes/admin-emails'),
  'event-health': require('./_lib/routes/admin-event-health'),
  organisers: require('./_lib/routes/admin-organisers'),
  impersonate: require('./_lib/routes/admin-impersonate'),
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
