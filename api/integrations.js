/**
 * /api/integrations/* — third-party registration hooks (Connected external booking).
 */
const { getSubRoute } = require('./_lib/route-path');
const { wrapHandler } = require('./_lib/sentry');
const { json, setCors } = require('./_lib/auth');

const routes = {
  booking: require('./_lib/routes/integrations-booking'),
};

module.exports = wrapHandler(async function handler(req, res) {
  setCors(req, res);
  const route = getSubRoute(req, '/api/integrations');
  const fn = routes[route];
  if (!fn) {
    return json(res, 404, { error: 'not_found', path: route || '(empty)' });
  }
  return fn(req, res);
});
