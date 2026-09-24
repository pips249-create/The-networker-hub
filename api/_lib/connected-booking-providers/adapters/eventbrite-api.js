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

function eventbriteAttendeesFromOrder(order) {
  if (!order || typeof order !== 'object') return [];
  const raw = order.attendees;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.attendees)) return raw.attendees;
  }
  return [];
}

async function fetchEventbriteOrderAttendees(orderId, privateToken) {
  const id = String(orderId || '').trim();
  const token = String(privateToken || '').trim();
  if (!id || !token) return [];

  const requestUrl = 'https://www.eventbriteapi.com/v3/orders/' + encodeURIComponent(id) + '/attendees/';
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
  if (!res.ok || !data || typeof data !== 'object') return [];
  if (Array.isArray(data.attendees)) return data.attendees;
  return [];
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

  const attendees = eventbriteAttendeesFromOrder(order);
  const rows = [];

  for (const att of attendees) {
    const email = normalizeEmail(
      att?.profile?.email || att?.email || att?.profile?.email_address
    );
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

function stripBasicHtml(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function eventbriteDescriptionText(evt) {
  if (!evt || typeof evt !== 'object') return '';
  const desc = evt.description;
  if (typeof desc === 'string') return desc.trim();
  if (desc && typeof desc === 'object') {
    const text = String(desc.text || '').trim();
    if (text) return text;
    const html = String(desc.html || '').trim();
    if (html) return stripBasicHtml(html);
  }
  const name = evt.name;
  if (name && typeof name === 'object') {
    return String(name.text || '').trim();
  }
  return '';
}

function eventbriteTitleText(evt) {
  if (!evt || typeof evt !== 'object') return '';
  const name = evt.name;
  if (typeof name === 'string') return name.trim();
  if (name && typeof name === 'object') return String(name.text || '').trim();
  return String(evt.title || '').trim();
}

function eventbriteUtcIso(evt, key) {
  const block = evt && evt[key];
  if (!block || typeof block !== 'object') return '';
  const utc = String(block.utc || block.local || '').trim();
  return utc;
}

function eventbriteIsOnline(evt) {
  if (!evt || typeof evt !== 'object') return false;
  if (evt.online_event === true || evt.is_online_event === true) return true;
  const format = evt.format;
  if (format && typeof format === 'object') {
    const id = String(format.id || format.name || '').toLowerCase();
    if (id.includes('online')) return true;
  }
  return false;
}

/** Map GET /v3/events/{id}/?expand=venue → organiser updateEvent payload fields. */
function mapEventbriteEventToListingPatch(evt, opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const { preferEventbriteCheckoutUrl } = require('../../connected-booking-util');
  const patch = {};
  const title = eventbriteTitleText(evt);
  if (title) patch.title = title;

  const description = eventbriteDescriptionText(evt);
  if (description) patch.description = description;

  const startIso = eventbriteUtcIso(evt, 'start');
  const endIso = eventbriteUtcIso(evt, 'end');
  if (startIso) patch.date = startIso;
  if (endIso) patch.endDate = endIso;

  const online = eventbriteIsOnline(evt);
  patch.eventFormat = online ? 'Online' : 'In person';

  if (online) {
    const streamUrl = String(evt.url || evt.public_url || '').trim();
    if (streamUrl) patch.onlineLink = streamUrl;
  } else {
    const venue = evt.venue && typeof evt.venue === 'object' ? evt.venue : null;
    const addr = venue && venue.address && typeof venue.address === 'object' ? venue.address : {};
    const venueName = String(venue?.name || '').trim();
    const line1 = String(addr.address_1 || addr.address_1_line_1 || '').trim();
    const line2 = String(addr.address_2 || '').trim();
    const addressLine1 = [line1, line2].filter(Boolean).join(', ');
    const city = String(addr.city || '').trim();
    const postcode = String(addr.postal_code || addr.post_code || '').trim();
    if (venueName) patch.venue = venueName;
    if (addressLine1) patch.addressLine1 = addressLine1;
    if (city) patch.city = city;
    if (postcode) patch.postcode = postcode;
    if (venueName || addressLine1 || city || postcode) {
      patch.location = [venueName, addressLine1, city, postcode].filter(Boolean).join(', ');
    }
  }

  if (options.includeBookingUrl !== false) {
    const listingUrl = String(evt.url || evt.public_url || '').trim();
    if (listingUrl) {
      patch.externalBookingUrl = preferEventbriteCheckoutUrl(listingUrl);
    }
  }

  return patch;
}

async function fetchEventbriteEvent(externalEventId, privateToken) {
  const id = String(externalEventId || '').trim();
  const token = String(privateToken || '').trim();
  if (!id || !token) {
    const e = new Error('eventbrite_event_id_or_token_missing');
    e.status = 400;
    throw e;
  }
  const requestUrl =
    'https://www.eventbriteapi.com/v3/events/' +
    encodeURIComponent(id) +
    '/?expand=venue,format';
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
        'eventbrite_event_fetch_failed_' + res.status
    );
    e.status = res.status === 401 || res.status === 403 ? 401 : 502;
    e.eventbriteStatus = res.status;
    throw e;
  }
  if (!data || typeof data !== 'object') {
    const e = new Error('eventbrite_event_invalid_response');
    e.status = 502;
    throw e;
  }
  return data;
}

module.exports = {
  orderIdFromEventbriteApiUrl,
  buildEventbriteOrderRequestUrl,
  eventbriteAttendeesFromOrder,
  fetchEventbriteOrder,
  fetchEventbriteOrderAttendees,
  normalizeEventbriteOrderApiResponse,
  eventbritePrivateTokenFromConfig,
  fetchEventbriteEvent,
  mapEventbriteEventToListingPatch,
  eventbriteDescriptionText,
  eventbriteTitleText,
  eventbriteIsOnline,
};
