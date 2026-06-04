/**
 * Single serverless function for all /api/auth/* routes (Hobby plan function limit).
 */
const { getSubRoute } = require('./_lib/route-path');
const { json, setCors } = require('./_lib/auth');

const routes = {
  login: require('./_lib/routes/auth-login'),
  session: require('./_lib/routes/auth-session'),
  logout: require('./_lib/routes/auth-logout'),
  'hub-mode': require('./_lib/routes/auth-hub-mode'),
  'config-check': require('./_lib/routes/auth-config-check'),
  'setup-admin': require('./_lib/routes/auth-setup-admin'),
  'forgot-password': require('./_lib/routes/auth-forgot-password'),
  'reset-password': require('./_lib/routes/auth-reset-password'),
};

module.exports = async function handler(req, res) {
  setCors(req, res);
  const route = getSubRoute(req, '/api/auth');
  const fn = routes[route];
  if (!fn) {
    return json(res, 404, { error: 'not_found', path: route || '(empty)' });
  }
  return fn(req, res);
};
