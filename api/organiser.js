/**
 * Single serverless function for all /api/organiser/* routes (Hobby plan function limit).
 */
const { getSubRoute } = require('./_lib/route-path');
const { wrapHandler } = require('./_lib/sentry');
const { json, setCors } = require('./_lib/auth');

const routes = {
  bootstrap: require('./_lib/routes/organiser-bootstrap'),
  'workspace-stats': require('./_lib/routes/organiser-workspace-stats'),
  groups: require('./_lib/routes/organiser-groups'),
  'group-claims': require('./_lib/routes/organiser-group-claims'),
  'opportunity-claims': require('./_lib/routes/organiser-opportunity-claims'),
  events: require('./_lib/routes/organiser-events'),
  tickets: require('./_lib/routes/organiser-tickets'),
  attendees: require('./_lib/routes/organiser-attendees'),
  'attendee-blocks': require('./_lib/routes/organiser-attendee-blocks'),
  'attendee-attendance': require('./_lib/routes/organiser-attendee-attendance'),
  'attendee-badges-pdf': require('./_lib/routes/organiser-attendee-badges-pdf'),
  'application-decisions': require('./_lib/routes/organiser-application-decisions'),
  'alumni-invites': require('./_lib/routes/organiser-alumni-invites'),
  'ce-member-invites': require('./_lib/routes/organiser-ce-member-invites'),
  reviews: require('./_lib/routes/organiser-reviews'),
  team: require('./_lib/routes/organiser-team'),
  activity: require('./_lib/routes/organiser-activity'),
  cancellations: require('./_lib/routes/organiser-cancellations'),
  'stripe-connect': require('./_lib/routes/organiser-stripe-connect'),
  payouts: require('./_lib/routes/organiser-payouts'),
  opportunities: require('./_lib/routes/organiser-opportunities'),
  'opportunity-premium-checkout': require('./_lib/routes/organiser-opportunity-premium-checkout'),
  'opportunity-premium-complete': require('./_lib/routes/organiser-opportunity-premium-complete'),
  'opportunity-premium-waitlist': require('./_lib/routes/organiser-opportunity-premium-waitlist'),
  'opportunity-listing-checkout': require('./_lib/routes/organiser-opportunity-listing-checkout'),
  'opportunity-listing-complete': require('./_lib/routes/organiser-opportunity-listing-complete'),
  'event-featured-checkout': require('./_lib/routes/organiser-event-featured-checkout'),
  'event-featured-complete': require('./_lib/routes/organiser-event-featured-complete'),
  'event-featured-quote': require('./_lib/routes/organiser-event-featured-quote'),
  'group-update-credits-checkout': require('./_lib/routes/organiser-group-update-credits-checkout'),
  'group-update-credits-complete': require('./_lib/routes/organiser-group-update-credits-complete'),
  'connections-credits-checkout': require('./_lib/routes/organiser-connections-credits-checkout'),
  'connections-credits-complete': require('./_lib/routes/organiser-connections-credits-complete'),
  'event-connections': require('./_lib/routes/organiser-event-connections'),
  'opportunity-enquiries': require('./_lib/routes/organiser-opportunity-enquiries'),
  'opportunity-open-days': require('./_lib/routes/organiser-opportunity-open-days'),
  roster: require('./_lib/routes/organiser-roster'),
  'member-roster': require('./_lib/routes/organiser-roster'),
  'membership-plans': require('./_lib/routes/organiser-membership-plans'),
  'logo-proxy': require('./_lib/routes/organiser-logo-proxy'),
  'website-brand': require('./_lib/routes/organiser-website-brand'),
  'group-updates': require('./_lib/routes/organiser-group-updates'),
  'promote-action': require('./_lib/routes/organiser-promote-action'),
};

module.exports = wrapHandler(async function handler(req, res) {
  setCors(req, res);
  const route = getSubRoute(req, '/api/organiser');
  const fn = routes[route];
  if (!fn) {
    return json(res, 404, { error: 'not_found', path: route || '(empty)' });
  }
  return fn(req, res);
});