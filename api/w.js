/**
 * Short Connected provider webhooks — /w/eb/{token} (Eventbrite Payload URL ~70 chars).
 */
const { wrapHandler } = require('./_lib/sentry');
const { json, setCors } = require('./_lib/auth');
const { parseShortWebhookRoute } = require('./_lib/provider-webhook-url');
const providerWebhookHandler = require('./_lib/routes/integrations-provider-webhook');

module.exports = wrapHandler(async function handler(req, res) {
  setCors(req, res);
  const route = parseShortWebhookRoute(req);
  if (!route) {
    return json(res, 404, { ok: false, error: 'not_found' });
  }
  req.query = Object.assign({}, req.query || {}, { token: route.token });
  return providerWebhookHandler(req, res, route.provider);
});
