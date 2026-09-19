const { normalizeEmail, normalizeOrderId } = require('./_util');

function orderIdFromEventbriteApiUrl(apiUrl) {
  const m = String(apiUrl || '').match(/\/orders\/(\d+)/i);
  return m ? m[1] : '';
}

function buildEventbriteOrderRequestUrl(apiUrl) {
  const base = String(apiUrl || '').trim();
  if (!base) return '';
  const withSlash = base.endsWith('/') ? base : base + '/';
  const sep = withSlash.includes('?') ? '&' : '?';
  return withSlash + sep + 'expand=event,attendees';
}

async function fetchEventbriteOrder(apiUrl, privateToken) {
  const token = String(privateToken || '').trim();
  const requestUrl = buildEventbriteOrderRequestUrl(apiUrl);
  if (!token || !requestUrl) {
    const e = new Error('eventbrite_private_token_missing');
    e.status = 503;
    throw e;
  }

  const res = await fetch(requestUrl, {
    method: 'GET',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/json',
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const e = new Error(
      (data && (data.error_description || data.error)) ||
        'eventbrite_order_fetch_failed_' + res.status
    );
    e.status = res.status === 401 || res.status === 403 ? 401 : 502;
    e.eventbriteStatus = res.status;
    throw e;
  }
  if (!data || typeof data !== 'object') {
    const e = new Error('eventbrite_order_invalid_response');
    e.status = 502;
    throw e;
  }
  return data;
}

/** Map GET /v3/orders/{id}/?expand=event,attendees → registration row(s). */
function normalizeEventbriteOrderApiResponse(order) {
  if (!order || typeof order !== 'object') return [];

  const orderIdRaw = String(order.id || '').trim();
  const eventId =
    String(order.event_id || '').trim() ||
    String(order.event && order.event.id ? order.event.id : '').trim();

  const amountCents = Number(
    order.costs?.gross?.value ?? order.costs?.base_price?.value ?? order.amount_paid ?? 0
  );
  const amountPaid = Number.isFinite(amountCents) ? amountCents / 100 : 0;

  const attendees = Array.isArray(order.attendees) ? order.attendees : [];
  const rows = [];

  for (const att of attendees) {
    const email = normalizeEmail(att?.profile?.email || att?.email);
    if (!email || !orderIdRaw) continue;
    const attId = String(att.id || '').trim();
    const extEvent =
      String(att.event_id || '').trim() || eventId;
    rows.push({
      externalEventId: extEvent,
      orderId: normalizeOrderId(
        'eventbrite',
        attId ? orderIdRaw + '-' + attId : orderIdRaw + '-' + email
      ),
      email,
      name:
        String(att?.profile?.name || att?.profile?.first_name || order.name || '').trim() ||
        null,
      quantity: 1,
      amountPaid,
      status: 'confirmed',
      provider: 'eventbrite',
    });
  }

  if (!rows.length) {
    const email = normalizeEmail(order.email);
    if (email && orderIdRaw && eventId) {
      rows.push({
        externalEventId: eventId,
        orderId: normalizeOrderId('eventbrite', orderIdRaw),
        email,
        name: String(order.name || '').trim() || null,
        quantity: Math.max(1, Number(order.quantity) || 1),
        amountPaid,
        status: 'confirmed',
        provider: 'eventbrite',
      });
    }
  }

  return rows;
}

function eventbritePrivateTokenFromConfig(config) {
  const c = config && typeof config === 'object' ? config : {};
  return String(
    c.eventbritePrivateToken ||
      c.eventbrite_private_token ||
      c.privateToken ||
      c.private_token ||
      ''
  ).trim();
}

module.exports = {
  orderIdFromEventbriteApiUrl,
  buildEventbriteOrderRequestUrl,
  fetchEventbriteOrder,
  normalizeEventbriteOrderApiResponse,
  eventbritePrivateTokenFromConfig,
};
