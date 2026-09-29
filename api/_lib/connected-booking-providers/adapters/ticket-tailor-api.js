const TICKET_TAILOR_API_BASE = 'https://api.tickettailor.com/v1';

function ticketTailorApiKeyFromConfig(config) {
  const c = config && typeof config === 'object' ? config : {};
  return String(
    c.ticketTailorApiKey ||
      c.ticket_tailor_api_key ||
      c.apiKey ||
      c.api_key ||
      ''
  ).trim();
}

function ticketTailorBasicAuthHeader(apiKey) {
  const key = String(apiKey || '').trim();
  if (!key) return '';
  return 'Basic ' + Buffer.from(key + ':', 'utf8').toString('base64');
}

function unwrapTicketTailorEvent(body) {
  if (!body || typeof body !== 'object') return null;
  if (String(body.object || '').toLowerCase() === 'event' && body.id) return body;
  if (body.data && typeof body.data === 'object') {
    const inner = body.data;
    if (String(inner.object || '').toLowerCase() === 'event' && inner.id) return inner;
    if (inner.id && (inner.name || inner.start)) return inner;
  }
  if (body.event && typeof body.event === 'object') return body.event;
  return null;
}

function ticketTailorDateIso(block) {
  if (!block || typeof block !== 'object') return '';
  return String(block.iso || block.utc || '').trim();
}

function ticketTailorTruthyFlag(raw) {
  if (raw === true) return true;
  return String(raw || '').trim().toLowerCase() === 'true';
}

function ticketTailorIsOnline(evt) {
  if (!evt || typeof evt !== 'object') return false;
  return ticketTailorTruthyFlag(evt.online_event);
}

function ticketTailorPublicBookingUrl(evt) {
  if (!evt || typeof evt !== 'object') return '';
  return String(evt.checkout_url || evt.url || '').trim();
}

/** Map GET /v1/events/{id} → organiser updateEvent payload fields. */
function mapTicketTailorEventToListingPatch(evt, opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const patch = {};
  const title = String(evt?.name || '').trim();
  if (title) patch.title = title;

  const description = String(evt?.description || '').trim();
  if (description) patch.description = description;

  const startIso = ticketTailorDateIso(evt?.start);
  const endIso = ticketTailorDateIso(evt?.end);
  if (startIso) patch.date = startIso;
  if (endIso) patch.endDate = endIso;

  const online = ticketTailorIsOnline(evt);
  patch.eventFormat = online ? 'Online' : 'In person';

  if (online) {
    const streamUrl = String(evt?.online_link || '').trim();
    if (streamUrl) patch.onlineLink = streamUrl;
  } else {
    const venue = evt?.venue && typeof evt.venue === 'object' ? evt.venue : null;
    const venueName = String(venue?.name || '').trim();
    const postcode = String(venue?.postal_code || '').trim();
    const country = String(venue?.country || '').trim();
    if (venueName) patch.venue = venueName;
    if (postcode) patch.postcode = postcode;
    if (venueName || postcode || country) {
      patch.location = [venueName, postcode, country].filter(Boolean).join(', ');
    }
  }

  if (options.includeBookingUrl !== false) {
    const listingUrl = ticketTailorPublicBookingUrl(evt);
    if (listingUrl) patch.externalBookingUrl = listingUrl;
  }

  return patch;
}

async function ticketTailorApiGet(path, apiKey) {
  const key = String(apiKey || '').trim();
  const auth = ticketTailorBasicAuthHeader(key);
  if (!auth) {
    const e = new Error('ticket_tailor_api_key_missing');
    e.status = 400;
    throw e;
  }
  const requestUrl =
    TICKET_TAILOR_API_BASE + (path.startsWith('/') ? path : '/' + path);
  const res = await fetch(requestUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: auth,
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
    const msg =
      (data && (data.message || data.error_code || data.error)) ||
      'ticket_tailor_fetch_failed_' + res.status;
    const e = new Error(msg);
    e.status = res.status === 401 || res.status === 403 ? 401 : 502;
    e.ticketTailorStatus = res.status;
    throw e;
  }
  return data;
}

async function fetchTicketTailorEvent(externalEventId, apiKey) {
  const id = String(externalEventId || '').trim();
  if (!id) {
    const e = new Error('ticket_tailor_event_id_missing');
    e.status = 400;
    throw e;
  }
  const data = await ticketTailorApiGet('/events/' + encodeURIComponent(id), apiKey);
  const evt = unwrapTicketTailorEvent(data);
  if (!evt) {
    const e = new Error('ticket_tailor_event_invalid_response');
    e.status = 502;
    throw e;
  }
  return evt;
}

function ticketTailorUrlSlugHint(rawUrl) {
  const url = String(rawUrl || '').trim();
  if (!url || !/tickettailor|ticket-tailor/i.test(url)) return '';
  try {
    const parsed = new URL(url);
    const m = parsed.pathname.match(/\/events\/([^/?#]+)/i);
    return m ? String(m[1]).trim() : '';
  } catch {
    return '';
  }
}

function ticketTailorEventMatchesBookingUrl(evt, bookingUrl, slugHint) {
  if (!evt || !bookingUrl) return false;
  const slug = String(slugHint || '').trim().toLowerCase();
  const needle = String(bookingUrl || '').trim().toLowerCase();
  const urls = [evt.url, evt.checkout_url].filter(Boolean).map((u) => String(u).toLowerCase());
  if (urls.some((u) => u === needle || (slug && u.includes('/events/' + slug)))) return true;
  if (slug) {
    return urls.some((u) => u.includes('/events/' + slug + '/') || u.endsWith('/events/' + slug));
  }
  return false;
}

/** Resolve ev_… from booking URL slug via paginated GET /v1/events (box office scope). */
async function findTicketTailorEventIdByBookingUrl(apiKey, bookingUrl, opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const url = String(bookingUrl || '').trim();
  if (!url) return '';
  const slug = ticketTailorUrlSlugHint(url);
  if (!slug) return '';

  let startingAfter = '';
  const maxPages = Math.min(Math.max(Number(options.maxPages) || 10, 1), 20);

  for (let page = 0; page < maxPages; page++) {
    const qs = new URLSearchParams({ limit: '100' });
    if (startingAfter) qs.set('starting_after', startingAfter);
    const data = await ticketTailorApiGet('/events?' + qs.toString(), apiKey);
    const list = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.events)
        ? data.events
        : Array.isArray(data)
          ? data
          : [];
    for (const row of list) {
      const evt = unwrapTicketTailorEvent(row) || row;
      if (!evt || !evt.id) continue;
      if (ticketTailorEventMatchesBookingUrl(evt, url, slug)) {
        return String(evt.id).trim();
      }
    }
    if (list.length < 100) break;
    const last = list[list.length - 1];
    const lastId = String(last?.id || '').trim();
    if (!lastId || lastId === startingAfter) break;
    startingAfter = lastId;
  }
  return '';
}

module.exports = {
  ticketTailorApiKeyFromConfig,
  ticketTailorBasicAuthHeader,
  ticketTailorIsOnline,
  ticketTailorPublicBookingUrl,
  mapTicketTailorEventToListingPatch,
  fetchTicketTailorEvent,
  findTicketTailorEventIdByBookingUrl,
  unwrapTicketTailorEvent,
  ticketTailorUrlSlugHint,
  ticketTailorEventMatchesBookingUrl,
};
