const { normalizeEventbriteWebhook } = require('./connected-booking-providers/adapters/eventbrite');
const {
  fetchEventbriteOrder,
  normalizeEventbriteOrderApiResponse,
  eventbritePrivateTokenFromConfig,
  orderIdFromEventbriteApiUrl,
} = require('./connected-booking-providers/adapters/eventbrite-api');

function isEventbriteOrderNotification(body) {
  const apiUrl = String(body?.api_url || '');
  const action = String(body?.config?.action || body?.action || '').toLowerCase();
  return /\/orders\/\d+/i.test(apiUrl) && action.includes('order');
}

function isEventbriteConnectivityPing(body, normalized) {
  if (!normalized?.partial) return false;
  if (!body?.api_url || !body?.config) return false;
  if (isEventbriteOrderNotification(body)) return false;
  return true;
}

async function resolveEventbriteWebhookRegistrations(body, connection) {
  const direct = normalizeEventbriteWebhook(body);
  if (direct && !direct.partial) {
    return { registrations: [direct], source: 'webhook_payload' };
  }

  if (!isEventbriteOrderNotification(body)) {
    return { registrations: [], source: 'unrecognized', partial: direct };
  }

  const apiUrl = String(body.api_url || '').trim();
  const orderId = orderIdFromEventbriteApiUrl(apiUrl);
  if (!orderId) {
    return { registrations: [], source: 'missing_order_url', partial: direct };
  }

  const token = eventbritePrivateTokenFromConfig(connection?.config);
  const order = await fetchEventbriteOrder(apiUrl, token);
  const registrations = normalizeEventbriteOrderApiResponse(order);
  return {
    registrations,
    source: 'eventbrite_api',
    orderId,
  };
}

module.exports = {
  isEventbriteOrderNotification,
  isEventbriteConnectivityPing,
  resolveEventbriteWebhookRegistrations,
};
