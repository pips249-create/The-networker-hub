/**
 * Organiser — list registrations / attendees for the signed-in organiser's events.
 */
const { airtableConfig, airtableFetch } = require('./auth');
const { tables: organiserTables } = require('./organiser');

function tables() {
  const t = organiserTables();
  return {
    ...t,
    registrations: process.env.AIRTABLE_REGISTRATIONS_TABLE || 'Registrations',
  };
}

const REGISTRATION_FIELDS = {
  name: ['Attendee Name', 'Name', 'Full Name', 'Buyer Name', 'Guest Name'],
  email: ['Email', 'Attendee Email', 'User Email', 'Buyer Email'],
  event: ['Event', 'Linked Event', 'Events'],
  ticketName: ['Ticket Type', 'Ticket Name', 'Tier', 'Ticket'],
  quantity: ['Quantity', 'Qty', 'Tickets'],
  registeredAt: ['Registered At', 'Registration Date', 'Created', 'Booked At', 'Date Registered'],
  phone: ['Phone', 'Mobile', 'Telephone'],
};

const EVENT_FIELDS = {
  title: ['Event Title', 'Title', 'Name'],
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

async function fetchAllRecords(table) {
  const cfg = airtableConfig();
  if (!cfg) return [];
  const records = [];
  let offset = '';
  do {
    const q = new URLSearchParams({ pageSize: '100' });
    if (offset) q.set('offset', offset);
    const resp = await airtableFetch(`${encodeURIComponent(table)}?${q}`);
    if (!resp.ok) break;
    const data = await resp.json();
    records.push(...(data.records || []));
    offset = data.offset || '';
  } while (offset);
  return records;
}

async function fetchEventTitleMap(eventIds) {
  const cfg = airtableConfig();
  if (!cfg || !eventIds.length) return {};
  const table = tables().events;
  const all = await fetchAllRecords(table);
  const wanted = new Set(eventIds);
  const map = {};
  all.forEach((rec) => {
    if (!wanted.has(rec.id)) return;
    const f = rec.fields || {};
    map[rec.id] = String(pick(f, EVENT_FIELDS.title) || 'Event').trim();
  });
  return map;
}

/**
 * @param {string[]} eventIds — organiser's event record ids
 * @param {string|null} filterEventId — optional single event id
 */
async function listAttendeesForOrganiserEvents(eventIds, filterEventId) {
  const cfg = airtableConfig();
  if (!cfg || !eventIds.length) return [];

  const allowed = new Set(eventIds);
  if (filterEventId && filterEventId !== 'all') {
    if (!allowed.has(filterEventId)) return [];
  }

  const table = tables().registrations;
  let records = [];
  try {
    records = await fetchAllRecords(table);
  } catch {
    return [];
  }

  const matched = [];
  records.forEach((rec) => {
    const f = rec.fields || {};
    const evIds = linkedRecordIds(pick(f, REGISTRATION_FIELDS.event));
    const eventId = evIds[0] || '';
    if (!eventId || !allowed.has(eventId)) return;
    if (filterEventId && filterEventId !== 'all' && eventId !== filterEventId) return;
    matched.push({ rec, eventId, fields: f });
  });

  const titleMap = await fetchEventTitleMap([...new Set(matched.map((m) => m.eventId))]);

  return matched
    .map(({ rec, eventId, fields: f }) => {
      const email = String(pick(f, REGISTRATION_FIELDS.email) || '').trim();
      const name =
        String(pick(f, REGISTRATION_FIELDS.name) || '').trim() ||
        (email ? email.split('@')[0] : 'Attendee');
      const qty = pick(f, REGISTRATION_FIELDS.quantity);
      const qtyNum = qty != null && qty !== '' ? Number(qty) || 1 : 1;
      const ticketName = String(pick(f, REGISTRATION_FIELDS.ticketName) || 'General admission').trim();
      const registeredRaw = pick(f, REGISTRATION_FIELDS.registeredAt);
      return {
        id: rec.id,
        eventId,
        eventTitle: titleMap[eventId] || 'Event',
        name,
        email,
        phone: String(pick(f, REGISTRATION_FIELDS.phone) || '').trim(),
        ticketName,
        quantity: qtyNum,
        registeredAt: registeredRaw ? String(registeredRaw) : '',
      };
    })
    .sort((a, b) => {
      const ta = a.registeredAt ? new Date(a.registeredAt).getTime() : 0;
      const tb = b.registeredAt ? new Date(b.registeredAt).getTime() : 0;
      return tb - ta;
    });
}

module.exports = {
  listAttendeesForOrganiserEvents,
};
