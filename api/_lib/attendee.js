/**
 * Attendee dashboard — registrations / bookings for signed-in user.
 */
const {
  airtableConfig,
  airtableFetch,
  escapeFormulaValue,
  findUserByEmail,
} = require('./auth');
const { buildReviewerReward } = require('./reviewer-reward');

const REGISTRATION_FIELDS = {
  email: ['Email', 'Attendee Email', 'User Email', 'Buyer Email'],
  event: ['Event', 'Linked Event', 'Events'],
  ticketName: ['Ticket Type', 'Ticket Name', 'Tier', 'Ticket'],
  quantity: ['Quantity', 'Qty', 'Tickets'],
  reviewStatus: ['Review Status', 'Reviewed', 'Review Left'],
  reviewRating: ['Rating', 'Review Rating', 'Stars'],
};

const EVENT_FIELDS = {
  title: ['Event Title', 'Title', 'Name'],
  date: ['Date & Time', 'Date', 'Event Date', 'Start Date'],
  endDate: ['End Date', 'End Time', 'End Date & Time'],
  image: ['Photo', 'Image', 'Cover', 'Event Photo', 'Event Image'],
};

function pick(fields, keys) {
  for (const key of keys) {
    if (fields[key] !== undefined && fields[key] !== null && fields[key] !== '') {
      return fields[key];
    }
  }
  const lowerKeys = keys.map((k) => String(k).toLowerCase());
  for (const fk of Object.keys(fields || {})) {
    if (lowerKeys.includes(fk.toLowerCase())) {
      const v = fields[fk];
      if (v !== undefined && v !== null && v !== '') return v;
    }
  }
  return null;
}

function linkedRecordIds(field) {
  if (!field) return [];
  if (Array.isArray(field)) return field.filter((id) => typeof id === 'string');
  return [];
}

function attachmentUrl(field) {
  if (!field) return null;
  if (Array.isArray(field) && field[0]) {
    const file = field[0];
    return file.thumbnails?.large?.url || file.thumbnails?.full?.url || file.url || null;
  }
  if (typeof field === 'string' && field.startsWith('http')) return field;
  return null;
}

async function fetchAllRecords(table, view) {
  const cfg = airtableConfig();
  if (!cfg) return [];
  const records = [];
  let offset = '';
  do {
    const q = new URLSearchParams({ pageSize: '100' });
    if (view) q.set('view', view);
    if (offset) q.set('offset', offset);
    const resp = await airtableFetch(`${encodeURIComponent(table)}?${q}`);
    if (!resp.ok) break;
    const data = await resp.json();
    records.push(...(data.records || []));
    offset = data.offset || '';
  } while (offset);
  return records;
}

function tables() {
  return {
    events: process.env.AIRTABLE_EVENTS_TABLE || 'Events',
    registrations: process.env.AIRTABLE_REGISTRATIONS_TABLE || 'Registrations',
  };
}

async function fetchEventMap(eventIds) {
  const cfg = airtableConfig();
  if (!cfg || !eventIds.length) return {};
  const table = tables().events;
  const all = await fetchAllRecords(table);
  const wanted = new Set(eventIds);
  const map = {};
  all.forEach((rec) => {
    if (!wanted.has(rec.id)) return;
    const f = rec.fields || {};
    map[rec.id] = {
      id: rec.id,
      title: String(pick(f, EVENT_FIELDS.title) || 'Event').trim(),
      date: pick(f, EVENT_FIELDS.date) ? String(pick(f, EVENT_FIELDS.date)) : '',
      endDate: pick(f, EVENT_FIELDS.endDate) ? String(pick(f, EVENT_FIELDS.endDate)) : '',
      imageUrl: attachmentUrl(pick(f, EVENT_FIELDS.image)),
    };
  });
  return map;
}

function deriveReviewStatus(raw, eventDate) {
  const s = String(raw || '').toLowerCase();
  if (/reviewed|left|complete|done|yes/.test(s)) return 'reviewed';
  if (/pending|await|need/.test(s)) return 'pending';
  const d = eventDate ? new Date(eventDate) : null;
  if (d && !Number.isNaN(d.getTime()) && d < new Date()) return 'pending';
  return 'upcoming';
}

async function listRegistrationsForEmail(email) {
  const cfg = airtableConfig();
  if (!cfg) return [];
  const table = tables().registrations;
  const emailLower = email.toLowerCase();
  let records = [];
  try {
    const emailField = REGISTRATION_FIELDS.email[0];
    const formula = `{${emailField}}='${escapeFormulaValue(emailLower)}'`;
    const q = new URLSearchParams({ filterByFormula: formula, pageSize: '100' });
    const resp = await airtableFetch(`${encodeURIComponent(table)}?${q}`);
    if (resp.ok) {
      const data = await resp.json();
      records = data.records || [];
    }
  } catch {
    /* fall through */
  }
  if (!records.length) {
    try {
      records = await fetchAllRecords(table);
      records = records.filter((rec) => {
        const em = String(pick(rec.fields, REGISTRATION_FIELDS.email) || '').toLowerCase();
        return em === emailLower;
      });
    } catch {
      return [];
    }
  }

  const eventIds = [];
  records.forEach((rec) => {
    linkedRecordIds(pick(rec.fields, REGISTRATION_FIELDS.event)).forEach((id) => eventIds.push(id));
  });
  const eventMap = await fetchEventMap([...new Set(eventIds)]);

  return records
    .map((rec) => {
      const f = rec.fields || {};
      const evIds = linkedRecordIds(pick(f, REGISTRATION_FIELDS.event));
      const eventId = evIds[0] || '';
      const ev = eventMap[eventId] || {};
      const qty = pick(f, REGISTRATION_FIELDS.quantity);
      const ticketName = String(pick(f, REGISTRATION_FIELDS.ticketName) || 'General Admission').trim();
      const qtyNum = qty != null && qty !== '' ? Number(qty) || 1 : 1;
      const reviewStatus = deriveReviewStatus(pick(f, REGISTRATION_FIELDS.reviewStatus), ev.date);
      return {
        id: rec.id,
        eventId,
        title: ev.title || 'Event',
        date: ev.date || '',
        endDate: ev.endDate || '',
        imageUrl: ev.imageUrl || null,
        ticketLabel: qtyNum + ' × ' + ticketName,
        reviewStatus,
        rating: pick(f, REGISTRATION_FIELDS.reviewRating),
      };
    })
    .filter((r) => r.eventId || r.title);
}

function buildStats(registrations) {
  const now = new Date();
  const upcoming = registrations.filter((r) => {
    const d = r.date ? new Date(r.date) : null;
    return d && !Number.isNaN(d.getTime()) && d >= now;
  });
  const past = registrations.filter((r) => {
    const d = r.date ? new Date(r.date) : null;
    return d && !Number.isNaN(d.getTime()) && d < now;
  });
  const reviewsLeft = past.filter((r) => r.reviewStatus === 'reviewed').length;
  const reviewsPending = past.filter((r) => r.reviewStatus === 'pending').length;
  const next = upcoming
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  return {
    upcomingCount: upcoming.length,
    reviewsLeft,
    reviewsPending,
    nextEventDate: next ? next.date : '',
    reviewerReward: buildReviewerReward(reviewsLeft),
  };
}

async function getAttendeeDashboard(email) {
  const user = await findUserByEmail(email);
  let registrations = [];
  try {
    registrations = await listRegistrationsForEmail(email);
  } catch {
    registrations = [];
  }
  const stats = buildStats(registrations);
  return {
    user: {
      email,
      name: user?.name || '',
    },
    registrations,
    stats,
  };
}

module.exports = {
  getAttendeeDashboard,
  listRegistrationsForEmail,
  buildStats,
};
