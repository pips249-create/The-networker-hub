const { normalizeEmail, normalizeOrderId } = require('./_util');

function orderIdFromEventbriteApiUrl(apiUrl) {
  const m = String(apiUrl || '').match(/\/orders\/(\d+)/i);
  return m ? m[1] : '';
}

/** Attendee webhooks use …/events/{eventId}/attendees/{attendeeId}/ */
function eventbriteAttendeeRefFromApiUrl(apiUrl) {
  const m = String(apiUrl || '').match(/\/events\/(\d+)\/attendees\/(\d+)/i);
  if (!m) return null;
  return { eventId: m[1], attendeeId: m[2] };
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

function answerText(answer) {
  if (answer == null) return '';
  if (typeof answer === 'string' || typeof answer === 'number') return String(answer).trim();
  if (Array.isArray(answer)) {
    return answer
      .map(answerText)
      .filter(Boolean)
      .join(', ');
  }
  if (typeof answer === 'object') {
    return String(answer.text || answer.answer || answer.value || '').trim();
  }
  return '';
}

function answerMatching(answers, questionRe) {
  const rows = Array.isArray(answers) ? answers : [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const question = String(row.question || row.question_text || row.text || '').toLowerCase();
    if (!questionRe.test(question)) continue;
    const text = answerText(row.answer != null ? row.answer : row.answer_text);
    if (text) return text;
  }
  return '';
}

function eventbriteAttendeeEmail(att) {
  if (!att || typeof att !== 'object') return '';
  const profile = att.profile && typeof att.profile === 'object' ? att.profile : {};
  const direct = normalizeEmail(profile.email || att.email || profile.email_address);
  if (direct) return direct;
  const answers = Array.isArray(att.answers) ? att.answers : [];
  for (const row of answers) {
    if (!row || typeof row !== 'object') continue;
    const type = String(row.type || row.question_type || '').toLowerCase();
    const question = String(row.question || row.question_text || row.text || '').toLowerCase();
    if (type !== 'email' && !/e-?mail/.test(question)) continue;
    const email = normalizeEmail(answerText(row.answer != null ? row.answer : row.answer_text));
    if (email) return email;
  }
  return '';
}

function eventbriteAttendeeName(att) {
  if (!att || typeof att !== 'object') return '';
  const profile = att.profile && typeof att.profile === 'object' ? att.profile : {};
  const named = String(profile.name || '').trim();
  if (named) return named;
  const combined = [profile.first_name, profile.last_name]
    .map(function (part) {
      return String(part || '').trim();
    })
    .filter(Boolean)
    .join(' ');
  if (combined) return combined;
  const answers = att.answers;
  const first = answerMatching(answers, /first.?name/);
  const last = answerMatching(answers, /last.?name|surname/);
  const fromParts = [first, last].filter(Boolean).join(' ').trim();
  if (fromParts) return fromParts;
  return answerMatching(answers, /^name$|full name|attendee name/);
}

function eventbriteProfileField(att, profileKeys, questionRe) {
  const profile = att && att.profile && typeof att.profile === 'object' ? att.profile : {};
  for (const key of profileKeys) {
    const value = String(profile[key] || '').trim();
    if (value) return value;
  }
  return answerMatching(att && att.answers, questionRe);
}

function attendeeInfoScore(att) {
  return (eventbriteAttendeeEmail(att) ? 2 : 0) + (eventbriteAttendeeName(att) ? 1 : 0);
}

/** Combine order expand, the attendees list, and a freshly fetched attendee. Richer profiles win. */
function mergeEventbriteAttendees(lists) {
  const byId = new Map();
  const nameless = [];
  (lists || []).forEach(function (list) {
    (list || []).forEach(function (att) {
      if (!att || typeof att !== 'object') return;
      const id = String(att.id || '').trim();
      if (!id) {
        nameless.push(att);
        return;
      }
      const prev = byId.get(id);
      if (!prev) {
        byId.set(id, att);
        return;
      }
      if (attendeeInfoScore(att) >= attendeeInfoScore(prev)) {
        byId.set(id, Object.assign({}, prev, att));
      } else {
        byId.set(id, Object.assign({}, att, prev));
      }
    });
  });
  return Array.from(byId.values()).concat(nameless);
}

function eventbriteCentsToMajor(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n / 100 : null;
}

function eventbriteAttendeeStatus(att) {
  if (!att || typeof att !== 'object') return 'confirmed';
  if (att.cancelled || att.refunded) return 'cancelled';
  const status = String(att.status || '').toLowerCase();
  if (/cancel|refund/.test(status)) return 'cancelled';
  return 'confirmed';
}

async function fetchEventbriteJson(requestUrl, privateToken) {
  const token = String(privateToken || '').trim();
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
  return { ok: res.ok, status: res.status, data };
}

async function fetchEventbriteOrderAttendees(orderId, privateToken) {
  const id = String(orderId || '').trim();
  const token = String(privateToken || '').trim();
  if (!id || !token) return [];

  const all = [];
  const seenContinuations = new Set();
  let continuation = '';
  for (let page = 0; page < 20; page += 1) {
    let requestUrl = 'https://www.eventbriteapi.com/v3/orders/' + encodeURIComponent(id) + '/attendees/';
    if (continuation) requestUrl += '?continuation=' + encodeURIComponent(continuation);
    let result;
    try {
      result = await fetchEventbriteJson(requestUrl, token);
    } catch {
      return all;
    }
    if (!result.ok || !result.data || typeof result.data !== 'object') return all;
    if (Array.isArray(result.data.attendees)) all.push.apply(all, result.data.attendees);
    const pagination = result.data.pagination;
    const next =
      pagination && pagination.has_more_items ? String(pagination.continuation || '').trim() : '';
    if (!next || seenContinuations.has(next)) break;
    seenContinuations.add(next);
    continuation = next;
  }
  return all;
}

async function fetchEventbriteAttendee(eventId, attendeeId, privateToken) {
  const event = String(eventId || '').trim();
  const attendee = String(attendeeId || '').trim();
  const requestUrl =
    'https://www.eventbriteapi.com/v3/events/' +
    encodeURIComponent(event) +
    '/attendees/' +
    encodeURIComponent(attendee) +
    '/';
  const result = await fetchEventbriteJson(requestUrl, privateToken);
  if (!result.ok || !result.data || typeof result.data !== 'object') {
    const e = new Error(
      (result.data && (result.data.error_description || result.data.error)) ||
        'eventbrite_attendee_fetch_failed_' + result.status
    );
    e.status = result.status === 401 || result.status === 403 ? 401 : 502;
    e.eventbriteStatus = result.status;
    throw e;
  }
  return result.data;
}

async function fetchEventbriteOrder(apiUrl, privateToken) {
  const requestUrl = buildEventbriteOrderRequestUrl(apiUrl);
  if (!requestUrl) {
    const e = new Error('eventbrite_private_token_missing');
    e.status = 503;
    throw e;
  }
  const result = await fetchEventbriteJson(requestUrl, privateToken);
  if (!result.ok) {
    const e = new Error(
      (result.data && (result.data.error_description || result.data.error)) ||
        'eventbrite_order_fetch_failed_' + result.status
    );
    e.status = result.status === 401 || result.status === 403 ? 401 : 502;
    e.eventbriteStatus = result.status;
    throw e;
  }
  if (!result.data || typeof result.data !== 'object') {
    const e = new Error('eventbrite_order_invalid_response');
    e.status = 502;
    throw e;
  }
  return result.data;
}

/** Map an Eventbrite order, plus any attendee lists, to one registration per ticket holder. */
function registrationsFromEventbriteOrder(order, attendeeLists) {
  const merged = mergeEventbriteAttendees(
    [eventbriteAttendeesFromOrder(order)].concat(attendeeLists || [])
  );
  const source =
    order && merged.length ? Object.assign({}, order, { attendees: merged }) : order;
  return normalizeEventbriteOrderApiResponse(source);
}

/** Map GET /v3/orders/{id}/?expand=event,attendees → registration row(s). */
function normalizeEventbriteOrderApiResponse(order) {
  if (!order || typeof order !== 'object') return [];

  const orderIdRaw = String(order.id || '').trim();
  const eventId =
    String(order.event_id || '').trim() ||
    String(order.event && order.event.id ? order.event.id : '').trim();

  const orderAmountRaw = eventbriteCentsToMajor(
    order.costs?.gross?.value ?? order.costs?.base_price?.value ?? order.amount_paid
  );
  const orderAmount = orderAmountRaw == null ? 0 : orderAmountRaw;

  const attendees = eventbriteAttendeesFromOrder(order);
  const rows = [];
  const guestNames = [];
  let assignedOrderAmount = false;

  for (const att of attendees) {
    const email = eventbriteAttendeeEmail(att);
    const name = eventbriteAttendeeName(att) || null;
    const status = eventbriteAttendeeStatus(att);
    if (!email || !orderIdRaw) {
      if (name && status !== 'cancelled') guestNames.push(name);
      continue;
    }
    const attId = String(att.id || '').trim();
    const extEvent = String(att.event_id || '').trim() || eventId;
    const ownAmount = eventbriteCentsToMajor(att.costs?.gross?.value ?? att.costs?.base_price?.value);
    let amountPaid = ownAmount;
    if (amountPaid == null) {
      if (status !== 'cancelled' && !assignedOrderAmount) {
        amountPaid = orderAmount;
        assignedOrderAmount = true;
      } else {
        amountPaid = 0;
      }
    } else if (status !== 'cancelled') {
      assignedOrderAmount = true;
    }
    const company = eventbriteProfileField(att, ['company'], /company|organisation|organization/);
    const jobTitle = eventbriteProfileField(att, ['job_title', 'jobTitle'], /job.?title|role|position/);
    rows.push({
      externalEventId: extEvent,
      orderId: normalizeOrderId(
        'eventbrite',
        attId ? orderIdRaw + '-' + attId : orderIdRaw + '-' + email
      ),
      email,
      name,
      company: company || null,
      jobTitle: jobTitle || null,
      quantity: Math.max(1, Number(att.quantity) || 1),
      amountPaid,
      status,
      provider: 'eventbrite',
    });
  }

  if (guestNames.length && rows.length) {
    const primary = String(rows[0].name || '').trim().toLowerCase();
    const extras = guestNames.filter(function (guest) {
      return guest.toLowerCase() !== primary;
    });
    if (extras.length) {
      rows[0].guestNames = extras;
      rows[0].quantity = Math.max(Number(rows[0].quantity) || 1, extras.length + 1);
    }
  }

  if (!rows.length) {
    const email = normalizeEmail(order.email);
    if (email && orderIdRaw && eventId) {
      rows.push({
        externalEventId: eventId,
        orderId: normalizeOrderId('eventbrite', orderIdRaw),
        email,
        name: String(order.name || '').trim() || null,
        quantity: Math.max(1, Number(order.quantity) || 1, guestNames.length + 1),
        guestNames: guestNames.length ? guestNames : undefined,
        amountPaid: orderAmount,
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
  eventbriteAttendeeRefFromApiUrl,
  buildEventbriteOrderRequestUrl,
  eventbriteAttendeesFromOrder,
  eventbriteAttendeeEmail,
  eventbriteAttendeeName,
  mergeEventbriteAttendees,
  fetchEventbriteOrder,
  fetchEventbriteOrderAttendees,
  fetchEventbriteAttendee,
  registrationsFromEventbriteOrder,
  normalizeEventbriteOrderApiResponse,
  eventbritePrivateTokenFromConfig,
};
