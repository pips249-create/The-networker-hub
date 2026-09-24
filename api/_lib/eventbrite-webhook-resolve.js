const { normalizeEventbriteWebhook } = require('./connected-booking-providers/adapters/eventbrite');
const {
  fetchEventbriteOrder,
  fetchEventbriteOrderAttendees,
  fetchEventbriteAttendee,
  registrationsFromEventbriteOrder,
  eventbritePrivateTokenFromConfig,
  eventbriteAttendeeRefFromApiUrl,
  orderIdFromEventbriteApiUrl,
} = require('./connected-booking-providers/adapters/eventbrite-api');

/** Real order webhooks point at …/orders/{id}/; config.action is often omitted (Eventbrite docs). */
function isEventbriteOrderNotification(body) {
  const apiUrl = String(body?.api_url || '');
  return /\/orders\/\d+/i.test(apiUrl);
}

/** Fired when a buyer adds or edits a ticket holder's details after payment. */
function isEventbriteAttendeeNotification(body) {
  return Boolean(eventbriteAttendeeRefFromApiUrl(body?.api_url));
}

function isEventbriteConnectivityPing(body, normalized) {
  if (!normalized?.partial) return false;
  if (!body?.api_url || !body?.config) return false;
  if (isEventbriteOrderNotification(body)) return false;
  if (isEventbriteAttendeeNotification(body)) return false;
  return true;
}

async function registrationsForEventbriteOrder(order, orderId, token, extraAttendees) {
  const listed = orderId ? await fetchEventbriteOrderAttendees(orderId, token) : [];
  return registrationsFromEventbriteOrder(order, [listed].concat(extraAttendees || []));
}

async function resolveEventbriteAttendeeNotification(body, token) {
  const ref = eventbriteAttendeeRefFromApiUrl(body?.api_url);
  const attendee = await fetchEventbriteAttendee(ref.eventId, ref.attendeeId, token);
  const orderId = String(attendee?.order_id || '').trim();
  if (!orderId) {
    return {
      registrations: registrationsFromEventbriteOrder(
        {
          id: ref.attendeeId,
          event_id: String(attendee?.event_id || ref.eventId),
        },
        [[attendee]]
      ),
      source: 'eventbrite_api',
      orderId: ref.attendeeId,
    };
  }

  let order = null;
  try {
    order = await fetchEventbriteOrder(
      'https://www.eventbriteapi.com/v3/orders/' + encodeURIComponent(orderId) + '/',
      token
    );
  } catch {
    order = {
      id: orderId,
      event_id: String(attendee?.event_id || ref.eventId),
      email: attendee?.profile?.email || '',
      name: attendee?.profile?.name || '',
    };
  }

  const registrations = await registrationsForEventbriteOrder(order, orderId, token, [[attendee]]);
  return { registrations, source: 'eventbrite_api', orderId };
}

async function resolveEventbriteWebhookRegistrations(body, connection) {
  const direct = normalizeEventbriteWebhook(body);
  const attendeeNote = isEventbriteAttendeeNotification(body);
  const orderNote = isEventbriteOrderNotification(body);

  if (direct && !direct.partial && !orderNote && !attendeeNote) {
    return { registrations: [direct], source: 'webhook_payload' };
  }

  if (!orderNote && !attendeeNote) {
    return { registrations: [], source: 'unrecognized', partial: direct };
  }

  const token = eventbritePrivateTokenFromConfig(connection?.config);
  if (attendeeNote) {
    return resolveEventbriteAttendeeNotification(body, token);
  }

  const apiUrl = String(body.api_url || '').trim();
  const orderId = orderIdFromEventbriteApiUrl(apiUrl);
  if (!orderId) {
    return { registrations: [], source: 'missing_order_url', partial: direct };
  }

  const order = await fetchEventbriteOrder(apiUrl, token);
  const registrations = await registrationsForEventbriteOrder(order, orderId, token);
  return {
    registrations,
    source: 'eventbrite_api',
    orderId,
  };
}

module.exports = {
  isEventbriteOrderNotification,
  isEventbriteAttendeeNotification,
  isEventbriteConnectivityPing,
  resolveEventbriteWebhookRegistrations,
};
