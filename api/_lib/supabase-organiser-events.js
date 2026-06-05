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

const { plainEventDescription, mapAttendeeExtrasToRow } = require('./event-description');

function rowToEvent(row) {
  if (!row) return null;
  const dateIso = row.starts_at ? String(row.starts_at) : '';
  const eventStatus = row.status || (row.approval_status === 'Approved' ? 'published' : 'draft');
  return {
    id: row.id,
    title: String(row.title || 'Untitled event').trim(),
    date: dateIso,
    endDate: row.ends_at ? String(row.ends_at) : '',
    type: String(row.event_type || '').trim(),
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
    imageUrl: String(row.photo_url || '').trim(),
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
  // For the common case (single organiser), prefer a simple equality filter.
  // This matches the dashboard behaviour and avoids `IN (...)` edge cases.
  let query = sb.from('events').select('*');
  if (ids.length === 1) query = query.eq('organiser_id', ids[0]);
  else query = query.in('organiser_id', ids);
  const { data, error } = await query.order('starts_at', { ascending: true });
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

function mapEventStatus(payload) {
  const ls = String(payload.listingStatus || payload.status || '').toLowerCase();
  if (ls === 'published' || ls === 'publish' || ls === 'live') return 'published';
  if (ls === 'unpublished' || ls === 'unpublish') return 'unpublished';
  return 'draft';
}

async function buildEventRow(payload, eventId, mode) {
  const touchDate = mode !== 'update' || payloadTouchesDate(payload);
  const photo_url = await resolveEventPhotoUrl(payload, eventId);
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
async function createTicketsForEvents({ eventIds, tickets, publish, refund }) {
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
  try {
    const { archivePastPublishedEvents } = require('./supabase-organiser-payouts');
    await archivePastPublishedEvents(groupIds);
  } catch {
    /* archive helper optional */
  }
  let events = [];
  try {
    events = await listEventsForSession(session, groupIds, [], adminView);
  } catch (e) {
    return { ok: false, status: 500, error: 'events_fetch_failed', message: e.message, groups };
  }

  const eventIds = events.map((e) => e.id);
  const tickets = await listTicketsForSession(session, eventIds, adminView);
  let overview = enrichOrganiserOverview(groups, events, tickets);

  try {
    const { enrichEventsWithPayoutData } = require('./supabase-organiser-payouts');
    overview = {
      ...overview,
      events: await enrichEventsWithPayoutData(overview.events),
    };
  } catch {
    /* payout tables may not exist yet */
  }

  let access = null;
  try {
    access = await resolveOrganiserAccess(session);
  } catch {
    access = null;
  }

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
  listEventsForSession,
  listEventsForOrganiser,
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
