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
  organiserPersonalScopeFromRequest,
  findUserByEmail,
  isAdminRole,
  normalizeRole,
} = require('./auth');

const GROUP_FIELDS = {
  name: ['Organiser Name', 'Group Name', 'Name', 'Title'],
  ownerEmail: ['Email', 'Owner Email', 'Organiser Email', 'User Email'],
  description: ['Description', 'About', 'Profile', 'Company Profile'],
  users: ['Users', 'User', 'Account', 'Hub User'],
  image: ['Logo', 'Photo', 'Organiser Image', 'Image', 'Cover', 'Organiser Photo'],
  website: ['Website', 'Website URL', 'URL', 'Web', 'Site', 'Company Website'],
  location: ['Location', 'City', 'Region', 'Address', 'Area', 'Based in', 'Town'],
  status: ['Status', 'Profile Status', 'Listing Status', 'Approval Status'],
  rating: ['Rating', 'Average Rating', 'Stars'],
  revenue: ['Revenue', 'Total Revenue'],
};

const EVENT_READ_FIELDS = {
  image: ['Photo', 'Image', 'Cover', 'Photos', 'Event Photo', 'Event Image'],
  approvalStatus: ['Approval Status', 'Status', 'Listing Status', 'Event Status'],
  rating: ['Average Rating', 'Rating', 'Stars'],
  ticketsSold: ['Tickets Sold', 'Attendees', 'Registrations', 'Sold'],
  revenue: ['Revenue', 'Total Revenue', 'Event Revenue'],
  endDate: ['End Date', 'End Time', 'End Date & Time', 'Finish Time'],
  capacity: ['Capacity', 'Max Attendees', 'Ticket Qty', 'Max Capacity'],
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
  location: ['Location', 'City', 'Region', 'Area'],
  venue: ['Venue', 'Venue Name', 'Address', 'Venue Address'],
  endDate: ['End Date', 'End Time', 'End Date & Time', 'Finish Time'],
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

function parseMoneyNum(raw) {
  if (raw == null || raw === '') return 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const m = String(raw).match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

function formatMoney(amount) {
  const n = Number(amount) || 0;
  return '£' + (n % 1 === 0 ? n.toFixed(0) : n.toFixed(2));
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
  return isAdminRole(session?.role);
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
      image: resolveFieldName(sample, GROUP_FIELDS.image, 'Logo'),
      website: resolveFieldName(sample, GROUP_FIELDS.website, 'Website'),
      location: resolveFieldName(sample, GROUP_FIELDS.location, 'Location'),
    };
  } catch {
    writeFieldCache = {
      name: 'Organiser Name',
      email: 'Email',
      description: 'Description',
      users: 'Users',
      image: 'Logo',
      website: 'Website',
      location: 'Location',
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
  const statusRaw = String(pick(f, GROUP_FIELDS.status) || '').trim();
  const ratingRaw = pick(f, GROUP_FIELDS.rating);
  return {
    id: record.id,
    name: String(pick(f, GROUP_FIELDS.name) || 'Untitled organiser').trim(),
    ownerEmail: String(pick(f, GROUP_FIELDS.ownerEmail) || '').toLowerCase(),
    description: String(pick(f, GROUP_FIELDS.description) || '').trim(),
    userIds: linkedRecordIds(pick(f, GROUP_FIELDS.users)),
    imageUrl: attachmentUrl(pick(f, GROUP_FIELDS.image)),
    website: String(pick(f, GROUP_FIELDS.website) || '').trim(),
    location: String(pick(f, GROUP_FIELDS.location) || '').trim(),
    statusRaw,
    rating: ratingRaw != null && ratingRaw !== '' ? Number(ratingRaw) : null,
    revenueNum: parseMoneyNum(pick(f, GROUP_FIELDS.revenue)),
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
  const endRaw = pick(f, EVENT_READ_FIELDS.endDate);
  const soldRaw = pick(f, EVENT_READ_FIELDS.ticketsSold);
  const ratingRaw = pick(f, EVENT_READ_FIELDS.rating);
  return {
    id: record.id,
    title: String(pick(f, EVENT_WRITE_FIELDS.title) || 'Untitled event').trim(),
    date: dateRaw ? String(dateRaw) : '',
    endDate: endRaw ? String(endRaw) : '',
    type: String(pick(f, EVENT_WRITE_FIELDS.type) || '').trim(),
    ownerEmail: String(pick(f, EVENT_WRITE_FIELDS.ownerEmail) || '').toLowerCase(),
    organiserGroupIds: groupIds,
    organiserGroupId: groupIds[0] || '',
    description: String(pick(f, EVENT_WRITE_FIELDS.description) || '').trim(),
    location: String(pick(f, EVENT_WRITE_FIELDS.location) || '').trim(),
    venue: String(pick(f, EVENT_WRITE_FIELDS.venue) || '').trim(),
    imageUrl: attachmentUrl(pick(f, EVENT_READ_FIELDS.image)),
    statusRaw: String(pick(f, EVENT_READ_FIELDS.approvalStatus) || '').trim(),
    rating: ratingRaw != null && ratingRaw !== '' ? Number(ratingRaw) : null,
    ticketsSold: soldRaw != null && soldRaw !== '' ? Number(soldRaw) || 0 : null,
    revenueNum: parseMoneyNum(pick(f, EVENT_READ_FIELDS.revenue)),
    capacity: pick(f, EVENT_READ_FIELDS.capacity),
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

async function listGroupsForSession(session, adminView) {
  if (adminView) return listAllGroups();
  return listGroupsForUser(session.sub || '', session.email);
}

async function listEventsForSession(session, groupIds, organiserRecords, adminView) {
  if (adminView) return listAllOrganiserEvents();
  return listEventsForOrganiser(session.email, groupIds, organiserRecords);
}

async function listTicketsForSession(session, eventIds, adminView) {
  if (adminView) return listAllOrganiserTickets();
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

function decodeUploadBuffer(base64) {
  const raw = String(base64 || '').replace(/^data:[^;]+;base64,/, '');
  if (!raw) return null;
  const buffer = Buffer.from(raw, 'base64');
  if (buffer.length > 2 * 1024 * 1024) {
    throw new Error('Logo image must be under 2MB');
  }
  return buffer;
}

function sanitiseUploadFilename(filename) {
  return String(filename || 'logo.jpg').replace(/[^\w.\-]+/g, '_').slice(0, 80) || 'logo.jpg';
}

async function uploadViaUguu(buffer, mime, filename) {
  const form = new FormData();
  form.append('files[]', new Blob([buffer], { type: mime }), filename);
  const resp = await fetch('https://uguu.se/upload', { method: 'POST', body: form });
  let data = {};
  try {
    data = await resp.json();
  } catch {
    data = {};
  }
  const url = data.files && data.files[0] && String(data.files[0].url || '').trim();
  if (!resp.ok || !url.startsWith('http')) {
    throw new Error('uguu_upload_failed');
  }
  return url;
}

async function uploadViaTelegraph(buffer, mime, filename) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mime }), filename);
  const resp = await fetch('https://telegra.ph/upload', { method: 'POST', body: form });
  let data;
  try {
    data = await resp.json();
  } catch {
    data = null;
  }
  if (!Array.isArray(data) || !data[0] || !data[0].src) {
    throw new Error('telegraph_upload_failed');
  }
  return 'https://telegra.ph' + String(data[0].src);
}

async function uploadImageForAirtable({ base64, mime, filename }) {
  const buffer = decodeUploadBuffer(base64);
  if (!buffer) return null;
  const name = sanitiseUploadFilename(filename);
  const type = mime || 'image/jpeg';
  const providers = [uploadViaUguu, uploadViaTelegraph];
  let lastErr;
  for (const upload of providers) {
    try {
      const url = await upload(buffer, type, name);
      if (url && url.startsWith('http')) return url;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    lastErr && lastErr.message === 'Logo image must be under 2MB'
      ? lastErr.message
      : 'Could not upload logo for Airtable'
  );
}

async function resolveLogoAttachment({ logoUrl, logoBase64, logoMime, logoFilename }) {
  const url = String(logoUrl || '').trim();
  if (url && /^https?:\/\//i.test(url)) {
    return [{ url }];
  }
  if (logoBase64) {
    const hosted = await uploadImageForAirtable({
      base64: logoBase64,
      mime: logoMime,
      filename: logoFilename,
    });
    if (hosted) return [{ url: hosted }];
  }
  return null;
}

async function createGroup({
  userId,
  email,
  name,
  description,
  website,
  location,
  logoUrl,
  logoBase64,
  logoMime,
  logoFilename,
}) {
  const { groups: table } = tables();
  const wf = await getOrganiserWriteFields();
  const fields = {};
  fields[wf.name] = String(name).trim();
  fields[wf.email] = email.toLowerCase();
  if (description) fields[wf.description] = String(description).trim();
  if (website && wf.website) fields[wf.website] = String(website).trim();
  if (location && wf.location) fields[wf.location] = String(location).trim();
  if (userId && wf.users) fields[wf.users] = [userId];

  let logoWarning = null;
  if (logoUrl || logoBase64) {
    try {
      const logoAttachment = await resolveLogoAttachment({
        logoUrl,
        logoBase64,
        logoMime,
        logoFilename,
      });
      if (logoAttachment && wf.image) fields[wf.image] = logoAttachment;
    } catch (e) {
      logoWarning =
        e.message ||
        'Logo could not be uploaded. Your profile was saved — add a logo URL on this page and save again.';
    }
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
  const group = recordToGroup(data.records[0]);
  if (logoWarning) group.logoWarning = logoWarning;
  return group;
}

async function getGroupById(groupId) {
  const { groups: table } = tables();
  const resp = await airtableFetch(
    `${encodeURIComponent(table)}/${encodeURIComponent(groupId)}`
  );
  if (!resp.ok) {
    const err = await resp.text();
    const e = new Error(parseAirtableError(err)?.message || 'Group not found');
    e.status = resp.status === 404 ? 404 : resp.status;
    throw e;
  }
  const data = await resp.json();
  return recordToGroup(data);
}

async function updateGroup(groupId, payload) {
  const { groups: table } = tables();
  const wf = await getOrganiserWriteFields();
  const fields = {};
  if (payload.name) fields[wf.name] = String(payload.name).trim();
  if (payload.description !== undefined && wf.description) {
    fields[wf.description] = String(payload.description || '').trim();
  }
  if (payload.website !== undefined && wf.website) {
    fields[wf.website] = String(payload.website || '').trim();
  }
  if (payload.location !== undefined && wf.location) {
    fields[wf.location] = String(payload.location || '').trim();
  }
  if (payload.email && wf.email) fields[wf.email] = String(payload.email).toLowerCase();

  let logoWarning = null;
  const hasLogo =
    payload.logoUrl || payload.logoBase64 || payload.logoMime || payload.logoFilename;
  if (hasLogo) {
    try {
      const logoAttachment = await resolveLogoAttachment({
        logoUrl: payload.logoUrl,
        logoBase64: payload.logoBase64,
        logoMime: payload.logoMime,
        logoFilename: payload.logoFilename,
      });
      if (logoAttachment && wf.image) fields[wf.image] = logoAttachment;
    } catch (e) {
      logoWarning =
        e.message ||
        'Logo could not be uploaded. Other changes were saved — try a logo URL instead.';
    }
  }

  const resp = await airtableFetch(encodeURIComponent(table), {
    method: 'PATCH',
    body: JSON.stringify({ records: [{ id: groupId, fields }] }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    const e = new Error(parseAirtableError(err)?.message || err);
    e.status = resp.status;
    e.detail = err;
    throw e;
  }
  const data = await resp.json();
  const group = recordToGroup(data.records[0]);
  if (logoWarning) group.logoWarning = logoWarning;
  return group;
}

async function buildEventRecordFields({
  email,
  groupId,
  title,
  date,
  endDate,
  type,
  description,
  location,
  venue,
  photoUrl,
  photoBase64,
  photoMime,
  photoFilename,
  eventSample,
  organiserLinkField,
}) {
  const sample = eventSample || (await sampleRecordFields(tables().events));
  const fields = {};
  const titleField = resolveFieldName(sample, EVENT_WRITE_FIELDS.title, 'Event Title');
  fields[titleField] = String(title).trim();
  const dateField = resolveFieldName(sample, EVENT_WRITE_FIELDS.date, 'Date & Time');
  if (date) fields[dateField] = date;
  const endField = resolveFieldName(sample, EVENT_WRITE_FIELDS.endDate, null);
  if (endDate && endField) fields[endField] = endDate;
  const typeField = resolveFieldName(sample, EVENT_WRITE_FIELDS.type, 'Meeting Type');
  if (type) fields[typeField] = type;
  const descField = resolveFieldName(sample, EVENT_WRITE_FIELDS.description, 'Highlights');
  if (description) fields[descField] = String(description).trim();
  const locField = resolveFieldName(sample, EVENT_WRITE_FIELDS.location, null);
  if (location && locField) fields[locField] = String(location).trim();
  const venueField = resolveFieldName(sample, EVENT_WRITE_FIELDS.venue, null);
  if (venue && venueField) fields[venueField] = String(venue).trim();
  const ownerField = resolveFieldName(sample, EVENT_WRITE_FIELDS.ownerEmail, null);
  if (ownerField) fields[ownerField] = email.toLowerCase();
  if (groupId && organiserLinkField) fields[organiserLinkField] = [groupId];
  const imageField = resolveFieldName(sample, EVENT_READ_FIELDS.image, null);
  if (imageField) {
    try {
      const photoAttachment = await resolveLogoAttachment({
        logoUrl: photoUrl,
        logoBase64: photoBase64,
        logoMime: photoMime,
        logoFilename: photoFilename,
      });
      if (photoAttachment) fields[imageField] = photoAttachment;
    } catch (e) {
      const err = new Error(e.message || 'Could not upload event photo for Airtable');
      err.status = 400;
      throw err;
    }
  }
  return fields;
}

async function createEvent(payload) {
  const { events: table } = tables();
  const organiserLinkField = await getEventOrganiserLinkField();
  const eventSample = await sampleRecordFields(table);
  const fields = await buildEventRecordFields({
    ...payload,
    eventSample,
    organiserLinkField,
  });

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

async function createEventsBatch(payload) {
  const dates = Array.isArray(payload.dates) ? payload.dates.filter(Boolean) : [];
  if (!dates.length) {
    const one = await createEvent(payload);
    return [one];
  }
  const { events: table } = tables();
  const organiserLinkField = await getEventOrganiserLinkField();
  const eventSample = await sampleRecordFields(table);
  const base = { ...payload, eventSample, organiserLinkField };
  const created = [];
  const chunkSize = 10;
  for (let i = 0; i < dates.length; i += chunkSize) {
    const slice = dates.slice(i, i + chunkSize);
    const records = [];
    for (const date of slice) {
      records.push({
        fields: await buildEventRecordFields({ ...base, date, endDate: payload.endDate }),
      });
    }
    const resp = await airtableFetch(encodeURIComponent(table), {
      method: 'POST',
      body: JSON.stringify({ records }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      const e = new Error(parseAirtableError(err)?.message || err);
      e.status = resp.status;
      e.detail = err;
      throw e;
    }
    const data = await resp.json();
    (data.records || []).forEach((rec) => {
      created.push(recordToOrganiserEvent(rec, organiserLinkField));
    });
  }
  return created;
}

async function updateEvent(eventId, payload) {
  const { events: table } = tables();
  const organiserLinkField = await getEventOrganiserLinkField();
  const eventSample = await sampleRecordFields(table);
  const fields = await buildEventRecordFields({
    ...payload,
    eventSample,
    organiserLinkField,
  });
  const resp = await airtableFetch(encodeURIComponent(table), {
    method: 'PATCH',
    body: JSON.stringify({ records: [{ id: eventId, fields }] }),
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

async function getEventById(eventId) {
  const { events: table } = tables();
  const organiserLinkField = await getEventOrganiserLinkField();
  const resp = await airtableFetch(`${encodeURIComponent(table)}/${encodeURIComponent(eventId)}`);
  if (!resp.ok) {
    const err = await resp.text();
    const e = new Error(parseAirtableError(err)?.message || 'Event not found');
    e.status = resp.status === 404 ? 404 : resp.status;
    throw e;
  }
  const data = await resp.json();
  return recordToOrganiserEvent(data, organiserLinkField);
}

async function createTicketsForEvents({ eventIds, tickets }) {
  const ids = Array.isArray(eventIds) ? eventIds.filter(Boolean) : [];
  const tiers = Array.isArray(tickets) ? tickets : [];
  if (!ids.length || !tiers.length) return { created: 0, tickets: [] };
  const out = [];
  for (const eventId of ids) {
    for (const tier of tiers) {
      const ticket = await createTicket({
        eventId,
        name: tier.name,
        price: tier.price,
        description: tier.description,
        status: tier.status,
        quantityAvailable: tier.quantityAvailable,
      });
      out.push(ticket);
    }
  }
  return { created: out.length, tickets: out };
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
        'Logo (attachment, optional)',
        'Website (optional)',
        'Location (optional)',
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

function eventBelongsToGroup(ev, groupId) {
  if (ev.organiserGroupId === groupId) return true;
  return (ev.organiserGroupIds || []).includes(groupId);
}

function deriveListingStatus(statusRaw, dateIso) {
  const raw = String(statusRaw || '').toLowerCase();
  if (/draft|pending|unpublish|hidden|inactive/.test(raw)) {
    return { key: 'draft', label: 'Draft' };
  }
  const d = dateIso ? new Date(dateIso) : null;
  if (!d || Number.isNaN(d.getTime())) {
    return raw ? { key: 'live', label: 'Live' } : { key: 'draft', label: 'Draft' };
  }
  const now = new Date();
  if (d > now) return { key: 'upcoming', label: 'Upcoming' };
  return { key: 'live', label: 'Live' };
}

function enrichOrganiserOverview(groups, events, tickets) {
  const ticketsByEvent = {};
  tickets.forEach((t) => {
    if (!t.eventId) return;
    if (!ticketsByEvent[t.eventId]) ticketsByEvent[t.eventId] = [];
    ticketsByEvent[t.eventId].push(t);
  });

  const enrichedEvents = events.map((ev) => {
    const tiers = ticketsByEvent[ev.id] || [];
    let capacity = Number(ev.capacity) || 0;
    if (!capacity) {
      capacity = tiers.reduce((sum, t) => sum + (Number(t.quantityAvailable) || 0), 0);
    }
    let sold = ev.ticketsSold != null ? Number(ev.ticketsSold) : 0;
    if (!sold && tiers.length === 1 && tiers[0].quantityAvailable != null) {
      /* no sold field — capacity only */
    }
    let revenueNum = ev.revenueNum || 0;
    if (!revenueNum && sold > 0) {
      revenueNum = tiers.reduce((sum, t) => sum + (parseMoneyNum(t.price) || 0) * sold, 0);
    }
    const status = deriveListingStatus(ev.statusRaw, ev.date);
    return {
      ...ev,
      ticketsSold: sold,
      ticketsCapacity: capacity,
      ticketsSoldLabel: capacity > 0 ? `${sold} / ${capacity}` : sold > 0 ? String(sold) : '0',
      revenueNum,
      revenueDisplay: formatMoney(revenueNum),
      statusKey: status.key,
      statusLabel: status.label,
    };
  });

  const enrichedGroups = groups.map((g) => {
    const groupEvents = enrichedEvents.filter((ev) => eventBelongsToGroup(ev, g.id));
    const eventsListed = groupEvents.length;
    let revenueNum = g.revenueNum || 0;
    if (!revenueNum) {
      revenueNum = groupEvents.reduce((sum, ev) => sum + (ev.revenueNum || 0), 0);
    }
    const ratings = groupEvents.map((e) => e.rating).filter((r) => r != null && !Number.isNaN(r));
    const rating =
      g.rating != null && !Number.isNaN(g.rating)
        ? g.rating
        : ratings.length
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length
          : null;
    const status = deriveListingStatus(
      g.statusRaw,
      groupEvents.map((e) => e.date).filter(Boolean).sort()[0]
    );
    if (eventsListed > 0 && status.key === 'draft' && !g.statusRaw) {
      status.key = 'live';
      status.label = 'Live';
    }
    return {
      ...g,
      eventsListed,
      revenueNum,
      revenueDisplay: formatMoney(revenueNum),
      rating: rating != null ? Math.round(rating * 10) / 10 : null,
      statusKey: status.key,
      statusLabel: status.label,
    };
  });

  const upcomingEvents = enrichedEvents
    .filter((ev) => {
      if (!ev.date) return true;
      const d = new Date(ev.date);
      return !Number.isNaN(d.getTime()) && d >= new Date(Date.now() - 86400000);
    })
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

  return { groups: enrichedGroups, events: enrichedEvents, upcomingEvents };
}

async function getOrganiserWorkspace(req) {
  const auth = requireOrganiserSession(req);
  if (!auth.ok) return auth;
  const { session } = auth;
  const isAdmin = isPlatformAdmin(session);
  const personalScope = isAdmin && organiserPersonalScopeFromRequest(req);
  const adminView = isAdmin && !personalScope;

  let displayName = session.name || '';
  try {
    const user = await findUserByEmail(session.email);
    if (user && user.name) displayName = user.name;
  } catch {
    /* use session name */
  }

  let groups = [];
  let groupsError = null;
  try {
    groups = await listGroupsForSession(session, adminView);
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
    events = await listEventsForSession(session, groupIds, ownedRecords, adminView);
  } catch (e) {
    return { ok: false, status: 500, error: 'events_fetch_failed', message: e.message, groups };
  }

  const eventIds = events.map((e) => e.id);
  const tickets = await listTicketsForSession(session, eventIds, adminView);
  const overview = enrichOrganiserOverview(groups, events, tickets);

  return {
    ok: true,
    session,
    groups: overview.groups,
    events: overview.events,
    upcomingEvents: overview.upcomingEvents,
    tickets,
    groupsError,
    hubView: hubViewFromRequest(req),
    adminView,
    personalScope,
    isAdmin,
    canOrganise: groups.length > 0 || adminView,
    user: {
      email: session.email,
      name: displayName,
      role: normalizeRole(session.role),
      sub: session.sub,
    },
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
  getGroupById,
  updateGroup,
  createEvent,
  createEventsBatch,
  updateEvent,
  getEventById,
  createTicket,
  createTicketsForEvents,
  airtableSetupHint,
  recordToGroup,
  getOrganiserWorkspace,
};
