/**
 * Live published-event lookup for Hubert.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { fetchApprovedEvents } = require('./supabase-events');

const EVENT_INTENT =
  /\b(event|events|networking|exhibition|conferences?|meetings?|happening|upcoming|this week|next week|tonight|tomorrow|weekend|find|browse|search|near|in\s+[a-z]|free event)\b/i;

const LOCATION_IN = /\b(?:in|near|around|at)\s+([a-z][a-z\s'-]{1,40})/i;

const UK_LOCATIONS = [
  'london',
  'manchester',
  'birmingham',
  'leeds',
  'glasgow',
  'liverpool',
  'bristol',
  'sheffield',
  'edinburgh',
  'cardiff',
  'belfast',
  'newcastle',
  'nottingham',
  'leicester',
  'cambridge',
  'oxford',
  'huntingdon',
  'peterborough',
  'milton keynes',
  'reading',
  'southampton',
  'brighton',
  'york',
  'norwich',
  'coventry',
  'aberdeen',
  'dundee',
  'swansea',
  'exeter',
  'plymouth',
  'bath',
  'cheltenham',
  'hull',
  'stoke',
  'wolverhampton',
  'derby',
  'middlesbrough',
  'sunderland',
  'bolton',
  'stockport',
  'warrington',
  'oldham',
  'rochdale',
  'salford',
  'wigan',
  'preston',
  'blackpool',
  'lancaster',
  'chester',
  'wrexham',
  'swindon',
  'ipswich',
  'luton',
  'northampton',
  'poole',
  'bournemouth',
  'guildford',
  'woking',
  'watford',
  'st albans',
  'harrogate',
  'scotland',
  'wales',
  'online',
];

function wantsEventSearch(text) {
  return EVENT_INTENT.test(String(text || ''));
}

function normalizeLocation(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function detectLocation(text) {
  const raw = String(text || '');
  const match = raw.match(LOCATION_IN);
  if (match) {
    const candidate = normalizeLocation(match[1]);
    const known = UK_LOCATIONS.find(function (loc) {
      return candidate.includes(loc) || loc.includes(candidate);
    });
    if (known) return known;
    if (candidate.length >= 3) return candidate;
  }

  const lower = raw.toLowerCase();
  for (var i = 0; i < UK_LOCATIONS.length; i++) {
    if (lower.includes(UK_LOCATIONS[i])) return UK_LOCATIONS[i];
  }
  return '';
}

function parseDateWindow(text) {
  const lower = String(text || '').toLowerCase();
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (/\btonight\b|\btoday\b/.test(lower)) {
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { from: start.getTime(), to: end.getTime() };
  }

  if (/\btomorrow\b/.test(lower)) {
    const from = new Date(start);
    from.setDate(from.getDate() + 1);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return { from: from.getTime(), to: to.getTime() };
  }

  if (/\bthis week\b|\bthis weekend\b/.test(lower)) {
    const end = new Date(start);
    const day = end.getDay();
    const daysUntilSunday = day === 0 ? 0 : 7 - day;
    end.setDate(end.getDate() + daysUntilSunday + 1);
    return { from: start.getTime(), to: end.getTime() };
  }

  if (/\bnext week\b/.test(lower)) {
    const from = new Date(start);
    const day = from.getDay();
    from.setDate(from.getDate() + (day === 0 ? 1 : 8 - day));
    const to = new Date(from);
    to.setDate(to.getDate() + 7);
    return { from: from.getTime(), to: to.getTime() };
  }

  return { from: start.getTime(), to: null };
}

function eventWhenTs(event) {
  const ts = event.nextDateTs != null ? event.nextDateTs : event.dateTs;
  return typeof ts === 'number' && !Number.isNaN(ts) ? ts : null;
}

function eventHaystack(event) {
  return [
    event.title,
    event.city,
    event.location,
    event.locationShort,
    event.venue,
    event.postcode,
    event.outcode,
    event.organiser,
    event.eventType,
    event.industry,
    event.format,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function scoreEvent(event, query) {
  let score = 0;
  const haystack = eventHaystack(event);
  const title = String(event.title || '').toLowerCase();
  const location = query.location;

  if (location && haystack.includes(location)) score += 8;
  if (query.freeOnly && event.priceKey === 'free') score += 4;
  if (/\bfeatured\b/i.test(query.text) && event.featured) score += 3;

  const words = String(query.text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(function (w) {
      return w.length >= 4 && !/^(event|events|find|show|what|where|near|this|next|week|with)$/.test(w);
    });

  words.forEach(function (word) {
    if (title.includes(word)) score += 5;
    else if (haystack.includes(word)) score += 2;
  });

  const when = eventWhenTs(event);
  if (when != null) {
    if (query.window.from != null && when < query.window.from) return -1;
    if (query.window.to != null && when >= query.window.to) return -1;
    score += 1;
  }

  return score;
}

function compactEventLine(event) {
  const bits = [
    event.title,
    event.dateLine || event.date,
    event.city || event.locationShort || event.location,
    event.price,
    '/events/' + event.slug,
  ].filter(Boolean);
  return '- ' + bits.join(' | ');
}

async function searchEventsForHubert(userMessage, limit) {
  const text = String(userMessage || '').trim();
  if (!text || !wantsEventSearch(text)) {
    return { events: [], query: null };
  }

  if (!isSupabaseConfigured()) {
    return { events: [], query: { text: text, configured: false } };
  }

  const query = {
    text: text,
    location: detectLocation(text),
    window: parseDateWindow(text),
    freeOnly: /\bfree\b/i.test(text),
    configured: true,
  };

  const all = await fetchApprovedEvents(getSupabaseAdmin());
  const now = Date.now() - 12 * 60 * 60 * 1000;

  const ranked = (all || [])
    .map(function (event) {
      const when = eventWhenTs(event);
      if (when != null && when < now && !query.window.to) return null;
      const score = scoreEvent(event, query);
      if (score < 0) return null;
      return { event: event, score: score };
    })
    .filter(Boolean)
    .sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return (eventWhenTs(a.event) || 0) - (eventWhenTs(b.event) || 0);
    });

  const max = Math.min(Math.max(limit || 6, 1), 8);
  const hasSignal = query.location || query.freeOnly || ranked.some(function (r) {
    return r.score > 0;
  });

  let events;
  if (hasSignal) {
    events = ranked
      .filter(function (r) {
        return r.score > 0 || (!query.location && !query.freeOnly);
      })
      .slice(0, max)
      .map(function (r) {
        return r.event;
      });
  } else {
    events = (all || [])
      .filter(function (event) {
        const when = eventWhenTs(event);
        return when == null || when >= now;
      })
      .sort(function (a, b) {
        return (eventWhenTs(a) || 0) - (eventWhenTs(b) || 0);
      })
      .slice(0, max);
  }

  return { events: events, query: query };
}

function buildEventContextBlock(result) {
  const events = (result && result.events) || [];
  const query = result && result.query;

  if (query && query.configured === false) {
    return (
      'LIVE EVENT LOOKUP: Event database is not configured in this environment. ' +
      'Do not invent specific events — suggest browsing /events/.'
    );
  }

  if (!events.length) {
    const locationHint = query && query.location ? ' near ' + query.location : '';
    return (
      'LIVE EVENT LOOKUP: No matching upcoming published events found' +
      locationHint +
      '. Tell the user honestly, suggest broadening the search or browsing /events/, and do not invent listings.'
    );
  }

  return (
    'LIVE EVENT LOOKUP — cite only these real published events (title, date, location, price, link). Do not invent others:\n' +
    events.map(compactEventLine).join('\n')
  );
}

function formatEventFallbackReply(result) {
  const events = (result && result.events) || [];
  const query = result && result.query;

  if (!events.length) {
    const locationHint = query && query.location ? ' in ' + query.location : '';
    return (
      "I couldn't find upcoming events matching that" +
      locationHint +
      ' right now. Browse everything at /events/ or try a different city or date.'
    );
  }

  const lines = events.map(function (event) {
    return (
      '• ' +
      event.title +
      ' — ' +
      (event.dateLine || event.date || 'Date TBC') +
      (event.city || event.locationShort ? ' · ' + (event.city || event.locationShort) : '') +
      ' · ' +
      event.price +
      ' · /events/' +
      event.slug
    );
  });

  return (
    'Here are some upcoming events that might help:\n\n' +
    lines.join('\n') +
    '\n\nSee all listings at /events/.'
  );
}

module.exports = {
  wantsEventSearch,
  searchEventsForHubert,
  buildEventContextBlock,
  formatEventFallbackReply,
};
