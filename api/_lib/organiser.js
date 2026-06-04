/**
 * Organiser dashboard — uses Airtable "Organisers" table (linked to Users).
 */
const {
  airtableConfig,
  airtableFetch,
  escapeFormulaValue,
  json,
  sessionFromRequest,
  setCors,
  parseAirtableError,
  hubViewFromRequest,
} = require('./auth');

const GROUP_FIELDS = {
  name: ['Organiser Name', 'Group Name', 'Name', 'Title'],
  ownerEmail: ['Email', 'Owner Email', 'Organiser Email', 'User Email'],
  description: ['Description', 'About', 'Profile', 'Company Profile'],
  users: ['Users', 'User', 'Account', 'Hub User'],
};

const ORGANISER_EVENT_LINK_FIELDS = [
  'Events',
  'Events 2',
  'Events 3',
  'Event',
  'Linked Events',
];

const EVENT_WRITE_FIELDS = {
  title: ['Event Title', 'Title', 'Name'],
  date: ['Date & Time', 'Date', 'Event Date', 'Start Date'],
  type: ['Meeting Type', 'Format', 'Type', 'Event Type'],
  ownerEmail: ['Owner Email', 'Organiser Email', 'Creator Email'],
  organiserGroup: [
    'Organisers',
    'Organiser',
    'Organiser Group',
    'Organiser Groups',
    'Group',
    'Host',
    'Host/Organiser',
  ],
  description: ['Highlights', 'Description', 'About'],
};

const TICKET_WRITE_FIELDS = {
  name: ['Ticket Name', 'Ticket Type', 'Name', 'Tier Name'],
  price: ['Price', 'Ticket Price', 'Amount'],
  description: ['Ticket Description', 'Description'],
  linkedEvent: ['Linked Event', 'Event', 'Events'],
  status: ['Status', 'Ticket Status'],
  quantity: ['Quantity Available', 'Quantity', 'Capacity'],
};

let writeFieldCache = null;
let eventLinkFieldCache = null;

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

function tables() {
  return {
    groups:
      process.env.AIRTABLE_ORGANISERS_TABLE ||
      process.env.AIRTABLE_ORGANISER_GROUPS_TABLE ||
      'Organisers',
    events: process.env.AIRTABLE_EVENTS_TABLE || 'Events',
    tickets: process.env.AIRTABLE_TICKETS_TABLE || 'Tickets',
    eventsView: process.env.AIRTABLE_EVENTS_VIEW,
  };
}

/** Any signed-in user can manage organiser profiles linked to their account. */
function requireOrganiserSession(req) {
  const session = sessionFromRequest(req);
  if (!session) return { ok: false, status: 401, error: 'not_authenticated' };
  if (!session.email) return { ok: false, status: 403, error: 'missing_email' };
  return { ok: true, session };
}

function isPlatformAdmin(session) {
  return String(session?.role || '').toLowerCase() === 'admin';
}

function resolveFieldName(sampleFields, aliases, fallback) {
  for (const key of aliases) {
    if (sampleFields && sampleFields[key] !== undefined) return key;
    const hit = Object.keys(sampleFields || {}).find(
      (k) => k.toLowerCase() === String(key).toLowerCase()
    );
    if (hit) return hit;
  }
  return fallback;
}

async function sampleRecordFields(table) {
  const resp = await airtableFetch(`${encodeURIComponent(table)}?maxRecords=1`);
  if (!resp.ok) return {};
  const data = await resp.json();
  return (data.records[0] || {}).fields || {};
}

async function getOrganiserWriteFields() {
  if (writeFieldCache) return writeFieldCache;
  const { groups: table } = tables();
  try {
    const sample = await sampleRecordFields(table);
    writeFieldCache = {
      name: resolveFieldName(sample, GROUP_FIELDS.name, 'Organiser Name'),
      email: resolveFieldName(sample, GROUP_FIELDS.ownerEmail, 'Email'),
      description: resolveFieldName(sample, GROUP_FIELDS.description, 'Description'),
      users: resolveFieldName(sample, GROUP_FIELDS.users, 'Users'),
    };
  } catch {
    writeFieldCache = {
      name: 'Organiser Name',
      email: 'Email',
      description: 'Description',
      users: 'Users',
    };
  }
  return writeFieldCache;
}

async function getEventOrganiserLinkField() {
  if (eventLinkFieldCache) return eventLinkFieldCache;
  const { events: table } = tables();
  try {
    const sample = await sampleRecordFields(table);
    eventLinkFieldCache = resolveFieldName(
      sample,
      EVENT_WRITE_FIELDS.organiserGroup,
      'Organisers'
    );
  } catch {
    eventLinkFieldCache = 'Organisers';
  }
  return eventLinkFieldCache;
}

async function fetchAllRecords(table, view) {
  const all = [];
  let offset;
  do {
    const q = new URLSearchParams({ pageSize: '100' });
    if (view) q.set('view', view);
    if (offset) q.set('offset', offset);
    const resp = await airtableFetch(`${encodeURIComponent(table)}?${q}`);
    if (!resp.ok) {
      const err = await resp.text();
      const parsed = parseAirtableError(err);
      const e = new Error(parsed?.message || err);
      e.status = resp.status;
      e.detail = err;
      throw e;
    }
    const data = await resp.json();
    all.push(...(data.records || []));
    offset = data.offset;
  } while (offset);
  return all;
}

function recordToGroup(record) {
  const f = record.fields || {};
  return {
    id: record.id,
    name: String(pick(f, GROUP_FIELDS.name) || 'Untitled organiser').trim(),
    ownerEmail: String(pick(f, GROUP_FIELDS.ownerEmail) || '').toLowerCase(),
    description: String(pick(f, GROUP_FIELDS.description) || '').trim(),
    userIds: linkedRecordIds(pick(f, GROUP_FIELDS.users)),
    createdAt: record.createdTime || null,
  };
}

function eventIdsFromOrganiserRecord(record) {
  const f = record.fields || {};
  const ids = new Set();
  ORGANISER_EVENT_LINK_FIELDS.forEach((key) => {
    linkedRecordIds(f[key]).forEach((id) => ids.add(id));
  });
  return ids;
}

function recordToOrganiserEvent(record, organiserLinkField) {
  const f = record.fields || {};
  const groupIds = linkedRecordIds(
    pick(f, EVENT_WRITE_FIELDS.organiserGroup) ||
      (organiserLinkField ? f[organiserLinkField] : null)
  );
  const dateRaw = pick(f, EVENT_WRITE_FIELDS.date);
  return {
    id: record.id,
    title: String(pick(f, EVENT_WRITE_FIELDS.title) || 'Untitled event').trim(),
    date: dateRaw ? String(dateRaw) : '',
    type: String(pick(f, EVENT_WRITE_FIELDS.type) || '').trim(),
    ownerEmail: String(pick(f, EVENT_WRITE_FIELDS.ownerEmail) || '').toLowerCase(),
    organiserGroupIds: groupIds,
    organiserGroupId: groupIds[0] || '',
    description: String(pick(f, EVENT_WRITE_FIELDS.description) || '').trim(),
  };
}

function recordToOrganiserTicket(record) {
  const f = record.fields || {};
  const eventIds = linkedRecordIds(pick(f, TICKET_WRITE_FIELDS.linkedEvent));
  const priceRaw = pick(f, TICKET_WRITE_FIELDS.price);
  return {
    id: record.id,
    name: String(pick(f, TICKET_WRITE_FIELDS.name) || 'Ticket').trim(),
    price: priceRaw != null && priceRaw !== '' ? String(priceRaw) : '',
    description: String(pick(f, TICKET_WRITE_FIELDS.description) || '').trim(),
    status: String(pick(f, TICKET_WRITE_FIELDS.status) || '').trim(),
    quantityAvailable: pick(f, TICKET_WRITE_FIELDS.quantity),
    eventId: eventIds[0] || '',
  };
}

function groupBelongsToUser(group, userId, email) {
  const emailLower = email.toLowerCase();
  if (userId && group.userIds.includes(userId)) return true;
  if (group.ownerEmail && group.ownerEmail === emailLower) return true;
  return false;
}

async function listGroupsForUser(userId, email) {
  const { groups: table } = tables();
  const emailLower = email.toLowerCase();

  let records = [];
  try {
    const formula = `{${GROUP_FIELDS.ownerEmail[0]}}='${escapeFormulaValue(emailLower)}'`;
    const q = new URLSearchParams({ filterByFormula: formula, pageSize: '100' });
    const resp = await airtableFetch(`${encodeURIComponent(table)}?${q}`);
    if (resp.ok) {
      const data = await resp.json();
      records = data.records || [];
    }
  } catch {
    /* fall through to full scan */
  }

  if (!records.length) {
    records = await fetchAllRecords(table);
  }

  const groups = records.map(recordToGroup).filter((g) => groupBelongsToUser(g, userId, email));

  const seen = new Set(groups.map((g) => g.id));
  if (userId) {
    const all = records.length ? records : await fetchAllRecords(table);
    all.forEach((rec) => {
      const g = recordToGroup(rec);
      if (!seen.has(g.id) && groupBelongsToUser(g, userId, email)) {
        groups.push(g);
        seen.add(g.id);
      }
    });
  }

  return groups;
}

/** @deprecated use listGroupsForUser */
async function listGroupsForEmail(email) {
  return listGroupsForUser(null, email);
}

async function listEventsForOrganiser(email, groupIds, organiserRecords) {
  const { events: table, eventsView } = tables();
  const organiserLinkField = await getEventOrganiserLinkField();
  const groupSet = new Set(groupIds || []);
  const emailLower = email.toLowerCase();

  const linkedFromOrganiser = new Set();
  (organiserRecords || []).forEach((rec) => {
    eventIdsFromOrganiserRecord(rec).forEach((id) => linkedFromOrganiser.add(id));
  });

  const all = await fetchAllRecords(table, eventsView);
  const mapped = all.map((r) => recordToOrganiserEvent(r, organiserLinkField));

  return mapped.filter((ev) => {
    if (linkedFromOrganiser.has(ev.id)) return true;
    if (ev.ownerEmail && ev.ownerEmail === emailLower) return true;
    if (ev.organiserGroupId && groupSet.has(ev.organiserGroupId)) return true;
    if (ev.organiserGroupIds.some((id) => groupSet.has(id))) return true;
    return false;
  });
}

async function listAllGroups() {
  const { groups: table } = tables();
  const records = await fetchAllRecords(table);
  return records.map(recordToGroup);
}

async function listAllOrganiserEvents() {
  const { events: table, eventsView } = tables();
  const organiserLinkField = await getEventOrganiserLinkField();
  const all = await fetchAllRecords(table, eventsView);
  return all.map((r) => recordToOrganiserEvent(r, organiserLinkField));
}

async function listAllOrganiserTickets() {
  const { tickets: table } = tables();
  try {
    const records = await fetchAllRecords(table);
    return records.map(recordToOrganiserTicket);
  } catch {
    return [];
  }
}

async function listGroupsForSession(session) {
  if (isPlatformAdmin(session)) return listAllGroups();
  return listGroupsForUser(session.sub || '', session.email);
}

async function listEventsForSession(session, groupIds, organiserRecords) {
  if (isPlatformAdmin(session)) return listAllOrganiserEvents();
  return listEventsForOrganiser(session.email, groupIds, organiserRecords);
}

async function listTicketsForSession(session, eventIds) {
  if (isPlatformAdmin(session)) return listAllOrganiserTickets();
  return listTicketsForEventIds(eventIds);
}

function groupOwnedBySession(session, groups, groupId) {
  if (isPlatformAdmin(session)) return true;
  return groups.some((g) => g.id === groupId);
}

async function listTicketsForEventIds(eventIds) {
  const { tickets: table } = tables();
  const eventSet = new Set(eventIds || []);
  if (!eventSet.size) return [];
  let records = [];
  try {
    records = await fetchAllRecords(table);
  } catch (e) {
    return [];
  }
  return records.map(recordToOrganiserTicket).filter((t) => eventSet.has(t.eventId));
}

async function createGroup({ userId, email, name, description }) {
  const { groups: table } = tables();
  const wf = await getOrganiserWriteFields();
  const fields = {};
  fields[wf.name] = String(name).trim();
  fields[wf.email] = email.toLowerCase();
  if (description) fields[wf.description] = String(description).trim();
  if (userId && wf.users) fields[wf.users] = [userId];

  const resp = await airtableFetch(encodeURIComponent(table), {
    method: 'POST',
    body: JSON.stringify({ records: [{ fields }] }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    const e = new Error(parseAirtableError(err)?.message || err);
    e.status = resp.status;
    e.detail = err;
    throw e;
  }
  const data = await resp.json();
  return recordToGroup(data.records[0]);
}

async function createEvent({ email, groupId, title, date, type, description }) {
  const { events: table } = tables();
  const organiserLinkField = await getEventOrganiserLinkField();
  const fields = {};
  const titleField = resolveFieldName(
    await sampleRecordFields(table),
    EVENT_WRITE_FIELDS.title,
    'Event Title'
  );
  fields[titleField] = String(title).trim();
  const dateField = resolveFieldName(
    await sampleRecordFields(table),
    EVENT_WRITE_FIELDS.date,
    'Date & Time'
  );
  if (date) fields[dateField] = date;
  const typeField = resolveFieldName(
    await sampleRecordFields(table),
    EVENT_WRITE_FIELDS.type,
    'Meeting Type'
  );
  if (type) fields[typeField] = type;
  const descField = resolveFieldName(
    await sampleRecordFields(table),
    EVENT_WRITE_FIELDS.description,
    'Highlights'
  );
  if (description) fields[descField] = String(description).trim();
  const eventSample = await sampleRecordFields(table);
  const ownerField = resolveFieldName(eventSample, EVENT_WRITE_FIELDS.ownerEmail, null);
  if (ownerField) fields[ownerField] = email.toLowerCase();
  if (groupId) fields[organiserLinkField] = [groupId];

  const resp = await airtableFetch(encodeURIComponent(table), {
    method: 'POST',
    body: JSON.stringify({ records: [{ fields }] }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    const e = new Error(parseAirtableError(err)?.message || err);
    e.status = resp.status;
    e.detail = err;
    throw e;
  }
  const data = await resp.json();
  return recordToOrganiserEvent(data.records[0], organiserLinkField);
}

async function createTicket({ eventId, name, price, description, status, quantityAvailable }) {
  const { tickets: table } = tables();
  const sample = await sampleRecordFields(table);
  const fields = {};
  const linkField = resolveFieldName(sample, TICKET_WRITE_FIELDS.linkedEvent, 'Linked Event');
  const nameField = resolveFieldName(sample, TICKET_WRITE_FIELDS.name, 'Ticket Type');
  fields[linkField] = [eventId];
  fields[nameField] = String(name).trim();
  const priceField = resolveFieldName(sample, TICKET_WRITE_FIELDS.price, 'Price');
  if (price !== undefined && price !== '') fields[priceField] = Number(price) || 0;
  const descField = resolveFieldName(sample, TICKET_WRITE_FIELDS.description, 'Description');
  if (description) fields[descField] = String(description).trim();
  const statusField = resolveFieldName(sample, TICKET_WRITE_FIELDS.status, 'Status');
  if (status) fields[statusField] = status;
  const qtyField = resolveFieldName(sample, TICKET_WRITE_FIELDS.quantity, 'Quantity Available');
  if (quantityAvailable != null && quantityAvailable !== '') {
    fields[qtyField] = Number(quantityAvailable);
  }

  const resp = await airtableFetch(encodeURIComponent(table), {
    method: 'POST',
    body: JSON.stringify({ records: [{ fields }] }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    const e = new Error(parseAirtableError(err)?.message || err);
    e.status = resp.status;
    e.detail = err;
    throw e;
  }
  const data = await resp.json();
  return recordToOrganiserTicket(data.records[0]);
}

function airtableSetupHint(resource) {
  if (resource === 'groups') {
    return {
      table: tables().groups,
      requiredFields: [
        'Organiser Name',
        'Email',
        'Users (link to Users table)',
        'Description (optional)',
      ],
    };
  }
  if (resource === 'events') {
    return {
      table: tables().events,
      requiredFields: [
        'Event Title',
        'Date & Time',
        'Meeting Type',
        'Organisers (link to Organisers table)',
      ],
    };
  }
  return {
    table: tables().tickets,
    requiredFields: ['Ticket Type or Ticket Name', 'Price', 'Linked Event', 'Status (optional)'],
  };
}

async function getOrganiserWorkspace(req) {
  const auth = requireOrganiserSession(req);
  if (!auth.ok) return auth;
  const { session } = auth;
  const adminView = isPlatformAdmin(session);

  let groups = [];
  let groupsError = null;
  try {
    groups = await listGroupsForSession(session);
  } catch (e) {
    groupsError = e.message;
  }

  const groupIds = groups.map((g) => g.id);
  let events = [];
  try {
    let ownedRecords = [];
    if (!adminView) {
      const { groups: table } = tables();
      const organiserRecords = await fetchAllRecords(table);
      ownedRecords = organiserRecords.filter((r) => groupIds.includes(r.id));
    }
    events = await listEventsForSession(session, groupIds, ownedRecords);
  } catch (e) {
    return { ok: false, status: 500, error: 'events_fetch_failed', message: e.message, groups };
  }

  const eventIds = events.map((e) => e.id);
  const tickets = await listTicketsForSession(session, eventIds);

  return {
    ok: true,
    session,
    groups,
    events,
    tickets,
    groupsError,
    hubView: hubViewFromRequest(req),
    adminView,
    canOrganise: groups.length > 0 || adminView,
  };
}

module.exports = {
  json,
  setCors,
  requireOrganiserSession,
  isPlatformAdmin,
  tables,
  listGroupsForUser,
  listGroupsForSession,
  listGroupsForEmail,
  listEventsForOrganiser,
  listEventsForSession,
  listTicketsForEventIds,
  listTicketsForSession,
  groupOwnedBySession,
  createGroup,
  createEvent,
  createTicket,
  airtableSetupHint,
  recordToGroup,
  getOrganiserWorkspace,
};
