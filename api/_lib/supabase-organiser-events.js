/**
 * Organiser events + tickets + dashboard workspace — Supabase.
 */
const { getSupabaseAdmin } = require('./supabase');
const { resolveImageUrl } = require('./supabase-storage');
const { isAdminRole } = require('./auth');
const { findUserByEmail } = require('./supabase-auth');
const { hubViewFromRequest, organiserPersonalScopeFromRequest } = require('./auth');

const sbOrg = require('./supabase-organiser');
const { geocodeUkPostcode } = require('./postcode-geocode');
const { resolveOrganiserAccess } = require('./supabase-organiser-access');

const WORKSPACE_EVENTS_LIMIT_DEFAULT = 100;
const WORKSPACE_EVENTS_LIMIT_MAX = 250;
const WORKSPACE_UPCOMING_LIMIT = 20;

function parseWorkspaceEventsQuery(req) {
  const limitRaw = parseInt(String(req?.query?.eventsLimit || ''), 10);
  const offsetRaw = parseInt(String(req?.query?.eventsOffset || ''), 10);
  const limit = Math.min(
    Math.max(Number.isFinite(limitRaw) ? limitRaw : WORKSPACE_EVENTS_LIMIT_DEFAULT, 1),
    WORKSPACE_EVENTS_LIMIT_MAX
  );
  const offset = Math.max(Number.isFinite(offsetRaw) ? offsetRaw : 0, 0);
  return { limit, offset };
}

function formatMoney(amount) {
  const n = Number(amount) || 0;
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const { normalizeEventType } = require('./event-types');
const { ukOutcode } = require('./supabase-events');

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

const { plainEventDescription, mapAttendeeExtrasToRow } = require('./event-description');
const { eventImageUrl, eventImageDbValue } = require('./event-image');

function rowToEvent(row) {
  if (!row) return null;
  const dateIso = row.starts_at ? String(row.starts_at) : '';
  const eventStatus = row.status || (row.approval_status === 'Approved' ? 'published' : 'draft');
  return {
    id: row.id,
    title: String(row.title || 'Untitled event').trim(),
    date: dateIso,
    endDate: row.ends_at ? String(row.ends_at) : '',
    type: normalizeEventType(row.event_type || ''),
    industry: Array.isArray(row.industries) ? row.industries[0] || '' : '',
    ownerEmail: '',
    organiserGroupIds: row.organiser_id ? [row.organiser_id] : [],
    organiserGroupId: row.organiser_id || '',
    description: plainEventDescription(row.description),
    slug: row.slug ? String(row.slug).trim() : null,
    foodIncluded: Boolean(row.food_included),
    collectDietary: Boolean(row.collect_dietary),
    collectAccessibility: Boolean(row.collect_accessibility),
    location: String(row.location_label || row.city || row.venue || '').trim(),
    venue: String(row.venue || '').trim(),
    addressLine1: String(row.address || '').trim(),
    city: String(row.city || '').trim(),
    postcode: String(row.postcode || '').trim(),
    eventFormat: String(row.meeting_type || '').trim(),
    onlinePlatform: '',
    onlineLink: String(row.meeting_link || '').trim(),
    imageUrl: eventImageUrl(row),
    status: eventStatus,
    statusRaw: row.approval_status || 'Pending Review',
    listingStatus: eventStatus,
    approvalStatus: row.approval_status || 'Pending Review',
    recurrencePattern: row.recurrence_pattern || null,
    recurrenceEndDate: row.recurrence_end_date || null,
    maxAttendees: row.max_attendees != null ? Number(row.max_attendees) : null,
    locked: Boolean(row.locked),
    lockedReason: row.locked_reason || null,
    lockedAt: row.locked_at || null,
    payoutHeld: Boolean(row.payout_held),
    refundPolicy: row.refund_policy || null,
    refundPolicyDetails: row.refund_policy_details || null,
    refundCutoffDays: row.refund_cutoff_days != null ? Number(row.refund_cutoff_days) : null,
    refundTermsAgreed: Boolean(row.refund_terms_agreed),
    vatTreatment: row.vat_treatment || null,
    lat: row.latitude != null ? Number(row.latitude) : null,
    lng: row.longitude != null ? Number(row.longitude) : null,
    rating: row.average_rating != null ? Number(row.average_rating) : null,
    ticketsSold: 0,
    revenueNum: 0,
    capacity: row.max_attendees != null ? Number(row.max_attendees) : null,
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
    ticketType: row.ticket_type || 'Standard',
    displayOrder: row.display_order != null ? Number(row.display_order) : 0,
    saleStart: row.sale_starts_at || null,
    saleEnd: row.sale_ends_at || null,
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

function deriveListingStatus(statusRaw, dateIso, eventStatus, endDateIso) {
  const st = String(eventStatus || '').toLowerCase();
  if (st === 'cancelled') return { key: 'cancelled', label: 'Cancelled' };
  if (st === 'archived') return { key: 'archived', label: 'Archived' };
  if (st === 'draft') return { key: 'draft', label: 'Draft' };
  if (st === 'unpublished') return { key: 'unpublished', label: 'Unpublished' };
  const raw = String(statusRaw || '').toLowerCase();
  if (/unpublish|reject/.test(raw)) return { key: 'unpublished', label: 'Unpublished' };
  if (/pending|draft/.test(raw)) return { key: 'draft', label: 'Draft' };
  const endRef = endDateIso || dateIso;
  const d = endRef ? new Date(endRef) : dateIso ? new Date(dateIso) : null;
  if (!d || Number.isNaN(d.getTime())) {
    return /approved|published/.test(raw) || st === 'published'
      ? { key: 'live', label: 'Live' }
      : { key: 'draft', label: 'Draft' };
  }
  if (d > new Date()) return { key: 'upcoming', label: 'Upcoming' };
  if (st === 'published' || /approved|published/.test(raw)) {
    return { key: 'archived', label: 'Archived' };
  }
  return { key: 'live', label: 'Live' };
}

function enrichOrganiserOverview(groups, events, tickets, groupEventCounts) {
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
    const status = deriveListingStatus(
      ev.statusRaw,
      ev.date,
      ev.status || ev.listingStatus,
      ev.endDate
    );
    return {
      ...ev,
      ticketsSold: sold,
      ticketsCapacity: capacity,
      ticketsSoldLabel:
        capacity > 0 ? `${sold} / ${capacity}` : sold > 0 ? String(sold) : '0',
      revenueNum,
      revenueDisplay: formatMoney(revenueNum),
      statusKey: status.key,
      statusLabel: status.label,
    };
  });

  const enrichedGroups = groups.map((g) => {
    const groupEvents = enrichedEvents.filter((ev) => eventBelongsToGroup(ev, g.id));
    const eventsListed =
      groupEventCounts && typeof groupEventCounts.get === 'function'
        ? groupEventCounts.get(g.id) || 0
        : groupEvents.length;
    const revenueNum = groupEvents.reduce((sum, ev) => sum + (Number(ev.revenueNum) || 0), 0);
    const status = deriveGroupListingStatus(g.statusRaw);
    return {
      ...g,
      eventsListed,
      revenueNum,
      revenueDisplay: formatMoney(revenueNum),
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

async function listEventIdsForOrganiserGroups(groupIds, allEvents) {
  const ids = groupIds || [];
  if (!ids.length && !allEvents) return [];
  const sb = getSupabaseAdmin();
  let query = sb.from('events').select('id');
  if (!allEvents) {
    if (ids.length === 1) query = query.eq('organiser_id', ids[0]);
    else query = query.in('organiser_id', ids);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []).map((row) => row.id).filter(Boolean);
}

async function listEventSummariesForOrganiserGroups(groupIds, allEvents) {
  const ids = groupIds || [];
  if (!ids.length && !allEvents) return [];
  const sb = getSupabaseAdmin();
  let query = sb.from('events').select('id, title, organiser_id, starts_at').order('starts_at', {
    ascending: false,
  });
  if (!allEvents) {
    if (ids.length === 1) query = query.eq('organiser_id', ids[0]);
    else query = query.in('organiser_id', ids);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    id: row.id,
    title: String(row.title || 'Untitled event').trim(),
    organiserId: row.organiser_id || null,
  }));
}

function applyGroupSalesSummary(groups, summary) {
  if (!summary?.computed || !groups?.length) return groups;
  const revenueByGroupId = summary.revenueByGroupId || {};
  return groups.map((g) => {
    const revenueNum = Math.round((Number(revenueByGroupId[g.id]) || 0) * 100) / 100;
    return {
      ...g,
      revenueNum,
      revenueDisplay: formatMoney(revenueNum),
    };
  });
}

async function countEventsForOrganiser(groupIds) {
  const sb = getSupabaseAdmin();
  const ids = groupIds || [];
  if (!ids.length) return 0;
  let query = sb.from('events').select('id', { count: 'exact', head: true });
  if (ids.length === 1) query = query.eq('organiser_id', ids[0]);
  else query = query.in('organiser_id', ids);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count || 0;
}

async function countEventsByOrganiserGroup(groupIds) {
  const counts = new Map();
  const ids = [...new Set((groupIds || []).filter(Boolean))];
  ids.forEach((id) => counts.set(id, 0));
  if (!ids.length) return counts;

  const sb = getSupabaseAdmin();
  const CHUNK = 100;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { data, error } = await sb.from('events').select('organiser_id').in('organiser_id', chunk);
    if (error) throw new Error(error.message);
    (data || []).forEach((row) => {
      const orgId = row.organiser_id;
      if (!orgId) return;
      counts.set(orgId, (counts.get(orgId) || 0) + 1);
    });
  }
  return counts;
}

async function listEventsForOrganiser(email, groupIds, options) {
  const sb = getSupabaseAdmin();
  const ids = groupIds || [];
  const opts = options && typeof options === 'object' ? options : {};
  if (!ids.length && !opts.allEvents) return [];

  let query = sb.from('events').select('*');
  if (!opts.allEvents) {
    if (ids.length === 1) query = query.eq('organiser_id', ids[0]);
    else query = query.in('organiser_id', ids);
  }
  const orderAsc = opts.orderAsc !== false;
  query = query.order('starts_at', { ascending: orderAsc, nullsFirst: false });
  if (opts.limit != null) {
    const offset = Math.max(Number(opts.offset) || 0, 0);
    const limit = Math.max(Number(opts.limit) || 1, 1);
    query = query.range(offset, offset + limit - 1);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []).map(rowToEvent);
}

async function listUpcomingEventsForOrganiser(groupIds, limit) {
  const sb = getSupabaseAdmin();
  const ids = groupIds || [];
  const max = Math.max(Number(limit) || WORKSPACE_UPCOMING_LIMIT, 1);
  if (!ids.length) return [];

  let query = sb.from('events').select('*');
  if (ids.length === 1) query = query.eq('organiser_id', ids[0]);
  else query = query.in('organiser_id', ids);
  query = query.order('starts_at', { ascending: true, nullsFirst: false }).limit(Math.max(max * 4, max));
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const cutoff = Date.now() - 86400000;
  return (data || [])
    .map(rowToEvent)
    .filter((ev) => {
      if (!ev.date) return true;
      const d = new Date(ev.date);
      return !Number.isNaN(d.getTime()) && d.getTime() >= cutoff;
    })
    .slice(0, max);
}

async function listEventsForSession(session, groupIds, _organiserRecords, adminView, options) {
  if (adminView) {
    if (options && options.limit != null) {
      return listEventsForOrganiser(session.email, groupIds, { ...options, allEvents: true });
    }
    return listAllOrganiserEvents();
  }
  return listEventsForOrganiser(session.email, groupIds, options);
}

async function listTicketsForEventIds(eventIds) {
  const sb = getSupabaseAdmin();
  const ids = (eventIds || []).filter(Boolean);
  if (!ids.length) return [];
  const CHUNK = 100;
  const rows = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { data, error } = await sb.from('tickets').select('*').in('event_id', chunk);
    if (error) throw new Error(error.message);
    if (data?.length) rows.push(...data);
  }
  return rows.map(rowToTicket);
}

async function listAllOrganiserTickets() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('tickets').select('*');
  if (error) throw new Error(error.message);
  return (data || []).map(rowToTicket);
}

async function listTicketsForSession(session, eventIds, adminView) {
  const ids = eventIds || [];
  if (adminView && !ids.length) return listAllOrganiserTickets();
  return listTicketsForEventIds(ids);
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

function mapEventStatus(payload) {
  const ls = String(payload.listingStatus || payload.status || '').toLowerCase();
  if (ls === 'published' || ls === 'publish' || ls === 'live') return 'published';
  if (ls === 'unpublished' || ls === 'unpublish') return 'unpublished';
  return 'draft';
}

async function buildEventRow(payload, eventId, mode) {
  const touchDate = mode !== 'update' || payloadTouchesDate(payload);
  const image_url = await resolveEventPhotoUrl(payload, eventId);
  const isLocked = Boolean(payload._locked);
  const listingStatus = payload.listingStatus != null ? payload.listingStatus : null;
  const approval_status =
    listingStatus != null
      ? mapApprovalStatus(listingStatus)
      : payload.publish === true
        ? 'Approved'
        : undefined;

  const row = {
    title: payload.title,
    description: plainEventDescription(payload.description) || null,
    organiser_id: payload.groupId || null,
  };

  if (payload.attendeeExtras && typeof payload.attendeeExtras === 'object') {
    Object.assign(row, mapAttendeeExtrasToRow(payload.attendeeExtras));
  }

  if (!isLocked) {
    row.event_type = mapEventType(payload.type);
    row.meeting_type = mapMeetingType(payload.eventFormat);
    row.venue = payload.venue || null;
    row.address = payload.addressLine1 || payload.fullAddress || null;
    row.city = payload.city || null;
    row.postcode = payload.postcode || null;
    row.outcode = ukOutcode(payload.postcode) || null;
    row.location_label = payload.location || payload.city || payload.venue || null;
  }

  row.meeting_link = payload.onlineLink || null;

  if (payload.industry) {
    row.industries = [String(payload.industry).trim()];
  }
  if (payload.maxAttendees != null && payload.maxAttendees !== '') {
    const cap = Number(payload.maxAttendees);
    row.max_attendees = Number.isFinite(cap) ? cap : null;
  }
  if (payload.recurrencePattern) {
    row.recurrence_pattern = payload.recurrencePattern;
  }
  if (payload.recurrenceEndDate) {
    row.recurrence_end_date = payload.recurrenceEndDate;
  }

  if (!isLocked && touchDate) {
    const dates = parseDateIso(payload.date, payload.endDate);
    row.starts_at = dates.starts_at;
    row.ends_at = dates.ends_at;
  } else if (!isLocked && mode === 'create') {
    const dates = parseDateIso(payload.date, payload.endDate);
    row.starts_at = dates.starts_at;
    row.ends_at = dates.ends_at;
  }

  if (!isLocked && payload.postcode) {
    const geo = await geocodeUkPostcode(payload.postcode);
    if (geo) {
      if (geo.latitude != null) row.latitude = geo.latitude;
      if (geo.longitude != null) row.longitude = geo.longitude;
      if (!row.city && geo.city) row.city = geo.city;
    }
  }

  if (listingStatus != null) {
    row.status = mapEventStatus(payload);
  } else if (mode === 'create') {
    row.status = 'draft';
  }

  if (approval_status !== undefined) row.approval_status = approval_status;
  else if (mode === 'create') row.approval_status = 'Pending Review';

  if (image_url !== undefined) row.image_url = eventImageDbValue(image_url);
  else if (mode === 'create') row.image_url = null;

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
  const { data: existing } = await sb.from('events').select('*').eq('id', eventId).maybeSingle();
  const patchPayload = { ...payload, groupId: payload.groupId };
  if (existing && existing.locked) {
    patchPayload._locked = true;
    patchPayload.type = existing.event_type;
    patchPayload.eventFormat = existing.meeting_type;
    patchPayload.venue = existing.venue;
    patchPayload.addressLine1 = existing.address;
    patchPayload.city = existing.city;
    patchPayload.postcode = existing.postcode;
    patchPayload.date = existing.starts_at;
    patchPayload.endDate = existing.ends_at;
    patchPayload.location = existing.location_label;
  }
  const row = await buildEventRow(patchPayload, eventId, 'update');
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
  oneSeatOnly,
  displayOrder,
  ticketType,
}) {
  const sb = getSupabaseAdmin();
  const priceNum = parseFloat(String(price || '0').replace(/[^0-9.]/g, '')) || 0;
  const qty =
    quantityAvailable != null && quantityAvailable !== ''
      ? Number(quantityAvailable)
      : null;
  const type =
    ticketType ||
    (oneSeatOnly || /application/i.test(String(name || '')) ? 'Application-based' : 'Standard');
  const row = {
    event_id: eventId,
    name: name || 'Ticket',
    description: description || null,
    price: priceNum,
    quantity: Number.isFinite(qty) ? qty : null,
    status: mapTicketStatus(status),
    sale_starts_at: saleStart || null,
    sale_ends_at: saleEnd || null,
    ticket_type: type,
    display_order: displayOrder != null ? Number(displayOrder) : 0,
  };
  const { data, error } = await sb.from('tickets').insert(row).select('*').single();
  if (error) throw new Error(error.message);
  return rowToTicket(data);
}

/** Browse page requires organiser listing_status not draft — auto-publish when events go live. */
async function publishOrganiserListingsForEventIds(sb, eventRows) {
  const organiserIds = [
    ...new Set((eventRows || []).map((row) => row.organiser_id).filter(Boolean)),
  ];
  if (!organiserIds.length) return;

  const { error } = await sb
    .from('organisers')
    .update({ listing_status: 'published' })
    .in('id', organiserIds)
    .or('listing_status.eq.draft,listing_status.is.null');
  if (error) throw new Error(error.message);
}

async function updateEventVatTreatment(eventIds, vatTreatment) {
  const value = String(vatTreatment || '').trim();
  if (!value || !['included', 'added'].includes(value)) return;
  const sb = getSupabaseAdmin();
  const ids = (eventIds || []).filter(Boolean);
  if (!ids.length) return;
  const { error } = await sb.from('events').update({ vat_treatment: value }).in('id', ids);
  if (error) throw new Error(error.message);
}

async function publishEventsWithRefund(eventIds, refundPayload) {
  const sb = getSupabaseAdmin();
  const { ensureEventSlug } = require('./event-slug');
  const ids = (eventIds || []).filter(Boolean);
  if (!ids.length) {
    const e = new Error('No events to publish');
    e.status = 400;
    throw e;
  }
  const patch = {
    status: 'published',
    approval_status: 'Approved',
    refund_policy: refundPayload.refundPolicy || null,
    refund_policy_details: refundPayload.refundPolicyDetails || null,
    refund_cutoff_days:
      refundPayload.refundCutoffDays != null ? Number(refundPayload.refundCutoffDays) : null,
    refund_terms_agreed: Boolean(refundPayload.refundTermsAgreed),
    refund_terms_agreed_at: refundPayload.refundTermsAgreed ? new Date().toISOString() : null,
  };
  if (refundPayload.vatTreatment) {
    patch.vat_treatment = refundPayload.vatTreatment;
  }

  const { data: existing, error: loadErr } = await sb
    .from('events')
    .select('id, title, slug')
    .in('id', ids);
  if (loadErr) throw new Error(loadErr.message);

  const updated = [];
  for (const row of existing || []) {
    const slug = await ensureEventSlug(sb, {
      title: row.title,
      eventId: row.id,
      currentSlug: row.slug,
    });
    const { data, error } = await sb
      .from('events')
      .update({ ...patch, slug })
      .eq('id', row.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    if (data) updated.push(data);
  }

  await publishOrganiserListingsForEventIds(sb, updated);
  return updated.map(rowToEvent);
}

/** Same shape as Airtable API: { eventIds, tickets, publish, refund } */
async function createTicketsForEvents({ eventIds, tickets, publish, refund, vatTreatment }) {
  const ids = Array.isArray(eventIds) ? eventIds.filter(Boolean) : [];
  const tiers = Array.isArray(tickets) ? tickets : [];
  if (!ids.length || !tiers.length) return { created: 0, tickets: [] };

  if (vatTreatment) {
    await updateEventVatTreatment(ids, vatTreatment);
  }

  const sb = getSupabaseAdmin();
  const { error: deleteErr } = await sb.from('tickets').delete().in('event_id', ids);
  if (deleteErr) throw new Error(deleteErr.message);

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
          oneSeatOnly: tier.oneSeatOnly,
          displayOrder: tier.displayOrder,
          ticketType: tier.ticketType,
        })
      );
    }
  }

  let publishedEvents = null;
  if (publish && refund) {
    publishedEvents = await publishEventsWithRefund(ids, refund);
  }

  return { created: out.length, tickets: out, publishedEvents };
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

async function countAllEvents() {
  const sb = getSupabaseAdmin();
  const { count, error } = await sb.from('events').select('id', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  return count || 0;
}

async function loadOrganiserEventsPage(session, groups, groupIds, adminView, pagination) {
  const { limit, offset } = pagination;

  const [groupEventCounts, upcomingRaw, total] = await Promise.all([
    countEventsByOrganiserGroup(groupIds),
    listUpcomingEventsForOrganiser(groupIds, WORKSPACE_UPCOMING_LIMIT),
    adminView ? countAllEvents() : countEventsForOrganiser(groupIds),
  ]);

  const events = await listEventsForSession(session, groupIds, [], adminView, {
    limit,
    offset,
    orderAsc: false,
    allEvents: adminView,
  });

  const eventIds = events.map((e) => e.id);
  const upcomingIds = upcomingRaw.map((e) => e.id);
  const ticketEventIds = [...new Set([...eventIds, ...upcomingIds])];
  const tickets = await listTicketsForSession(session, ticketEventIds, adminView);
  let overview = enrichOrganiserOverview(groups, events, tickets, groupEventCounts);
  const upcomingOverview = enrichOrganiserOverview(groups, upcomingRaw, tickets, groupEventCounts);

  try {
    const { enrichOrganiserWorkspaceSales, enrichEventsWithRegistrationSales } = require('./supabase-organiser-payouts');
    const sales = await enrichOrganiserWorkspaceSales(overview.events, tickets);
    overview = {
      ...overview,
      events: sales.events,
      groups: enrichOrganiserOverview(groups, sales.events, sales.tickets, groupEventCounts).groups,
    };
    const { enrichEventsWithPayoutData } = require('./supabase-organiser-payouts');
    upcomingOverview.events = await enrichEventsWithPayoutData(upcomingOverview.events);
    tickets = sales.tickets;
  } catch {
    try {
      const { enrichEventsWithRegistrationSales, enrichTicketsWithSales, listRegistrationsForEvents } =
        require('./supabase-organiser-payouts');
      const enrichedEvents = await enrichEventsWithRegistrationSales(overview.events);
      const regs = await listRegistrationsForEvents([
        ...new Set([
          ...enrichedEvents.map((e) => e.id),
          ...upcomingOverview.events.map((e) => e.id),
        ]),
      ]);
      overview = {
        ...overview,
        events: enrichedEvents,
        groups: enrichOrganiserOverview(groups, enrichedEvents, tickets, groupEventCounts).groups,
      };
      upcomingOverview.events = await enrichEventsWithRegistrationSales(upcomingOverview.events);
      tickets = enrichTicketsWithSales(tickets, regs);
    } catch {
      /* registration enrichment optional */
    }
  }

  return {
    groups: overview.groups,
    events: overview.events,
    upcomingEvents: upcomingOverview.events,
    tickets,
    eventsPagination: {
      total,
      limit,
      offset,
      hasMore: offset + events.length < total,
    },
  };
}

async function getOrganiserWorkspace(req) {
  const { requireOrganiserSession } = require('./organiser');
  const wsAuth = requireOrganiserSession(req);
  if (!wsAuth.ok) return wsAuth;

  const { session } = wsAuth;
  const isAdmin = sbOrg.isPlatformAdmin(session);
  const personalScope = isAdmin && organiserPersonalScopeFromRequest(req);
  const adminView = isAdmin && !personalScope;
  const eventsPaginationQuery = parseWorkspaceEventsQuery(req);

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
  const eventsOnly = String(req.query?.eventsOnly || '') === '1';

  if (eventsOnly) {
    try {
      const page = await loadOrganiserEventsPage(
        session,
        groups,
        groupIds,
        adminView,
        eventsPaginationQuery
      );
      return {
        ok: true,
        session,
        groups: page.groups,
        events: page.events,
        upcomingEvents: page.upcomingEvents,
        tickets: page.tickets,
        eventsPagination: page.eventsPagination,
      };
    } catch (e) {
      return { ok: false, status: 500, error: 'events_fetch_failed', message: e.message, groups };
    }
  }

  try {
    const { archivePastPublishedEvents } = require('./supabase-organiser-payouts');
    await archivePastPublishedEvents(groupIds);
  } catch {
    /* archive helper optional */
  }

  let events = [];
  let upcomingEvents = [];
  let tickets = [];
  let eventsPagination = {
    total: 0,
    limit: eventsPaginationQuery.limit,
    offset: eventsPaginationQuery.offset,
    hasMore: false,
  };
  let overviewGroups = groups;

  try {
    const page = await loadOrganiserEventsPage(
      session,
      groups,
      groupIds,
      adminView,
      eventsPaginationQuery
    );
    overviewGroups = page.groups;
    events = page.events;
    upcomingEvents = page.upcomingEvents;
    tickets = page.tickets;
    eventsPagination = page.eventsPagination;
  } catch (e) {
    return { ok: false, status: 500, error: 'events_fetch_failed', message: e.message, groups };
  }

  let access = null;
  try {
    access = await resolveOrganiserAccess(session);
  } catch {
    access = null;
  }

  let workspaceSummary = null;
  let eventSummaries = [];
  let reviews = [];

  try {
    const { buildOrganiserWorkspaceSummary } = require('./supabase-organiser-payouts');
    workspaceSummary = await buildOrganiserWorkspaceSummary(groupIds, adminView);
  } catch {
    workspaceSummary = null;
  }

  try {
    eventSummaries = await listEventSummariesForOrganiserGroups(groupIds, adminView);
  } catch {
    eventSummaries = [];
  }

  try {
    const { listReviewsForOrganiserGroups } = require('./supabase-reviews');
    reviews = await listReviewsForOrganiserGroups(
      groupIds,
      new Map(overviewGroups.map((g) => [g.id, g])),
      adminView
    );
  } catch {
    reviews = [];
  }

  if (workspaceSummary?.computed) {
    overviewGroups = applyGroupSalesSummary(overviewGroups, workspaceSummary);
  }

  try {
    const allEventIds = await listEventIdsForOrganiserGroups(groupIds, adminView);
    if (allEventIds.length) {
      const { enrichTicketsWithSales, listRegistrationsForEvents } = require('./supabase-organiser-payouts');
      const allTickets = await listTicketsForEventIds(allEventIds);
      const regs = await listRegistrationsForEvents(allEventIds);
      tickets = enrichTicketsWithSales(allTickets, regs);
    }
  } catch {
    /* keep page-scoped tickets */
  }

  return {
    ok: true,
    session,
    groups: overviewGroups,
    events,
    upcomingEvents,
    tickets,
    eventsPagination,
    workspaceSummary,
    eventSummaries,
    reviews,
    groupsError,
    hubView: hubViewFromRequest(req),
    adminView,
    personalScope,
    isAdmin,
    canOrganise: groups.length > 0 || adminView,
    organiserRole: access ? access.role : null,
    canManageTeam: access ? access.canManageTeam : true,
    canDeleteEvents: access ? access.canDeleteEvents : true,
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
  WORKSPACE_EVENTS_LIMIT_DEFAULT,
  WORKSPACE_EVENTS_LIMIT_MAX,
  parseWorkspaceEventsQuery,
  countEventsForOrganiser,
  loadOrganiserEventsPage,
  listEventsForSession,
  listEventsForOrganiser,
  listEventIdsForOrganiserGroups,
  listEventSummariesForOrganiserGroups,
  applyGroupSalesSummary,
  listTicketsForEventIds,
  listTicketsForSession,
  getEventById,
  createEvent,
  updateEvent,
  createTicket,
  createTicketsForEvents,
  publishEventsWithRefund,
  enrichGroupForDashboard,
  enrichOrganiserOverview,
  getOrganiserWorkspace,
  airtableSetupHint,
  rowToEvent,
};
