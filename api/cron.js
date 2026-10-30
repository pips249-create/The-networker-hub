/**
 * Scheduled jobs (Vercel Cron). Secured with CRON_SECRET when set.
 */
const { getSubRoute } = require('./_lib/route-path');
const { wrapHandler } = require('./_lib/sentry');
const { json, setCors } = require('./_lib/auth');
const {
  isAutomatedSequenceCronRoute,
  respondIfAutomatedSequencesPaused,
} = require('./_lib/automated-email-sequences');

const routes = {
  'booking-reminders': require('./_lib/routes/cron-booking-reminders'),
  'favourite-sales': require('./_lib/routes/cron-favourite-sales'),
  'organiser-listing-alerts': require('./_lib/routes/cron-organiser-listing-alerts'),
  'event-featured': require('./_lib/routes/cron-event-featured'),
  'opportunity-reminders': require('./_lib/routes/cron-opportunity-reminders'),
  'engagement-emails': require('./_lib/routes/cron-engagement-emails'),
  'post-event-reviews': require('./_lib/routes/cron-post-event-reviews'),
  'online-join-reminders': require('./_lib/routes/cron-online-join-reminders'),
  'organiser-rankings': require('./_lib/routes/cron-organiser-rankings'),
  'roster-emails': require('./_lib/routes/cron-roster-emails'),
  'group-updates': require('./_lib/routes/cron-group-updates'),
  'affiliate-commissions': require('./_lib/routes/cron-affiliate-commissions'),
  'directory-invite-nudge': require('./_lib/routes/cron-directory-invite-nudge'),
  'email-verify-reminders': require('./_lib/routes/cron-email-verify-reminders'),
  'eventbrite-event-sync': require('./_lib/routes/cron-eventbrite-event-sync'),
  'hubert-seed-intro-followups': require('./_lib/routes/cron-hubert-seed-intro-followups'),
};

module.exports = wrapHandler(async function handler(req, res) {
  setCors(req, res);
  const route = getSubRoute(req, '/api/cron');
  const fn = routes[route];
  if (!fn) {
    return json(res, 404, { error: 'not_found', path: route || '(empty)' });
  }
  if (isAutomatedSequenceCronRoute(route) && respondIfAutomatedSequencesPaused(res, json)) {
    return;
  }
  return fn(req, res);
});