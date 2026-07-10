/**
 * Single serverless function for all /api/auth/* routes (Hobby plan function limit).
 */
const { getSubRoute } = require('./_lib/route-path');
const { json, setCors } = require('./_lib/auth');

function requestPathname(req) {
  if (!req.url) return '';
  try {
    return new URL(req.url, 'https://internal.local').pathname;
  } catch {
    return String(req.url).split('?')[0];
  }
}

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
  'guest-visit-eligibility': require('./_lib/routes/auth-guest-visit-eligibility'),
  'alumni-eligibility': require('./_lib/routes/auth-alumni-eligibility'),
  reviews: require('./_lib/routes/auth-reviews'),
  favourites: require('./_lib/routes/auth-favourites'),
  'opportunity-favourites': require('./_lib/routes/auth-opportunity-favourites'),
  'opportunity-saved-searches': require('./_lib/routes/auth-opportunity-saved-searches'),
  'organiser-favourites': require('./_lib/routes/auth-organiser-favourites'),
  profile: require('./_lib/routes/auth-profile'),
  'stop-impersonate': require('./_lib/routes/auth-stop-impersonate'),
  'report-listing': require('./_lib/routes/auth-report-listing'),
  'report-review': require('./_lib/routes/auth-report-review'),
  'accept-organiser-terms': require('./_lib/routes/auth-accept-organiser-terms'),
  'organiser-access': require('./_lib/routes/auth-organiser-access'),
  'verify-organiser-email': require('./_lib/routes/auth-verify-organiser-email'),
  'cancel-booking': require('./_lib/routes/auth-cancel-booking'),
  'nudge-ticket-sales': require('./_lib/routes/auth-nudge-ticket-sales'),
  'site-access': require('./_lib/routes/site-access'),
};

module.exports = async function handler(req, res) {
  setCors(req, res);

  const pathname = requestPathname(req);
  if (pathname === '/api/site-access' || pathname === '/api/auth/site-access') {
    return routes['site-access'](req, res);
  }

  const route = getSubRoute(req, '/api/auth');
  const fn = routes[route];
  if (!fn) {
    return json(res, 404, { error: 'not_found', path: route || '(empty)' });
  }
  return fn(req, res);
};
