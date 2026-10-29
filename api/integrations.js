/**
 * /api/integrations/* — third-party registration hooks (Connected external booking).
 */
const { wrapHandler } = require('./_lib/sentry');
const { json, setCors } = require('./_lib/auth');
const { parseIntegrationRoute } = require('./_lib/integration-route-path');

const bookingHandler = require('./_lib/routes/integrations-booking');
const providerWebhookHandler = require('./_lib/routes/integrations-provider-webhook');
const eventbriteOAuthCallbackHandler = require('./_lib/routes/integrations-eventbrite-oauth-callback');

module.exports = wrapHandler(async function handler(req, res) {
  setCors(req, res);
  const route = parseIntegrationRoute(req);
  if (route.type === 'booking') {
    return bookingHandler(req, res);
  }
  if (route.type === 'provider_webhook') {
    return providerWebhookHandler(req, res, route.provider);
  }
  if (route.type === 'eventbrite_oauth_callback') {
    return eventbriteOAuthCallbackHandler(req, res);
  }
  return json(res, 404, { error: 'not_found', path: route.parts ? route.parts.join('/') : '' });
});
