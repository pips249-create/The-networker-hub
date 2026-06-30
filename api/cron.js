/**
 * Scheduled jobs (Vercel Cron). Secured with CRON_SECRET when set.
 */
const { getSubRoute } = require('./_lib/route-path');
const { json, setCors } = require('./_lib/auth');

const routes = {
  'booking-reminders': require('./_lib/routes/cron-booking-reminders'),
  'favourite-sales': require('./_lib/routes/cron-favourite-sales'),
  'organiser-listing-alerts': require('./_lib/routes/cron-organiser-listing-alerts'),
  'event-featured': require('./_lib/routes/cron-event-featured'),
  'organiser-rankings': require('./_lib/routes/cron-organiser-rankings'),
};

module.exports = async function handler(req, res) {
  setCors(req, res);
  const route = getSubRoute(req, '/api/cron');
  const fn = routes[route];
  if (!fn) {
    return json(res, 404, { error: 'not_found', path: route || '(empty)' });
  }
  return fn(req, res);
};
