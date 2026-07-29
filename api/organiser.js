/**
 * Single serverless function for all /api/organiser/* routes (Hobby plan function limit).
 */
const { getSubRoute } = require('./_lib/route-path');
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
  'attendee-badges-pdf': require('./_lib/routes/organiser-attendee-badges-pdf'),
  'application-decisions': require('./_lib/routes/organiser-application-decisions'),
  'alumni-invites': require('./_lib/routes/organiser-alumni-invites'),
  reviews: require('./_lib/routes/organiser-reviews'),
  team: require('./_lib/routes/organiser-team'),
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
  'opportunity-enquiries': require('./_lib/routes/organiser-opportunity-enquiries'),
  roster: require('./_lib/routes/organiser-roster'),
  'logo-proxy': require('./_lib/routes/organiser-logo-proxy'),
  'website-brand': require('./_lib/routes/organiser-website-brand'),
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
