/**
 * Single serverless function for all /api/auth/* routes (Hobby plan function limit).
 */
const { getSubRoute } = require('./_lib/route-path');
const { json, setCors } = require('./_lib/auth');

const routes = {
  login: require('./_lib/routes/auth-login'),
  register: require('./_lib/routes/auth-register'),
  session: require('./_lib/routes/auth-session'),
  logout: require('./_lib/routes/auth-logout'),
  'hub-mode': require('./_lib/routes/auth-hub-mode'),
  'config-check': require('./_lib/routes/auth-config-check'),
  'setup-admin': require('./_lib/routes/auth-setup-admin'),
  'forgot-password': require('./_lib/routes/auth-forgot-password'),
  'reset-password': require('./_lib/routes/auth-reset-password'),
  'attendee-dashboard': require('./_lib/routes/auth-attendee-dashboard'),
  'complete-booking': require('./_lib/routes/auth-complete-booking'),
  'submit-application': require('./_lib/routes/auth-submit-application'),
  'event-application': require('./_lib/routes/auth-event-application'),
  'create-checkout': require('./_lib/routes/auth-create-checkout'),
  reviews: require('./_lib/routes/auth-reviews'),
  favourites: require('./_lib/routes/auth-favourites'),
  'organiser-favourites': require('./_lib/routes/auth-organiser-favourites'),
  profile: require('./_lib/routes/auth-profile'),
  'stop-impersonate': require('./_lib/routes/auth-stop-impersonate'),
  'report-listing': require('./_lib/routes/auth-report-listing'),
  'report-review': require('./_lib/routes/auth-report-review'),
  'accept-organiser-terms': require('./_lib/routes/auth-accept-organiser-terms'),
  'cancel-booking': require('./_lib/routes/auth-cancel-booking'),
  'nudge-ticket-sales': require('./_lib/routes/auth-nudge-ticket-sales'),
  'site-access': require('./_lib/routes/site-access'),
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
