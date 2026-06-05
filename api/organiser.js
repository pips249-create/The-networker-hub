/**
 * Single serverless function for all /api/organiser/* routes (Hobby plan function limit).
 */
const { getSubRoute } = require('./_lib/route-path');
const { json, setCors } = require('./_lib/auth');

const routes = {
  bootstrap: require('./_lib/routes/organiser-bootstrap'),
  groups: require('./_lib/routes/organiser-groups'),
  events: require('./_lib/routes/organiser-events'),
  tickets: require('./_lib/routes/organiser-tickets'),
  attendees: require('./_lib/routes/organiser-attendees'),
  team: require('./_lib/routes/organiser-team'),
  cancellations: require('./_lib/routes/organiser-cancellations'),
  payouts: require('./_lib/routes/organiser-payouts'),
};

module.exports = async function handler(req, res) {
  setCors(req, res);
  const route = getSubRoute(req, '/api/organiser');
  const fn = routes[route];
  if (!fn) {
    return json(res, 404, { error: 'not_found', path: route || '(empty)' });
  }
  return fn(req, res);
};
