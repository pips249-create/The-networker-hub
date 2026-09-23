const { dig, normalizeEmail, normalizeOrderId } = require('./_util');

/** Extract Eventbrite event id from api_url like .../events/123456789/ */
function eventIdFromApiUrl(url) {
  const m = String(url || '').match(/\/events\/(\d+)/i);
  return m ? m[1] : '';
}

function normalizeEventbriteWebhook(body) {
  if (!body || typeof body !== 'object') return null;

  const apiUrl = dig(body, [
    ['api_url'],
    ['config', 'action', 'api_url'],
    ['config', 'webhook', 'api_url'],
  ]);
  const configAction = String(dig(body, [['config', 'action']]) || body.action || '').toLowerCase();

  let externalEventId =
    String(body.event_id || body.eventId || '').trim() ||
    eventIdFromApiUrl(apiUrl) ||
    eventIdFromApiUrl(dig(body, [['resource', 'url']])) ||
    eventIdFromApiUrl(dig(body, [['config', 'user_id']]));

  const orderPayload = body.resource || body.order || body.payload || body;
  if (!externalEventId) {
    externalEventId =
      eventIdFromApiUrl(orderPayload.event_id) ||
      String(orderPayload.event_id || '').trim();
  }

  const orderId =
    String(orderPayload.id || orderPayload.order_id || body.order_id || '').trim() ||
    String(dig(body, [['config', 'action', 'id']])).trim();

  const email =
    normalizeEmail(
      dig(orderPayload, [
        ['email'],
        ['attendees', 0, 'profile', 'email'],
        ['costs', 'gross', 'display'],
      ])
    ) ||
    normalizeEmail(dig(body, [['config', 'action', 'email']]));

  const name =
    String(
      dig(orderPayload, [
        ['name'],
        ['attendees', 0, 'profile', 'name'],
        ['first_name'],
      ]) || ''
    ).trim() || null;

  const quantity = Number(
    orderPayload.quantity ?? orderPayload.qty ?? dig(orderPayload, [['attendees', 'length']]) ?? 1
  );

  const amountPaid = Number(
    orderPayload.amount_paid ??
      orderPayload.amountPaid ??
      dig(orderPayload, [['costs', 'gross', 'value']]) ??
      0
  );

  if (!externalEventId || !orderId || !email) {
    return {
      partial: true,
      externalEventId: externalEventId || null,
      orderId: orderId || null,
      email: email || null,
      configAction,
      reason: 'missing_fields',
    };
  }

  return {
    externalEventId,
    orderId: normalizeOrderId('eventbrite', orderId),
    email,
    name,
    quantity: Number.isFinite(quantity) ? quantity : 1,
    amountPaid: Number.isFinite(amountPaid) ? amountPaid / 100 : 0,
    status: configAction.includes('cancel') ? 'cancelled' : 'confirmed',
    provider: 'eventbrite',
  };
}

module.exports = { normalizeEventbriteWebhook, eventIdFromApiUrl };
