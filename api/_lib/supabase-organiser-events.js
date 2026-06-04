/**
 * Organiser events + tickets + dashboard workspace — Supabase.
 */
const { getSupabaseAdmin } = require('./supabase');
const { resolveImageUrl } = require('./supabase-storage');
const { isAdminRole } = require('./auth');
const { findUserByEmail } = require('./supabase-auth');
const { hubViewFromRequest, organiserPersonalScopeFromRequest } = require('./auth');

const sbOrg = require('./supabase-organiser');

function formatMoney(amount) {
  const n = Number(amount) || 0;
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const { normalizeEventType } = require('./event-types');

function mapEventType(type) {
  return normalizeEventType(type);
}

function mapMeetingType(format) {
  const s = String(format || '').toLowerCase();
  if (s.includes('online') && !s.includes('hybrid')) return 'Online';
  if (s.includes('hybrid')) return 'Hybrid';
  if (s.includes('person') || s.includes('in ')) return 'In person';
  return format ? String(format).trim() : 'In person';
}

function mapApprovalStatus(listingStatus) {
  if (listingStatus == null || listingStatus === '') return undefined;
  const s = String(listingStatus).toLowerCase();
  if (s === 'published' || s === 'publish' || s === 'approved') return 'Approved';
  if (s === 'rejected') return 'Rejected';
  if (s === 'draft') return 'Pending Review';
  return 'Pending Review';
}

function payloadTouchesDate(payload) {
  if (payload._touchDate) return true;
  if (payload.date || payload.endDate) return true;
  return false;
}

function parseDateIso(dateStr, endStr) {
  const start = dateStr ? new Date(dateStr) : null;
  const end = endStr ? new Date(endStr) : null;
  return {
    starts_at: start && !Number.isNaN(start.getTime()) ? start.toISOString() : null,
    ends_at: end && !Number.isNaN(end.getTime()) ? end.toISOString() : null,
  };
}

function composeDescription(description, extras) {
  let text = String(description || '').trim();
  if (extras && typeof extras === 'object') {
    const extra = JSON.stringify(extras);
    if (extra && extra !== '{}') text = (text ? text + '\n\n' : '') + extra;
  }
  return text || null;
}

function rowToEvent(row) {
  if (!row) return null;
  const dateIso = row.starts_at ? String(row.starts_at) : '';
  return {
    id: row.id,
    title: String(row.title || 'Untitled event').trim(),
    date: dateIso,
    endDate: row.ends_at ? String(row.ends_at) : '',
    type: String(row.event_type || '').trim(),
    ownerEmail: '',
    organiserGroupIds: row.organiser_id ? [row.organiser_id] : [],
    organiserGroupId: row.organiser_id || '',
    description: String(row.description || '').trim(),
    location: String(row.location_label || row.city || row.venue || '').trim(),
    venue: String(row.venue || '').trim(),
    addressLine1: String(row.address || '').trim(),
    city: String(row.city || '').trim(),
    postcode: String(row.postcode || '').trim(),
    eventFormat: String(row.meeting_type || '').trim(),
    onlinePlatform: '',
    onlineLink: String(row.meeting_link || '').trim(),
    imageUrl: String(row.photo_url || '').trim(),
    statusRaw: row.approval_status || 'Pending Review',
    rating: row.average_rating != null ? Number(row.average_rating) : null,
    ticketsSold: 0,
    revenueNum: 0,
    capacity: null,
  };
}

function rowToTicket(row) {
  return {
    id: row.id,
    name: String(row.name || 'Ticket').trim(),
    price: row.price != null ? String(row.price) : '',
    description: String(row.description || '').trim(),
    status: String(row.status || '').trim(),
    quantityAvailable: row.quantity,
    eventId: row.event_id || '',
  };
}

function eventBelongsToGroup(ev, groupId) {
  return ev.organiserGroupId === groupId || (ev.organiserGroupIds || []).includes(groupId);
}

function deriveGroupListingStatus(statusRaw) {
  const raw = String(statusRaw || '').toLowerCase().trim();
  if (!raw) return { key: 'draft', label: 'Draft' };
  if (/unpublish/.test(raw)) return { key: 'unpublished', label: 'Unpublished' };
  if (/^draft$|pending|hidden|inactive/.test(raw)) return { key: 'draft', label: 'Draft' };
  if (/publish|live|active|public|approved|verified/.test(raw)) return { key: 'live', label: 'Live' };
  return { key: 'draft', label: 'Draft' };
}

function deriveListingStatus(statusRaw, dateIso) {
  const raw = String(statusRaw || '').toLowerCase();
  if (/unpublish|reject/.test(raw)) return { key: 'unpublished', label: 'Unpublished' };
  if (/pending|draft/.test(raw)) return { key: 'draft', label: 'Draft' };
  const d = dateIso ? new Date(dateIso) : null;
  if (!d || Number.isNaN(d.getTime())) {
    return /approved/.test(raw) ? { key: 'live', label: 'Live' } : { key: 'draft', label: 'Draft' };
  }
  if (d > new Date()) return { key: 'upcoming', label: 'Upcoming' };
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
    const capacity = tiers.reduce((sum, t) => sum + (Number(t.quantityAvailable) || 0), 0);
    const sold = ev.ticketsSold != null ? Number(ev.ticketsSold) : 0;
    const revenueNum = ev.revenueNum || 0;
    const status = deriveListingStatus(ev.statusRaw, ev.date);
    return {
      ...ev,
      ticketsSold: sold,
      ticketsCapacity: capacity,
      ticketsSoldLabel: capacity > 0 ? `${sold} / ${capacity}` : '0',
      revenueNum,
      revenueDisplay: formatMoney(revenueNum),
      statusKey: status.key,
      statusLabel: status.label,
    };
  });

  const enrichedGroups = groups.map((g) => {
    const groupEvents = enrichedEvents.filter((ev) => eventBelongsToGroup(ev, g.id));
    const status = deriveGroupListingStatus(g.statusRaw);
    return {
      ...g,
      eventsListed: groupEvents.length,
      revenueNum: 0,
      revenueDisplay: formatMoney(0),
      rating: g.rating,
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

async function listAllOrganiserEvents() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('events').select('*').order('starts_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(rowToEvent);
}

async function listEventsForOrganiser(email, groupIds) {
  const sb = getSupabaseAdmin();
  const ids = groupIds || [];
  if (!ids.length) return [];
  const { data, error } = await sb
    .from('events')
    .select('*')
    .in('organiser_id', ids)
    .order('starts_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(rowToEvent);
}

async function listEventsForSession(session, groupIds, _organiserRecords, adminView) {
  if (adminView) return listAllOrganiserEvents();
  return listEventsForOrganiser(session.email, groupIds);
}

async function listTicketsForEventIds(eventIds) {
  const sb = getSupabaseAdmin();
  const ids = eventIds || [];
  if (!ids.length) return [];
  const { data, error } = await sb.from('tickets').select('*').in('event_id', ids);
  if (error) throw new Error(error.message);
  return (data || []).map(rowToTicket);
}

async function listAllOrganiserTickets() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('tickets').select('*');
  if (error) throw new Error(error.message);
  return (data || []).map(rowToTicket);
}

async function listTicketsForSession(session, eventIds, adminView) {
  if (adminView) {
    const all = await listAllOrganiserTickets();
    const set = new Set(eventIds || []);
    return set.size ? all.filter((t) => set.has(t.eventId)) : all;
  }
  return listTicketsForEventIds(eventIds);
}

async function getEventById(eventId) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('events').select('*').eq('id', eventId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    const e = new Error('Event not found');
    e.status = 404;
    throw e;
  }
  return rowToEvent(data);
}

async function resolveEventPhotoUrl(payload, eventId) {
  if (payload.photoBase64) {
    try {
      const url = await resolveImageUrl({
        folder: `events/${eventId || 'new'}`,
        logoUrl: payload.photoUrl,
        logoBase64: payload.photoBase64,
        logoMime: payload.photoMime,
        logoFilename: payload.photoFilename,
      });
      if (url) return url;
    } catch (e) {
      const err = new Error(e.message || 'Could not upload event photo');
      err.logoWarning = err.message;
      throw err;
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'photoUrl')) {
    const url = String(payload.photoUrl || '').trim();
    if (url && /^https?:\/\//i.test(url)) return url;
    return null;
  }
  return undefined;
}

async function buildEventRow(payload, eventId, mode) {
  const touchDate = mode !== 'update' || payloadTouchesDate(payload);
  const photo_url = await resolveEventPhotoUrl(payload, eventId);
  const approval_status = mapApprovalStatus(payload.listingStatus);

  const row = {
    title: payload.title,
    description: composeDescription(payload.description, payload.attendeeExtras),
    event_type: mapEventType(payload.type),
    meeting_type: mapMeetingType(payload.eventFormat),
    venue: payload.venue || null,
    address: payload.addressLine1 || payload.fullAddress || null,
    city: payload.city || null,
    postcode: payload.postcode || null,
    location_label: payload.location || payload.city || payload.venue || null,
    meeting_link: payload.onlineLink || null,
    organiser_id: payload.groupId || null,
  };

  if (touchDate) {
    const dates = parseDateIso(payload.date, payload.endDate);
    row.starts_at = dates.starts_at;
    row.ends_at = dates.ends_at;
  } else if (mode === 'create') {
    const dates = parseDateIso(payload.date, payload.endDate);
    row.starts_at = dates.starts_at;
    row.ends_at = dates.ends_at;
  }

  if (approval_status !== undefined) row.approval_status = approval_status;
  else if (mode === 'create') row.approval_status = mapApprovalStatus('draft') || 'Pending Review';

  if (photo_url !== undefined) row.photo_url = photo_url;
  else if (mode === 'create') row.photo_url = null;

  return row;
}

async function createEvent(payload) {
  const sb = getSupabaseAdmin();
  const row = await buildEventRow(payload, 'new', 'create');
  const { data, error } = await sb.from('events').insert(row).select('*').single();
  if (error) throw new Error(error.message);
  return rowToEvent(data);
}

async function updateEvent(eventId, payload) {
  const sb = getSupabaseAdmin();
  const row = await buildEventRow({ ...payload, groupId: payload.groupId }, eventId, 'update');
  const { data, error } = await sb.from('events').update(row).eq('id', eventId).select('*').single();
  if (error) throw new Error(error.message);
  return rowToEvent(data);
}

function mapTicketStatus(status) {
  const s = String(status || 'Active').toLowerCase();
  if (s.includes('sold')) return 'Sold out';
  if (s.includes('pause')) return 'Paused';
  return 'Active';
}

async function createTicket({
  eventId,
  name,
  price,
  description,
  status,
  quantityAvailable,
  saleEnd,
  saleStart,
}) {
  const sb = getSupabaseAdmin();
  const priceNum = parseFloat(String(price || '0').replace(/[^0-9.]/g, '')) || 0;
  const qty =
    quantityAvailable != null && quantityAvailable !== ''
      ? Number(quantityAvailable)
      : null;
  const row = {
    event_id: eventId,
    name: name || 'Ticket',
    description: description || null,
    price: priceNum,
    quantity: Number.isFinite(qty) ? qty : null,
    status: mapTicketStatus(status),
    sale_starts_at: saleStart || null,
    sale_ends_at: saleEnd || null,
  };
  const { data, error } = await sb.from('tickets').insert(row).select('*').single();
  if (error) throw new Error(error.message);
  return rowToTicket(data);
}

/** Same shape as Airtable API: { eventIds, tickets } */
async function createTicketsForEvents({ eventIds, tickets }) {
  const ids = Array.isArray(eventIds) ? eventIds.filter(Boolean) : [];
  const tiers = Array.isArray(tickets) ? tickets : [];
  if (!ids.length || !tiers.length) return { created: 0, tickets: [] };

  const out = [];
  for (const eventId of ids) {
    for (const tier of tiers) {
      out.push(
        await createTicket({
          eventId,
          name: tier.name,
          price: tier.price,
          description: tier.description,
          status: tier.status,
          quantityAvailable: tier.quantityAvailable,
          saleEnd: tier.saleEnd,
          saleStart: tier.saleStart,
        })
      );
    }
  }
  return { created: out.length, tickets: out };
}

async function enrichGroupForDashboard(group, session, adminView) {
  const events = await listEventsForSession(session, [group.id], [], adminView);
  const tickets = await listTicketsForSession(
    session,
    events.map((e) => e.id),
    adminView
  );
  return enrichOrganiserOverview([group], events, tickets).groups[0];
}

async function getOrganiserWorkspace(req) {
  const { requireOrganiserSession } = require('./organiser');
  const wsAuth = requireOrganiserSession(req);
  if (!wsAuth.ok) return wsAuth;

  const { session } = wsAuth;
  const isAdmin = sbOrg.isPlatformAdmin(session);
  const personalScope = isAdmin && organiserPersonalScopeFromRequest(req);
  const adminView = isAdmin && !personalScope;

  let displayName = session.name || '';
  try {
    const user = await findUserByEmail(session.email);
    if (user && user.name) displayName = user.name;
  } catch {
    /* ignore */
  }

  let groups = [];
  let groupsError = null;
  try {
    groups = await sbOrg.listGroupsForSession(session, adminView);
  } catch (e) {
    groupsError = e.message;
  }

  const groupIds = groups.map((g) => g.id);
  let events = [];
  try {
    events = await listEventsForSession(session, groupIds, [], adminView);
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
      role: session.role,
      sub: session.sub,
    },
  };
}

function airtableSetupHint() {
  return null;
}

module.exports = {
  listEventsForSession,
  listEventsForOrganiser,
  listTicketsForEventIds,
  listTicketsForSession,
  getEventById,
  createEvent,
  updateEvent,
  createTicket,
  createTicketsForEvents,
  enrichGroupForDashboard,
  enrichOrganiserOverview,
  getOrganiserWorkspace,
  airtableSetupHint,
  rowToEvent,
};
