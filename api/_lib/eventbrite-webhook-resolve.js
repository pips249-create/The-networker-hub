const { normalizeEventbriteWebhook } = require('./connected-booking-providers/adapters/eventbrite');
const {
  fetchEventbriteOrder,
  fetchEventbriteOrderAttendees,
  normalizeEventbriteOrderApiResponse,
  eventbritePrivateTokenFromConfig,
  orderIdFromEventbriteApiUrl,
} = require('./connected-booking-providers/adapters/eventbrite-api');

/** Real order webhooks point at …/orders/{id}/; config.action is often omitted (Eventbrite docs). */
function isEventbriteOrderNotification(body) {
  const apiUrl = String(body?.api_url || '');
  return /\/orders\/\d+/i.test(apiUrl);
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
  let registrations = normalizeEventbriteOrderApiResponse(order);
  if (!registrations.length && orderId) {
    const attendees = await fetchEventbriteOrderAttendees(orderId, token);
    if (attendees.length) {
      registrations = normalizeEventbriteOrderApiResponse(Object.assign({}, order, { attendees }));
    }
  }
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
