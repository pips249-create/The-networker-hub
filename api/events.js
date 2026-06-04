/**
 * Vercel serverless: proxy Airtable Events table (keeps API key server-side).
 *
 * Env (Vercel → Settings → Environment Variables):
 *   AIRTABLE_API_KEY
 *   AIRTABLE_BASE_ID
 *   AIRTABLE_EVENTS_TABLE  (default: Events)
 *   AIRTABLE_TICKETS_TABLE (default: Tickets)
 */

const { cleanEnvVal, parseAirtableError } = require('./lib/auth');

const FIELD_MAP = {
  title: ['Event Title', 'Title', 'Name'],
  description: ['Highlights', 'Description', 'Short Description', 'Summary', 'About'],
  date: [
    'Date & Time',
    'Date',
    'Event Date',
    'Start Date',
    'Start',
    'When',
    'Event Start',
    'Meeting Date',
    'Event date',
    'Start date',
    'Date of event',
    'Event Date & Time',
    'Start Date/Time',
    'Date/Time',
    'Day',
  ],
  time: ['Time', 'Start Time', 'Event Time', 'Start time', 'From'],
  price: ['Ticket Price', 'Price'],
  location: ['Location', 'City', 'Venue'],
  postcode: ['Postcode', 'Postal Code', 'ZIP', 'Zip Code'],
  venue: ['Venue', 'Venue Name', 'Address'],
  industry: ['Industry'],
  format: ['Meeting Format', 'Format', 'Meeting Type'],
  type: ['Meeting Type', 'Type', 'Event Type'],
  latitude: ['Latitude', 'Lat'],
  longitude: ['Longitude', 'Lng', 'Long'],
  featured: ['Featured', 'Premium', 'Premium Spotlight'],
  photo: ['Photo', 'Image', 'Cover', 'Photos', 'Picture', 'Event Photo', 'Event Image'],
  organiser: ['Host/Organizer', 'Host/Organiser', 'Organiser', 'Host', 'Organizer', 'Organiser Name'],
  organiserId: ['Organiser ID', 'OrganiserId', 'Host ID', 'Organizer ID'],
  organiserLogo: [
    'Organiser Logo',
    'Host Logo',
    'Organiser Photo',
    'Organiser Image',
    'Company Logo',
    'Logo',
  ],
  organiserProfile: [
    'Company Profile',
    'Organiser Profile',
    'Organiser Description',
    'Company Description',
    'Host Bio',
    'About Organiser',
    'Organiser Bio',
  ],
  address: ['Address', 'Venue Address', 'Full Address', 'Address Line 1', 'Street'],
  rating: ['Average Rating', 'Rating', 'Stars'],
  reviews: ['Review Count', 'Reviews', 'Number of Reviews'],
  approvalRequired: [
    'Approval Required',
    'Seat Approval',
    'Requires Approval',
    'One Seat Policy',
    'Seat Approval Required',
  ],
  approvalStatus: ['Approval Status'],
  soldOut: ['Sold Out', 'Is Sold Out'],
  salesClosed: ['Sales Closed', 'Registration Closed', 'Tickets Closed'],
  capacity: ['Capacity', 'Max Attendees', 'Ticket Qty', 'Ticket Quantity', 'Max Capacity'],
  spotsLeft: ['Spots Left', 'Tickets Remaining', 'Remaining Spots', 'Spots Remaining'],
  registrations: ['Registrations', 'All Registrations'],
};

const TICKET_FIELD_MAP = {
  linkedEvent: ['Linked Event', 'Event', 'Events', 'Linked Events'],
  name: ['Ticket Name', 'Name', 'Tier Name', 'Ticket Type', 'Type', 'Tier'],
  description: ['Ticket Description', 'Description'],
  price: ['Price', 'Ticket Price', 'Amount', 'Cost'],
  quantityAvailable: ['Quantity Available', 'Quantity', 'Capacity', 'Qty Available'],
  soldOut: ['Sold Out', 'Is Sold Out', 'Status', 'Ticket Status', 'Availability'],
};

function getFieldCI(fields, name) {
  if (!fields || !name) return undefined;
  if (fields[name] !== undefined) return fields[name];
  const lower = String(name).toLowerCase();
  const key = fieldKeys(fields).find((k) => k.toLowerCase() === lower);
  return key !== undefined ? fields[key] : undefined;
}

function pick(fields, keys) {
  for (const key of keys) {
    const v = getFieldCI(fields, key);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

function fieldKeys(fields) {
  return Object.keys(fields || {});
}

/** Match Airtable columns when names differ from our defaults (e.g. "Event date", "Start date/time"). */
function discoverField(fields, aliases, options = {}) {
  const hit = pick(fields, aliases);
  if (hit !== null && hit !== undefined && hit !== '') return hit;

  const namePattern = options.namePattern || /./;
  const excludePattern =
    options.excludePattern ||
    /created|modified|updated|expir|token|password|hash|sold|review|rating|count/i;

  for (const key of fieldKeys(fields)) {
    if (excludePattern.test(key)) continue;
    if (!namePattern.test(key)) continue;
    const v = fields[key];
    if (v !== undefined && v !== null && v !== '') return v;
  }

  if (options.valueTest) {
    for (const key of fieldKeys(fields)) {
      if (excludePattern.test(key)) continue;
      const v = fields[key];
      if (options.valueTest(v)) return v;
    }
  }

  return null;
}

function looksLikeDateValue(v) {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'object') {
    if (v.iso) return true;
    if (Array.isArray(v) && v[0]) return looksLikeDateValue(v[0]);
    return false;
  }
  const s = String(v).trim();
  if (s.length < 6) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
  if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/.test(s)) return true;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

function discoverDateField(fields) {
  return discoverField(
    fields,
    FIELD_MAP.date,
    {
      namePattern: /date|when|start|begins?|scheduled|held\s*on|event\s*day/i,
      excludePattern:
        /created|modified|updated|expir|token|end\s*date|closing|deadline|sold|review|rating/i,
      valueTest: looksLikeDateValue,
    }
  );
}

function discoverTimeField(fields) {
  return discoverField(fields, FIELD_MAP.time, {
    namePattern: /time|start\s*time|from|doors/i,
    excludePattern: /created|modified|updated|expir|token|date|sold|review/i,
  });
}

function attachmentUrl(field) {
  if (!field) return null;
  if (Array.isArray(field) && field[0]) {
    const file = field[0];
    return (
      file.thumbnails?.large?.url ||
      file.thumbnails?.full?.url ||
      file.url ||
      null
    );
  }
  if (typeof field === 'string' && field.startsWith('http')) return field;
  return null;
}

function typeSlugFromRaw(raw) {
  return (
    String(raw || 'meeting')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'meeting'
  );
}

function parseTypeCategory(raw) {
  const s = String(raw || 'meeting').toLowerCase();
  if (s.includes('award')) return 'awards';
  if (s.includes('exhibit')) return 'exhibition';
  if (s.includes('conference')) return 'conference';
  if (s.includes('meeting') || s.includes('network') || s.includes('mixer')) return 'meeting';
  return 'meeting';
}

/** Legacy bucket for tabs: meeting vs exhibition */
function slugifyType(raw) {
  const cat = parseTypeCategory(raw);
  if (cat === 'exhibition' || cat === 'conference') return 'exhibition';
  return 'meeting';
}

function normalizePrice(raw) {
  if (raw === null || raw === undefined || raw === '') return { display: 'Free', priceKey: 'free' };
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  if (!n || String(raw).toLowerCase().includes('free')) {
    return { display: 'Free', priceKey: 'free' };
  }
  const num = Number.isFinite(n) ? n : parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  if (!num) return { display: String(raw), priceKey: 'paid' };
  return { display: `£${num % 1 === 0 ? num.toFixed(0) : num.toFixed(2)}`, priceKey: 'paid' };
}

function slugLocation(loc) {
  if (!loc) return '';
  const s = String(loc).toLowerCase();
  if (s.includes('online')) return 'online';
  const cities = ['london', 'manchester', 'birmingham', 'cambridge', 'leeds', 'bristol', 'edinburgh'];
  for (const c of cities) {
    if (s.includes(c)) return c;
  }
  return s.replace(/[^a-z0-9]+/g, '-').slice(0, 40);
}

function slugIndustry(ind) {
  if (!ind) return '';
  return String(ind).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
}

function slugFormat(fmt) {
  if (!fmt) return '';
  const s = String(fmt).toLowerCase();
  if (s.includes('online') && !s.includes('person')) return 'online';
  if (s.includes('hybrid')) return 'hybrid';
  if (s.includes('person') || s.includes('in-person')) return 'in-person';
  return s.replace(/[^a-z0-9]+/g, '-').slice(0, 20);
}

const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;

function extractUkPostcode(...parts) {
  for (const part of parts) {
    if (!part) continue;
    const m = String(part).match(UK_POSTCODE_RE);
    if (m) return m[1].replace(/\s+/g, ' ').trim().toUpperCase();
  }
  return '';
}

/** Outcode sector for fast listing filter (e.g. M1, SW1A → SW1). */
function parseOutcode(raw) {
  if (!raw) return '';
  const compact = String(raw).trim().toUpperCase().replace(/\s+/g, '');
  const m = compact.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/);
  return m ? m[1] : '';
}

/** Parse Airtable date values (ISO, US, UK, locale strings). */
function parseAirtableDate(raw) {
  if (raw === null || raw === undefined || raw === '') {
    return { iso: '', ts: null, display: '', short: '' };
  }

  if (typeof raw === 'object' && raw !== null) {
    if (raw.iso) return parseAirtableDate(raw.iso);
    if (Array.isArray(raw) && raw[0]) return parseAirtableDate(raw[0]);
  }

  const s = String(raw).trim();

  const uk = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (uk) {
    let d = parseInt(uk[1], 10);
    let m = parseInt(uk[2], 10) - 1;
    let y = parseInt(uk[3], 10);
    if (y < 100) y += 2000;
    if (d > 12 && m < 12) {
      /* likely DD/MM/YYYY */
    } else if (d <= 12 && m + 1 > 12) {
      const tmp = d;
      d = m + 1;
      m = tmp - 1;
    }
    const dt = new Date(y, m, d, 12, 0, 0, 0);
    if (!Number.isNaN(dt.getTime())) {
      return packDate(dt, s);
    }
  }

  const isoDay = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDay) {
    const dt = new Date(
      parseInt(isoDay[1], 10),
      parseInt(isoDay[2], 10) - 1,
      parseInt(isoDay[3], 10),
      12,
      0,
      0,
      0
    );
    if (!Number.isNaN(dt.getTime())) return packDate(dt, s);
  }

  const isoDateTime = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (isoDateTime) {
    const dt = new Date(s);
    if (!Number.isNaN(dt.getTime())) return packDate(dt, s);
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return packDate(d, s);

  return { iso: '', ts: null, display: s, short: s };
}

function packDate(dt, fallback) {
  const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  return {
    iso,
    ts: dt.getTime(),
    display: dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    short: dt.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }),
    raw: fallback,
  };
}

function formatDate(isoOrStr) {
  const p = parseAirtableDate(isoOrStr);
  return p.display || (isoOrStr ? String(isoOrStr) : '');
}

function formatDateShort(isoOrStr) {
  const p = parseAirtableDate(isoOrStr);
  return p.short || '';
}

function linkedRecordId(field) {
  const ids = linkedRecordIds(field);
  return ids[0] || '';
}

function linkedRecordIds(field) {
  if (!field) return [];
  if (Array.isArray(field)) {
    return field
      .map((item) => {
        if (typeof item === 'string' && /^rec[a-zA-Z0-9]+$/i.test(item)) return item;
        if (item && typeof item === 'object' && item.id) return String(item.id);
        return '';
      })
      .filter(Boolean);
  }
  if (typeof field === 'string' && /^rec[a-zA-Z0-9]+$/i.test(field)) return [field];
  return [];
}

function ticketLinksToEvent(fields, eventId) {
  const linked = pick(fields, TICKET_FIELD_MAP.linkedEvent);
  return linkedRecordIds(linked).includes(eventId);
}

function tierLabelFromRaw(raw) {
  if (raw == null || raw === '') return '';
  if (Array.isArray(raw)) {
    const parts = raw
      .map((x) => (typeof x === 'string' ? x : x && x.name ? String(x.name) : ''))
      .filter(Boolean);
    return parts.join(', ').trim();
  }
  return String(raw).trim();
}

function parseTicketStatusSoldOut(statusRaw) {
  if (statusRaw == null || statusRaw === '') return false;
  if (Array.isArray(statusRaw)) {
    return statusRaw.some((s) => parseTicketStatusSoldOut(s));
  }
  const s = String(statusRaw).toLowerCase();
  if (/sold\s*out|closed|unavailable|full|ended|cancelled|waitlist\s*full/.test(s)) {
    return true;
  }
  if (/available|open|active|on\s*sale|published|live/.test(s)) {
    return false;
  }
  return parseBoolField(statusRaw);
}

function ticketRecordToTier(record, eventDefaults = {}) {
  const f = record.fields || {};
  const priceRaw =
    pick(f, TICKET_FIELD_MAP.price) ??
    eventDefaults.priceRaw ??
    (eventDefaults.priceNum > 0 ? eventDefaults.priceNum : null);
  const priceNum = parsePriceNum(priceRaw);
  const { display: price, priceKey } = normalizePrice(
    priceRaw != null && priceRaw !== '' ? priceRaw : eventDefaults.price || 'Free'
  );
  const qtyRaw = pick(f, TICKET_FIELD_MAP.quantityAvailable);
  let quantityAvailable = null;
  if (qtyRaw != null && qtyRaw !== '') {
    const n = Number(qtyRaw);
    if (Number.isFinite(n)) quantityAvailable = Math.max(0, Math.round(n));
  }
  const soldOutCheckbox = parseBoolField(
    pick(f, ['Sold Out', 'Is Sold Out'])
  );
  const statusRaw = pick(f, ['Status', 'Ticket Status', 'Availability']);
  const soldOut =
    soldOutCheckbox ||
    parseTicketStatusSoldOut(statusRaw) ||
    (quantityAvailable !== null && quantityAvailable <= 0);
  const name = tierLabelFromRaw(pick(f, TICKET_FIELD_MAP.name)) || 'Ticket';
  const description = pick(f, TICKET_FIELD_MAP.description) || '';

  return {
    id: record.id,
    name,
    description: String(description).trim(),
    price,
    priceKey,
    priceNum,
    soldOut,
    quantityAvailable,
    label: name.slice(0, 48) || 'Ticket',
  };
}

function sortTicketTiers(tickets) {
  return tickets.slice().sort((a, b) => {
    if (a.soldOut !== b.soldOut) return a.soldOut ? 1 : -1;
    return a.priceNum - b.priceNum;
  });
}

/** Index ticket rows by event id (forward link on Tickets + reverse link on Events). */
function buildTicketLinkIndexes(ticketRecords, eventRecords) {
  const eventIdSet = new Set((eventRecords || []).map((r) => r.id));
  const ticketIdSet = new Set((ticketRecords || []).map((r) => r.id));
  const byEventId = new Map();
  const ticketLinkKeyCounts = new Map();
  const eventLinkKeyCounts = new Map();

  function addTicketToEvent(eventId, ticketRec) {
    if (!eventIdSet.has(eventId)) return;
    if (!byEventId.has(eventId)) byEventId.set(eventId, []);
    const list = byEventId.get(eventId);
    if (!list.some((r) => r.id === ticketRec.id)) list.push(ticketRec);
  }

  for (const rec of ticketRecords || []) {
    const f = rec.fields || {};
    for (const key of fieldKeys(f)) {
      const ids = linkedRecordIds(f[key]).filter((id) => eventIdSet.has(id));
      if (!ids.length) continue;
      ticketLinkKeyCounts.set(key, (ticketLinkKeyCounts.get(key) || 0) + ids.length);
      ids.forEach((eid) => addTicketToEvent(eid, rec));
    }
  }

  for (const evRec of eventRecords || []) {
    const f = evRec.fields || {};
    for (const key of fieldKeys(f)) {
      if (/registration|review|host|organis|organiz|attendee/i.test(key)) continue;
      const ids = linkedRecordIds(f[key]).filter((id) => ticketIdSet.has(id));
      if (!ids.length) continue;
      eventLinkKeyCounts.set(key, (eventLinkKeyCounts.get(key) || 0) + ids.length);
      const ticketRecs = (ticketRecords || []).filter((r) => ids.includes(r.id));
      ticketRecs.forEach((t) => addTicketToEvent(evRec.id, t));
    }
  }

  let ticketLinkField = null;
  let ticketLinkBest = 0;
  for (const [key, count] of ticketLinkKeyCounts) {
    if (count > ticketLinkBest) {
      ticketLinkBest = count;
      ticketLinkField = key;
    }
  }

  let eventTicketField = null;
  let eventLinkBest = 0;
  for (const [key, count] of eventLinkKeyCounts) {
    if (count > eventLinkBest) {
      eventLinkBest = count;
      eventTicketField = key;
    }
  }

  let linkedTicketRows = 0;
  for (const list of byEventId.values()) linkedTicketRows += list.length;

  return {
    byEventId,
    ticketLinkField,
    eventTicketField,
    linkedTicketRows,
  };
}

function unionFieldNames(records) {
  const keys = new Set();
  for (const rec of records || []) {
    fieldKeys(rec.fields || {}).forEach((k) => keys.add(k));
  }
  return [...keys].sort();
}

function ticketsForEventFromIndex(eventId, linkIndexes, eventDefaults) {
  const linked = linkIndexes?.byEventId?.get(eventId) || [];
  return sortTicketTiers(linked.map((rec) => ticketRecordToTier(rec, eventDefaults)));
}

function fallbackTicketTier(event) {
  return {
    id: event.id + '-standard',
    name: 'Standard ticket',
    description:
      event.priceKey === 'free' ? 'Free admission' : 'Ticket includes full event access',
    price: event.price,
    priceKey: event.priceKey,
    priceNum: event.priceNum,
    soldOut: Boolean(event.isSoldOut),
    quantityAvailable: event.spotsLeft,
    label: 'Standard',
  };
}

function applyTicketsToEvent(event, ticketRecords, linkIndexes, eventRecord) {
  const eventDefaults = {
    priceRaw: pick(eventRecord?.fields || {}, FIELD_MAP.price),
    price: event.price,
    priceKey: event.priceKey,
    priceNum: event.priceNum,
  };
  const tickets = linkIndexes
    ? ticketsForEventFromIndex(event.id, linkIndexes, eventDefaults)
    : sortTicketTiers(
        ticketRecords
          .filter((rec) => ticketLinksToEvent(rec.fields || {}, event.id))
          .map((rec) => ticketRecordToTier(rec, eventDefaults))
      );
  event.tickets = tickets.length ? tickets : [fallbackTicketTier(event)];

  const available = event.tickets.filter((t) => !t.soldOut);
  const priceSource = available.length ? available : event.tickets;
  const minTier = priceSource.reduce(
    (min, t) => (t.priceNum < min.priceNum ? t : min),
    priceSource[0]
  );
  event.priceNum = minTier.priceNum;
  event.price = minTier.price;
  event.priceKey = minTier.priceKey;

  const qtys = available
    .map((t) => t.quantityAvailable)
    .filter((n) => n != null);
  if (qtys.length) {
    const total = qtys.reduce((sum, n) => sum + n, 0);
    event.spotsLeft = total;
    event.urgency = total > 0 ? total + ' spots left' : 'Sold out';
    if (total <= 0) event.isSoldOut = true;
  } else if (!available.length && event.tickets.length) {
    event.isSoldOut = true;
    event.urgency = 'Sold out';
  }

  return event;
}

async function fetchTicketsTableRecords(apiKey, baseId) {
  const table = process.env.AIRTABLE_TICKETS_TABLE || 'Tickets';
  const ticketsUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`;
  try {
    return await fetchAllAirtableRecords(
      ticketsUrl,
      apiKey,
      process.env.AIRTABLE_TICKETS_VIEW
    );
  } catch (e) {
    console.error('tickets_table_fetch', e.message);
    return [];
  }
}

function attachTicketsToEvents(events, ticketRecords, eventRecords) {
  const linkIndexes = buildTicketLinkIndexes(ticketRecords, eventRecords);
  return events.map((ev, i) =>
    applyTicketsToEvent(ev, ticketRecords, linkIndexes, eventRecords?.[i])
  );
}

function pickOrganiserName(fields) {
  const raw = pick(fields, FIELD_MAP.organiser);
  if (!raw) return pickOrganiserNameFromLookups(fields);
  if (typeof raw === 'string') {
    if (/^rec[a-zA-Z0-9]+$/i.test(raw)) return pickOrganiserNameFromLookups(fields);
    return raw.trim();
  }
  if (Array.isArray(raw)) {
    const names = raw
      .map((x) => (typeof x === 'string' && !/^rec[a-zA-Z0-9]+$/i.test(x) ? x : ''))
      .filter(Boolean);
    if (names.length) return names.join(', ');
    return pickOrganiserNameFromLookups(fields);
  }
  return pickOrganiserNameFromLookups(fields);
}

/** Airtable lookup fields e.g. "Name (from Host/Organizer)". */
function pickOrganiserNameFromLookups(fields) {
  for (const key of fieldKeys(fields)) {
    if (!/host|organis|organiz/i.test(key)) continue;
    if (/logo|photo|email|profile|bio|description|approved|status|registration|review/i.test(key)) {
      continue;
    }
    const v = fields[key];
    if (typeof v === 'string' && v.trim() && !/^rec[a-zA-Z0-9]+$/i.test(v)) return v.trim();
    if (Array.isArray(v)) {
      const names = v
        .map((x) => (typeof x === 'string' && !/^rec[a-zA-Z0-9]+$/i.test(x) ? x.trim() : ''))
        .filter(Boolean);
      if (names.length) return names.join(', ');
    }
  }
  return '';
}

const ORGANISER_PROFILE_MAP = {
  name: [
    'Name',
    'Organiser Name',
    'Organizer Name',
    'Company Name',
    'Business Name',
    'Host Name',
    'Title',
  ],
  profile: [
    'Company Profile',
    'Profile',
    'Description',
    'About',
    'Bio',
    'Organiser Description',
    'Company Description',
  ],
  logo: ['Logo', 'Photo', 'Company Logo', 'Organiser Logo', 'Organizer Logo', 'Image'],
};

function mapOrganiserAirtableRecord(record) {
  const f = record?.fields || {};
  const name = pick(f, ORGANISER_PROFILE_MAP.name) || '';
  const profile = pick(f, ORGANISER_PROFILE_MAP.profile) || '';
  const logo = attachmentUrl(pick(f, ORGANISER_PROFILE_MAP.logo));
  return {
    organiser: String(name).trim(),
    organiserProfile: String(profile).trim(),
    organiserLogo: logo,
  };
}

let cachedOrganiserTableNames = null;

async function discoverOrganiserTableNames(apiKey, baseId) {
  try {
    const resp = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.tables || [])
      .map((t) => t.name)
      .filter((name) => /organis|organiz|host|compan|provider|profile/i.test(name));
  } catch (e) {
    return [];
  }
}

async function getOrganiserTableCandidates(apiKey, baseId) {
  if (!cachedOrganiserTableNames) {
    const discovered = await discoverOrganiserTableNames(apiKey, baseId);
    cachedOrganiserTableNames = [
      process.env.AIRTABLE_ORGANISERS_TABLE,
      ...discovered,
      'Organisers',
      'Organizers',
      'Organiser',
      'Organizer',
      'Hosts',
      'Companies',
    ].filter((t, i, a) => t && a.indexOf(t) === i);
  }
  return cachedOrganiserTableNames;
}

async function fetchOrganiserProfile(apiKey, baseId, organiserId) {
  if (!organiserId) return null;
  const tables = await getOrganiserTableCandidates(apiKey, baseId);

  for (const table of tables) {
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}/${encodeURIComponent(organiserId)}`;
    try {
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
      if (resp.ok) {
        const data = await resp.json();
        const mapped = mapOrganiserAirtableRecord(data);
        if (mapped.organiser || mapped.organiserProfile || mapped.organiserLogo) {
          return mapped;
        }
      }
    } catch (e) {
      /* try next table */
    }
  }
  return null;
}

async function enrichOrganisersForEvents(events, apiKey, baseId) {
  const cache = {};
  const ids = [
    ...new Set(
      events
        .filter((e) => e.organiserId && (!e.organiser || !e.organiserProfile || !e.organiserLogo))
        .map((e) => e.organiserId)
    ),
  ];

  await Promise.all(
    ids.map(async (id) => {
      const profile = await fetchOrganiserProfile(apiKey, baseId, id);
      if (profile) cache[id] = profile;
    })
  );

  return events.map((ev) => {
    const p = ev.organiserId && cache[ev.organiserId];
    if (!p) return ev;
    return {
      ...ev,
      organiser: ev.organiser || p.organiser,
      organiserProfile: ev.organiserProfile || p.organiserProfile,
      organiserLogo: ev.organiserLogo || p.organiserLogo,
      search: [ev.search, p.organiser, p.organiserProfile].filter(Boolean).join(' ').toLowerCase(),
    };
  });
}

function pickDescription(fields) {
  const prefer = pick(fields, [
    'Event Description',
    'About',
    'Description',
    'Summary',
    'Details',
    'Overview',
  ]);
  if (prefer != null && prefer !== '') {
    if (typeof prefer === 'string') return prefer.trim();
    if (Array.isArray(prefer)) {
      return prefer
        .filter((x) => typeof x === 'string')
        .join('\n\n')
        .trim();
    }
  }
  const highlights = pick(fields, FIELD_MAP.description);
  if (highlights == null || highlights === '') return '';
  if (typeof highlights === 'string') return highlights.trim();
  if (Array.isArray(highlights)) {
    const parts = highlights.filter((x) => typeof x === 'string').map((x) => x.trim());
    const joined = parts.join(' · ');
    if (parts.some((p) => p.length > 40) || joined.length > 80) return joined;
    return '';
  }
  return '';
}

function organiserMatch(a, b) {
  if (a.organiserId && b.organiserId) return a.organiserId === b.organiserId;
  const na = String(a.organiser || '')
    .trim()
    .toLowerCase();
  const nb = String(b.organiser || '')
    .trim()
    .toLowerCase();
  return Boolean(na && nb && na === nb);
}

async function fetchAllAirtableRecords(baseUrl, apiKey, view) {
  const all = [];
  let offset;
  do {
    const q = new URLSearchParams({ pageSize: '100' });
    if (view) q.set('view', view);
    if (offset) q.set('offset', offset);
    const resp = await fetch(`${baseUrl}?${q}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(err || 'airtable_fetch_failed');
    }
    const data = await resp.json();
    all.push(...(data.records || []));
    offset = data.offset;
  } while (offset);
  return all;
}

function parseBoolField(raw) {
  if (raw === true) return true;
  if (raw === false || raw === null || raw === undefined || raw === '') return false;
  const s = String(raw).trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === '1' || s === 'on';
}

function parseApprovalRequired(fields) {
  if (parseBoolField(pick(fields, FIELD_MAP.approvalRequired))) return true;
  const status = String(pick(fields, FIELD_MAP.approvalStatus) || '').toLowerCase();
  if (!status) return false;
  if (/approved|open|confirmed/.test(status)) return false;
  return /require|application|review|pending|seat/.test(status);
}

function parseSalesClosed(fields) {
  if (parseBoolField(pick(fields, FIELD_MAP.salesClosed))) return true;
  const status = String(pick(fields, FIELD_MAP.approvalStatus) || '').toLowerCase();
  return /registration closed|sales closed|closed|ended|cancelled/.test(status);
}

function parseSoldOut(fields, spotsLeft) {
  if (parseBoolField(pick(fields, FIELD_MAP.soldOut))) return true;
  const status = String(pick(fields, FIELD_MAP.approvalStatus) || '').toLowerCase();
  if (/sold out|full|no tickets/.test(status)) return true;
  return spotsLeft !== null && spotsLeft <= 0;
}

function parseSpotsMeta(fields) {
  const direct = pick(fields, FIELD_MAP.spotsLeft);
  if (direct !== null && direct !== undefined && direct !== '') {
    const n = Number(String(direct).replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(n)) {
      return { spotsLeft: Math.max(0, Math.round(n)), capacity: null };
    }
  }

  const capRaw = pick(fields, FIELD_MAP.capacity);
  const capacity = capRaw != null && capRaw !== '' ? Number(String(capRaw).replace(/[^0-9.-]/g, '')) : null;
  const regs = pick(fields, FIELD_MAP.registrations);
  let regCount = 0;
  if (Array.isArray(regs)) regCount = regs.length;
  else if (typeof regs === 'number' && Number.isFinite(regs)) regCount = regs;

  if (Number.isFinite(capacity) && capacity > 0) {
    const left = Math.max(0, Math.round(capacity - regCount));
    return { spotsLeft: left, capacity: Math.round(capacity) };
  }

  return { spotsLeft: null, capacity: null };
}

function parsePriceNum(raw) {
  if (raw === null || raw === undefined || raw === '') return 0;
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function buildDateLine(location, parsedDate, time) {
  const parts = [];
  if (location) parts.push(String(location));
  if (parsedDate && parsedDate.short) {
    parts.push(parsedDate.short);
  } else if (parsedDate && parsedDate.display) {
    parts.push(parsedDate.display);
  }
  if (time) {
    const t = String(time).trim();
    const timeOnly = t.match(/(\d{1,2}:\d{2})/);
    parts.push(timeOnly ? timeOnly[1] : t.length <= 8 ? t : t.slice(0, 5));
  }
  return parts.join(' · ') || 'Date TBC';
}

function recordToEvent(record) {
  const f = record.fields || {};
  const title = pick(f, FIELD_MAP.title) || 'Untitled event';
  const description = pickDescription(f);
  const dateField = discoverDateField(f);
  const parsedDate = parseAirtableDate(dateField);
  let time = discoverTimeField(f) || '';
  if (!time && dateField && String(dateField).includes('T')) {
    const tm = String(dateField).match(/T(\d{2}:\d{2})/);
    if (tm) time = tm[1];
  }
  const location = pick(f, FIELD_MAP.location) || '';
  const venue = pick(f, FIELD_MAP.venue) || '';
  let postcode = pick(f, FIELD_MAP.postcode) || '';
  if (!postcode) postcode = extractUkPostcode(location, venue);
  const outcode = parseOutcode(postcode) || parseOutcode(location) || parseOutcode(venue);
  const industry = pick(f, FIELD_MAP.industry) || '';
  const format = pick(f, FIELD_MAP.format) || '';
  const typeRaw = pick(f, FIELD_MAP.type) || 'meeting';
  const typeSlug = typeSlugFromRaw(typeRaw);
  const typeCategory = parseTypeCategory(typeRaw);
  const type = slugifyType(typeRaw);
  const latRaw = pick(f, FIELD_MAP.latitude);
  const lngRaw = pick(f, FIELD_MAP.longitude);
  const lat = latRaw != null && latRaw !== '' ? Number(latRaw) : null;
  const lng = lngRaw != null && lngRaw !== '' ? Number(lngRaw) : null;
  const featuredVal = pick(f, FIELD_MAP.featured);
  const featured =
    featuredVal === true ||
    featuredVal === 'Yes' ||
    featuredVal === 'yes' ||
    String(featuredVal).toLowerCase() === 'true' ||
    String(featuredVal).toLowerCase() === 'premium';
  const priceRaw = pick(f, FIELD_MAP.price);
  const { display: priceDisplay, priceKey } = normalizePrice(priceRaw);
  const priceNum = parsePriceNum(priceRaw);
  const photo = attachmentUrl(pick(f, FIELD_MAP.photo));
  const organiserLinkRaw = pick(f, FIELD_MAP.organiser);
  const organiserId =
    pick(f, FIELD_MAP.organiserId) ||
    linkedRecordId(organiserLinkRaw) ||
    '';
  const organiser = pickOrganiserName(f) || '';
  const organiserLogo = attachmentUrl(pick(f, FIELD_MAP.organiserLogo));
  const organiserProfile = pick(f, FIELD_MAP.organiserProfile) || '';
  const addressLine = pick(f, FIELD_MAP.address) || '';
  const venueName = String(venue || '').trim();
  const venueAddress = [addressLine, postcode].filter(Boolean).join(', ') || String(location || '').trim();
  const ratingRaw = pick(f, FIELD_MAP.rating);
  const reviewsRaw = pick(f, FIELD_MAP.reviews);
  const rating = ratingRaw != null && ratingRaw !== '' ? Number(ratingRaw) : 4;
  const reviews = reviewsRaw != null && reviewsRaw !== '' ? Number(reviewsRaw) : 0;
  const spotsMeta = parseSpotsMeta(f);
  const isApprovalRequired = parseApprovalRequired(f);
  const isSalesClosed = parseSalesClosed(f);
  const isSoldOut = parseSoldOut(f, spotsMeta.spotsLeft);
  let urgency = '';
  if (spotsMeta.spotsLeft != null) {
    urgency = spotsMeta.spotsLeft > 0 ? spotsMeta.spotsLeft + ' spots left' : 'Sold out';
  }

  const search = [
    title,
    description,
    location,
    postcode,
    venue,
    industry,
    organiser,
    typeRaw,
    format,
    typeCategory,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return {
    id: record.id,
    title,
    description,
    date: parsedDate.display || formatDate(dateField),
    dateRaw: parsedDate.iso || (dateField ? String(dateField) : ''),
    dateTs: parsedDate.ts,
    dateFieldRaw: dateField ? String(dateField) : '',
    time: String(time),
    location,
    postcode: String(postcode),
    outcode,
    venue: String(venue),
    venueName,
    venueAddress,
    organiserId: String(organiserId),
    organiserLogo,
    organiserProfile: String(organiserProfile),
    industry,
    format,
    type,
    typeRaw: String(typeRaw),
    typeSlug,
    typeCategory,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    featured,
    price: priceDisplay,
    priceKey,
    priceNum,
    photo,
    organiser,
    rating: Number.isFinite(rating) ? rating : 4,
    reviews: Number.isFinite(reviews) ? reviews : 0,
    isApprovalRequired,
    isSoldOut,
    isSalesClosed,
    spotsLeft: spotsMeta.spotsLeft,
    capacity: spotsMeta.capacity,
    urgency,
    dateLine: buildDateLine(location, parsedDate, time),
    search,
    locationSlug: slugLocation(location),
    industrySlug: slugIndustry(industry),
    formatSlug: slugFormat(format),
    tickets: [],
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiKey = cleanEnvVal(process.env.AIRTABLE_API_KEY);
  const baseId = cleanEnvVal(process.env.AIRTABLE_BASE_ID);
  const table = process.env.AIRTABLE_EVENTS_TABLE || 'Events';

  if (!apiKey || !baseId) {
    return res.status(200).json({
      configured: false,
      message:
        'Add AIRTABLE_API_KEY and AIRTABLE_BASE_ID in Vercel → Settings → Environment Variables, then Redeploy.',
      events: [],
      envCheck: {
        hasApiKey: Boolean(apiKey),
        hasBaseId: Boolean(baseId),
        table: table,
      },
      hint: 'After saving variables, open Deployments → ⋯ → Redeploy. Names must match exactly.',
    });
  }

  try {
    const baseUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`;
    const recordId = req.query?.id;

    if (recordId) {
      const resp = await fetch(`${baseUrl}/${encodeURIComponent(recordId)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!resp.ok) {
        const err = await resp.text();
        return res.status(resp.status).json({
          configured: true,
          error: 'airtable_error',
          detail: err,
          event: null,
        });
      }
      const data = await resp.json();
      const ticketRecords = await fetchTicketsTableRecords(apiKey, baseId);
      const linkIndexes = buildTicketLinkIndexes(ticketRecords, [data]);
      let event = applyTicketsToEvent(recordToEvent(data), ticketRecords, linkIndexes, data);
      const enriched = await enrichOrganisersForEvents([event], apiKey, baseId);
      event = enriched[0];
      let related = [];
      try {
        const view = process.env.AIRTABLE_EVENTS_VIEW;
        const all = await fetchAllAirtableRecords(baseUrl, apiKey, view);
        let allEvents = attachTicketsToEvents(all.map(recordToEvent), ticketRecords, all);
        allEvents = await enrichOrganisersForEvents(allEvents, apiKey, baseId);
        related = allEvents
          .filter((e) => e.id !== event.id && organiserMatch(e, event))
          .slice(0, 6);
      } catch (relErr) {
        console.error('related_events_fetch', relErr.message);
      }
      return res.status(200).json({ configured: true, event, related });
    }

    const view = process.env.AIRTABLE_EVENTS_VIEW;
    const all = [];
    let offset;

    do {
      const q = new URLSearchParams({ pageSize: '100' });
      if (view) q.set('view', view);
      if (offset) q.set('offset', offset);
      const resp = await fetch(`${baseUrl}?${q}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!resp.ok) {
        const err = await resp.text();
        const parsed = parseAirtableError(err);
        return res.status(resp.status).json({
          configured: true,
          error: 'airtable_error',
          airtableType: parsed?.type,
          message:
            parsed?.type === 'AUTHENTICATION_REQUIRED'
              ? 'Airtable rejected your API key. In Vercel, update AIRTABLE_API_KEY with a new pat… token (no quotes), then Redeploy.'
              : parsed?.message || 'Airtable request failed',
          detail: err,
          events: [],
        });
      }
      const data = await resp.json();
      all.push(...(data.records || []));
      offset = data.offset;
    } while (offset);

    const ticketRecords = await fetchTicketsTableRecords(apiKey, baseId);
    const linkIndexes = buildTicketLinkIndexes(ticketRecords, all);
    let events = all.map((rec) => {
      const ev = recordToEvent(rec);
      return applyTicketsToEvent(ev, ticketRecords, linkIndexes, rec);
    });
    events = await enrichOrganisersForEvents(events, apiKey, baseId);
    const payload = { configured: true, events };
    if (req.query?.fields === '1') {
      if (all[0]) payload.airtableFieldNames = fieldKeys(all[0].fields || {});
      payload.airtableTicketFieldNames = unionFieldNames(ticketRecords);
      if (ticketRecords[0] && !payload.airtableTicketFieldNames.length) {
        payload.airtableTicketFieldNames = fieldKeys(ticketRecords[0].fields || {});
      }
    }
    if (req.query?.tickets_debug === '1') {
      const withRealTiers = events.filter(
        (e) => e.tickets?.length && e.tickets[0].id !== e.id + '-standard'
      );
      payload.ticketsDebug = {
        ticketRecordCount: ticketRecords.length,
        airtableTicketFieldNamesUnion: unionFieldNames(ticketRecords),
        linkedTicketRowAssignments: linkIndexes.linkedTicketRows,
        discoveredTicketLinkField: linkIndexes.ticketLinkField,
        discoveredEventTicketsField: linkIndexes.eventTicketField,
        eventsWithLinkedTiers: withRealTiers.length,
        sampleLinkedEvent: withRealTiers[0]
          ? {
              id: withRealTiers[0].id,
              title: withRealTiers[0].title,
              tickets: withRealTiers[0].tickets,
            }
          : null,
      };
    }
    return res.status(200).json(payload);
  } catch (e) {
    return res.status(500).json({
      configured: true,
      error: 'server_error',
      message: e.message,
      events: [],
    });
  }
};
