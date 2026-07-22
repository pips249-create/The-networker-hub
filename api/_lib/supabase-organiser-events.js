/**
 * Organiser events + tickets + dashboard workspace — Supabase.
 */
const crypto = require('crypto');
const { getSupabaseAdmin } = require('./supabase');
const { normalizeTicketVisibility } = require('./ticket-visibility');
const { formatTicketsSoldLabel } = require('./tickets-sold-label');
const { resolveImageUrl } = require('./supabase-storage');
const { isAdminRole } = require('./auth');
const { findUserByEmail } = require('./supabase-auth');
const { hubViewFromRequest, organiserPersonalScopeFromRequest } = require('./auth');

const sbOrg = require('./supabase-organiser');
const { geocodeUkPostcode } = require('./postcode-geocode');
const { resolveOrganiserAccess } = require('./supabase-organiser-access');
const { eventHasTicketsOnSale, resolveTierSaleEnd } = require('./ticket-sales');
const { assertTicketsEditableForEvents, loadLockedOrActiveSaleEvents, lockEventOnFirstSale } = require('./event-sale-lock');

const WORKSPACE_EVENTS_LIMIT_DEFAULT = 100;
const WORKSPACE_EVENTS_LIMIT_MAX = 250;
const WORKSPACE_UPCOMING_LIMIT = 20;

function normalizeAttendanceMode(mode) {
  const m = String(mode || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (m === 'osop' || m === 'category_exclusivity') return 'category_exclusivity';
  if (m === 'guest_programme' || m === 'guest_program') return 'guest_programme';
  if (m === 'tickets' || m === 'ticket' || m === 'open' || m === 'standard') return 'tickets';
  return 'tickets';
}

function parseWorkspaceEventsQuery(req) {
  const limitRaw = parseInt(String(req?.query?.eventsLimit || ''), 10);
  const offsetRaw = parseInt(String(req?.query?.eventsOffset || ''), 10);
  const totalRaw = parseInt(String(req?.query?.eventsTotal || ''), 10);
  const limit = Math.min(
    Math.max(Number.isFinite(limitRaw) ? limitRaw : WORKSPACE_EVENTS_LIMIT_DEFAULT, 1),
    WORKSPACE_EVENTS_LIMIT_MAX
  );
  const offset = Math.max(Number.isFinite(offsetRaw) ? offsetRaw : 0, 0);
  const knownTotal = Number.isFinite(totalRaw) && totalRaw > 0 ? totalRaw : null;
  const eventsLite = String(req?.query?.eventsLite || '') === '1';
  return { limit, offset, knownTotal, eventsLite };
}

function scheduleArchivePastPublishedEvents(groupIds) {
  if (!groupIds || !groupIds.length) return;
  try {
    const { archivePastPublishedEvents } = require('./supabase-organiser-payouts');
    archivePastPublishedEvents(groupIds).catch(() => {});
  } catch {
    /* archive helper optional */
  }
}

function formatMoney(amount) {
  const n = Number(amount) || 0;
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function newSeriesGroupId() {
  return crypto.randomUUID();
}

const DUPLICATE_TITLE_SUFFIX_RE = / \(copy\)$/i;

function defaultDuplicateTitle(sourceTitle) {
  const base = String(sourceTitle || 'Event').trim() || 'Event';
  return DUPLICATE_TITLE_SUFFIX_RE.test(base) ? base : base + ' (copy)';
}

/** Block reverting a draft copy to the source title; clear marker after an explicit rename. */
async function applyDuplicateTitleGuard(sb, existingRow, payload) {
  const sourceId = String(existingRow?.duplicated_from_event_id || '').trim();
  if (!sourceId || payload.title == null) return payload;

  const proposed = String(payload.title || '').trim();
  const { data: sourceRow, error } = await sb
    .from('events')
    .select('title')
    .eq('id', sourceId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const sourceTitle = String(sourceRow?.title || '').trim();
  if (!sourceTitle) return payload;

  const sourceKey = sourceTitle.toLowerCase();
  const proposedKey = proposed.toLowerCase();
  const defaultCopyKey = defaultDuplicateTitle(sourceTitle).toLowerCase();

  if (proposedKey === sourceKey) {
    const err = new Error(
      'This draft copy must keep “(copy)” in the title or use a new name — it cannot share the same title as the original event.'
    );
    err.status = 400;
    err.code = 'duplicate_title_matches_source';
    throw err;
  }

  const next = { ...payload };
  if (proposedKey !== defaultCopyKey) {
    next.duplicatedFromEventId = null;
    next._clearDuplicatedFrom = true;
  }
  return next;
}

/** Assign a shared series id when saving multiple dates in one listing. */
function resolveSeriesGroupId(existingSeriesGroupId, occurrenceCount) {
  const existing = String(existingSeriesGroupId || '').trim();
  if (existing) return existing;
  if (Number(occurrenceCount) > 1) return newSeriesGroupId();
  return null;
}

const { normalizeEventType } = require('./event-types');
const { ukOutcode } = require('./supabase-events');
const { deriveLocationFields } = require('./uk-outcode');

function mapEventType(type) {
  return normalizeEventType(type);
}

function mapMeetingType(format) {
  const s = String(format || '').toLowerCase();
  if (s.includes('online') && !s.includes('person')) return 'Online';
  if (s.includes('person') || s.includes('in ')) return 'In person';
  return format ? String(format).trim() : 'In person';
}

function mapApprovalStatus(listingStatus) {
  if (listingStatus == null || listingStatus === '') return undefined;
  const s = String(listingStatus).toLowerCase();
  if (s === 'approved') return 'Approved';
  if (s === 'rejected') return 'Rejected';
  if (s === 'pending review' || s === 'pending') return 'Pending Review';
  return undefined;
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

const {
  plainEventDescription,
  resolveEventDescription,
  mapAttendeeExtrasToRow,
  composeEventDescription,
} = require('./event-description');
const { eventImageUrl, eventImageDbValue, normalizeEventImagePosition } = require('./event-image');
const { isEventCurrentlyFeatured } = require('./event-featured-plans');

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
    description: resolveEventDescription(row),
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
    imagePosition: normalizeEventImagePosition(row.image_position),
    status: eventStatus,
    statusRaw: row.approval_status || 'Pending Review',
    listingStatus: eventStatus,
    approvalStatus: row.approval_status || 'Pending Review',
    recurrencePattern: row.recurrence_pattern || null,
    recurrenceEndDate: row.recurrence_end_date || null,
    seriesGroupId: row.series_group_id || null,
    maxAttendees: row.max_attendees != null ? Number(row.max_attendees) : null,
    locked: Boolean(row.locked),
    lockedReason: row.locked_reason || null,
    lockedAt: row.locked_at || null,
    payoutHeld: Boolean(row.payout_held),
    refundPolicy: row.refund_policy || null,
    refundPolicyDetails: row.refund_policy_details || null,
    refundCutoffDays: row.refund_cutoff_days != null ? Number(row.refund_cutoff_days) : null,
    refundTermsAgreed: Boolean(row.refund_terms_agreed || row.refund_terms_agreed_at),
    refundTermsAgreedAt: row.refund_terms_agreed_at || null,
    vatTreatment: row.vat_treatment || null,
    lat: row.latitude != null ? Number(row.latitude) : null,
    lng: row.longitude != null ? Number(row.longitude) : null,
    rating: row.average_rating != null ? Number(row.average_rating) : null,
    ticketsSold: 0,
    revenueNum: 0,
    capacity: row.max_attendees != null ? Number(row.max_attendees) : null,
    ticketSalesEnabled: row.ticket_sales_enabled === true,
    attendanceMode: normalizeAttendanceMode(row.attendance_mode),
    alumniFastPassEnabled: Boolean(row.alumni_fast_pass_enabled),
    alumniSourceEventId: row.alumni_source_event_id || null,
    duplicatedFromEventId: row.duplicated_from_event_id || null,
    guestPassesDisabled: Boolean(row.guest_passes_disabled),
    featured: isEventCurrentlyFeatured(row),
    featuredUntil: row.featured_until || null,
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
    visibility: normalizeTicketVisibility(row.visibility),
    seriesScope: String(row.series_scope || 'date').trim() === 'series_pass' ? 'series_pass' : 'date',
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
  const approval = String(statusRaw || '').trim();
  if (st === 'cancelled') return { key: 'cancelled', label: 'Cancelled' };
  if (st === 'archived') return { key: 'archived', label: 'Archived' };
  if (st === 'draft') return { key: 'draft', label: 'Draft' };
  if (st === 'unpublished') return { key: 'unpublished', label: 'Unpublished' };

  // Past published listings are archived for filters/UI even when approval is still
  // Pending Review — matches archivePastPublishedEvents and the Events list.
  // Prefer a normal ends_at; if ends_at is far after starts_at (series/bad data),
  // use the start date so past occurrences don't stay "upcoming".
  const startMs = dateIso ? new Date(dateIso).getTime() : NaN;
  const endMs = endDateIso ? new Date(endDateIso).getTime() : NaN;
  const startOk = !Number.isNaN(startMs);
  const endOk = !Number.isNaN(endMs);
  let anchorMs = null;
  if (endOk && startOk && endMs - startMs >= 0 && endMs - startMs <= 36 * 60 * 60 * 1000) {
    anchorMs = endMs;
  } else if (startOk) {
    anchorMs = startMs;
  } else if (endOk) {
    anchorMs = endMs;
  }
  const hasDate = anchorMs != null;
  const isPast = hasDate && anchorMs <= Date.now();
  if (st === 'published' && isPast) {
    return { key: 'archived', label: 'Archived' };
  }

  if (st === 'published' && approval === 'Pending Review') {
    return { key: 'pending_approval', label: 'Incomplete listing' };
  }
  if (st === 'published' && approval === 'Rejected') {
    return { key: 'unpublished', label: 'Rejected' };
  }
  const raw = String(statusRaw || '').toLowerCase();
  if (/unpublish|reject/.test(raw)) return { key: 'unpublished', label: 'Unpublished' };
  if (/pending|draft/.test(raw)) return { key: 'draft', label: 'Draft' };
  if (!hasDate) {
    return /approved|published/.test(raw) || st === 'published'
      ? { key: 'live', label: 'Live' }
      : { key: 'draft', label: 'Draft' };
  }
  if (!isPast) return { key: 'upcoming', label: 'Upcoming' };
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
      ticketsSoldLabel: formatTicketsSoldLabel(sold, capacity),
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

async function listEventsForSeriesGroup(groupIds, seriesGroupId) {
  const groups = (groupIds || []).filter(Boolean);
  const gid = String(seriesGroupId || '').trim();
  if (!groups.length || !gid) return [];

  const sb = getSupabaseAdmin();
  let query = sb
    .from('events')
    .select('id, title, starts_at, ends_at, image_url, image_position, series_group_id, organiser_id, status')
    .eq('series_group_id', gid)
    .in('status', ['draft', 'published', 'unpublished'])
    .order('starts_at', { ascending: true });
  if (groups.length === 1) query = query.eq('organiser_id', groups[0]);
  else query = query.in('organiser_id', groups);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []).map(rowToEvent);
}

async function listEventSummariesForOrganiserGroups(groupIds, allEvents) {
  const ids = groupIds || [];
  if (!ids.length && !allEvents) return [];
  const sb = getSupabaseAdmin();
  let query = sb
    .from('events')
    .select('id, title, organiser_id, starts_at, ends_at, status, approval_status')
    .order('starts_at', {
      ascending: false,
    });
  if (!allEvents) {
    if (ids.length === 1) query = query.eq('organiser_id', ids[0]);
    else query = query.in('organiser_id', ids);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []).map((row) => {
    const listingStatus = deriveListingStatus(
      row.approval_status,
      row.starts_at,
      row.status,
      row.ends_at
    );
    return {
      id: row.id,
      title: String(row.title || 'Untitled event').trim(),
      organiserId: row.organiser_id || null,
      date: row.starts_at || null,
      endDate: row.ends_at || null,
      statusKey: listingStatus.key,
      statusLabel: listingStatus.label,
    };
  });
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

/** Enrich lean-bootstrap groups with event counts, revenue, and membership stats. */
function enrichGroupsFromLeanData(groups, eventSummaries, workspaceSummary, rosterSummaries) {
  const eventsByGroup = new Map();
  (eventSummaries || []).forEach((ev) => {
    const orgId = ev.organiserId;
    if (!orgId) return;
    eventsByGroup.set(orgId, (eventsByGroup.get(orgId) || 0) + 1);
  });

  let enriched = (groups || []).map((g) => {
    const status = deriveGroupListingStatus(g.statusRaw);
    const eventsListed = eventsByGroup.get(g.id) || 0;
    const rosterSummary =
      rosterSummaries && rosterSummaries.get
        ? rosterSummaries.get(g.id) || { active: 0, unclaimed: 0, expiringSoon: 0 }
        : g.rosterSummary || { active: 0, unclaimed: 0, expiringSoon: 0 };
    return {
      ...g,
      eventsListed,
      rosterSummary,
      statusKey: status.key,
      statusLabel: status.label,
      revenueDisplay: g.revenueDisplay || formatMoney(g.revenueNum || 0),
    };
  });

  if (workspaceSummary?.computed) {
    enriched = applyGroupSalesSummary(enriched, workspaceSummary);
  }

  return enriched;
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
  return rows.map((row) => rowToTicket(row));
}

async function listAllOrganiserTickets() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('tickets').select('*');
  if (error) throw new Error(error.message);
  return (data || []).map((row) => rowToTicket(row));
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
  const event = rowToEvent(data);
  if (event.duplicatedFromEventId) {
    const { data: sourceRow, error: sourceErr } = await sb
      .from('events')
      .select('title')
      .eq('id', event.duplicatedFromEventId)
      .maybeSingle();
    if (sourceErr) throw new Error(sourceErr.message);
    if (sourceRow?.title) {
      event.duplicateSourceTitle = String(sourceRow.title).trim();
    }
  }
  return event;
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
      throw new Error('Could not upload event photo');
    } catch (e) {
      const err = new Error(e.message || 'Could not upload event photo');
      err.logoWarning = err.message;
      throw err;
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'photoUrl')) {
    const url = eventImageDbValue(payload.photoUrl);
    if (url) return url;
    if (payload.clearPhoto) return null;
    return undefined;
  }
  return undefined;
}

async function applyEventPhotoAfterSave(eventId, payload) {
  const hasUpload = Boolean(payload.photoBase64);
  const hasUrl = Object.prototype.hasOwnProperty.call(payload, 'photoUrl');
  if (!hasUpload && !hasUrl) return null;

  const image_url = await resolveEventPhotoUrl(payload, eventId);
  if (image_url === undefined) return null;

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('events')
    .update({ image_url: eventImageDbValue(image_url) })
    .eq('id', eventId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

function mapEventStatus(payload) {
  const ls = String(payload.listingStatus || payload.status || '').toLowerCase();
  if (ls === 'published' || ls === 'publish' || ls === 'live') return 'published';
  if (ls === 'unpublished' || ls === 'unpublish') return 'unpublished';
  return 'draft';
}

function demoteToDraftWithoutDate(row) {
  if (row.starts_at) return row;
  row.status = 'draft';
  row.approval_status = 'Pending Review';
  row.ticket_sales_enabled = false;
  return row;
}

function assertEventHasDateForPublish(row) {
  if (!row?.starts_at) {
    const e = new Error(
      `Add a date before publishing${row?.title ? `: ${row.title}` : ''}.`
    );
    e.status = 400;
    e.code = 'missing_date';
    throw e;
  }
}

async function buildEventRow(payload, eventId, mode) {
  const touchDate = mode !== 'update' || payloadTouchesDate(payload);
  const image_url = payload._deferImage ? undefined : await resolveEventPhotoUrl(payload, eventId);
  const isLocked = Boolean(payload._locked);
  const listingStatus = payload.listingStatus != null ? payload.listingStatus : null;
  const approval_status =
    listingStatus != null ? mapApprovalStatus(listingStatus) : undefined;

  const row = {
    title: payload.title,
    organiser_id: payload.groupId || null,
  };

  if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
    row.description = plainEventDescription(payload.description) || null;
  } else if (mode === 'create') {
    row.description = null;
  }

  if (payload.attendeeExtras && typeof payload.attendeeExtras === 'object') {
    Object.assign(row, mapAttendeeExtrasToRow(payload.attendeeExtras));
    if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
      row.description =
        composeEventDescription(payload.description, payload.attendeeExtras) || null;
    }
  }

  if (!isLocked) {
    row.event_type = mapEventType(payload.type);
    row.meeting_type = mapMeetingType(payload.eventFormat);
    row.venue = payload.venue || null;
    row.address = payload.addressLine1 || payload.fullAddress || null;
    const derived = deriveLocationFields(payload);
    row.city = derived.city || null;
    row.postcode = derived.postcode || null;
    row.outcode = ukOutcode(derived.postcode) || null;
    row.location_label = derived.location || derived.city || payload.venue || null;
    if (row.postcode) {
      const geo = await geocodeUkPostcode(row.postcode);
      if (geo) {
        if (geo.latitude != null) row.latitude = geo.latitude;
        if (geo.longitude != null) row.longitude = geo.longitude;
        if (!row.city && geo.city) row.city = geo.city;
      }
    }
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
  if (payload.seriesGroupId) {
    row.series_group_id = payload.seriesGroupId;
  }
  if (payload.duplicatedFromEventId) {
    row.duplicated_from_event_id = payload.duplicatedFromEventId;
  }
  if (payload._clearDuplicatedFrom) {
    row.duplicated_from_event_id = null;
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

  if (listingStatus != null) {
    const nextStatus = mapEventStatus(payload);
    // "draft" on update means save details without publishing — do not demote a live event.
    if (!(mode === 'update' && nextStatus === 'draft')) {
      row.status = nextStatus;
    }
  } else if (mode === 'create') {
    row.status = 'draft';
  }

  if (approval_status !== undefined) row.approval_status = approval_status;
  else if (mode === 'create') row.approval_status = 'Pending Review';

  if (!isLocked) {
    if (image_url !== undefined) row.image_url = eventImageDbValue(image_url);
    else if (mode === 'create') row.image_url = null;

    if (Object.prototype.hasOwnProperty.call(payload, 'imagePosition')) {
      row.image_position = normalizeEventImagePosition(payload.imagePosition) || null;
    }
  } else if (mode === 'create') {
    row.image_url = null;
  }

  // Only demote when this write explicitly sets a missing date.
  // On update, omitting starts_at means "keep the existing date" — do not treat that as draft.
  if (Object.prototype.hasOwnProperty.call(row, 'starts_at') && !row.starts_at) {
    demoteToDraftWithoutDate(row);
  }

  return row;
}

async function inheritGroupPhotoIfMissing(row, payload) {
  if (row.image_url || payload.photoBase64) return row;
  const hasUrlField = Object.prototype.hasOwnProperty.call(payload, 'photoUrl');
  if (hasUrlField && String(payload.photoUrl || '').trim()) return row;
  const organiserId = row.organiser_id || payload.groupId;
  if (!organiserId) return row;

  const sb = getSupabaseAdmin();
  const { data: org, error } = await sb
    .from('organisers')
    .select('photo_url')
    .eq('id', organiserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const logo = String(org?.photo_url || '').trim();
  if (logo) row.image_url = eventImageDbValue(logo);
  return row;
}

async function createEvent(payload) {
  const sb = getSupabaseAdmin();
  const deferImage = Boolean(payload.photoBase64);
  let row = await buildEventRow(
    deferImage ? { ...payload, _deferImage: true } : payload,
    null,
    'create'
  );
  row = await inheritGroupPhotoIfMissing(row, payload);
  const { data, error } = await sb.from('events').insert(row).select('*').single();
  if (error) throw new Error(error.message);

  if (deferImage || Object.prototype.hasOwnProperty.call(payload, 'photoUrl')) {
    const updated = await applyEventPhotoAfterSave(data.id, payload);
    if (updated) return rowToEvent(updated);
  }

  return rowToEvent(data);
}

async function duplicateEventForSession(session, sourceEventId, groupIds) {
  const sb = getSupabaseAdmin();
  const id = String(sourceEventId || '').trim();
  if (!id) {
    const e = new Error('missing_event_id');
    e.status = 400;
    throw e;
  }

  const { data: row, error } = await sb.from('events').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) {
    const e = new Error('Event not found');
    e.status = 404;
    throw e;
  }

  const organiserId = row.organiser_id;
  if (Array.isArray(groupIds) && groupIds.length && !groupIds.includes(organiserId)) {
    const e = new Error('You do not have access to this event');
    e.status = 403;
    e.code = 'event_not_owned';
    throw e;
  }

  let title = String(row.title || 'Event').trim() || 'Event';
  title = defaultDuplicateTitle(title);

  const event = await createEvent({
    groupId: organiserId,
    title,
    duplicatedFromEventId: id,
    type: normalizeEventType(row.event_type || ''),
    description: resolveEventDescription(row),
    location: String(row.location_label || row.city || row.venue || '').trim(),
    venue: String(row.venue || '').trim(),
    addressLine1: String(row.address || '').trim(),
    city: String(row.city || '').trim(),
    postcode: String(row.postcode || '').trim(),
    eventFormat: String(row.meeting_type || '').trim(),
    onlineLink: String(row.meeting_link || '').trim(),
    industry: Array.isArray(row.industries) ? row.industries[0] || '' : '',
    maxAttendees: row.max_attendees != null ? Number(row.max_attendees) : null,
    recurrencePattern: null,
    recurrenceEndDate: null,
    photoUrl: eventImageUrl(row) || '',
    listingStatus: 'draft',
    date: '',
    endDate: '',
    attendeeExtras: {
      foodIncluded: Boolean(row.food_included),
      collectDietary: Boolean(row.collect_dietary),
      collectAccessibility: Boolean(row.collect_accessibility),
    },
  });

  const { data: sourceTickets, error: ticketErr } = await sb
    .from('tickets')
    .select('*')
    .eq('event_id', id)
    .order('display_order', { ascending: true });
  if (ticketErr) throw new Error(ticketErr.message);

  let ticketCount = 0;
  for (const t of sourceTickets || []) {
    await createTicket({
      eventId: event.id,
      name: t.name,
      price: t.price,
      description: t.description,
      status: 'Active',
      quantityAvailable: t.quantity,
      saleStart: t.sale_starts_at,
      saleEnd: t.sale_ends_at,
      ticketType: t.ticket_type,
      displayOrder: t.display_order,
      categoryExclusivity: t.ticket_type === 'Application-based',
    });
    ticketCount += 1;
  }

  return { event, ticketCount };
}

/** Keep ticket sale windows aligned when an event start time moves. */
async function syncTicketSaleEndsAfterStartChange(sb, eventId, oldStartsAt, newStartsAt) {
  const oldStart = oldStartsAt ? String(oldStartsAt).trim() : '';
  const newStart = newStartsAt ? String(newStartsAt).trim() : '';
  if (!eventId || !newStart || oldStart === newStart) return;

  const oldMs = new Date(oldStart).getTime();
  const newMs = new Date(newStart).getTime();
  if (!Number.isFinite(oldMs) || !Number.isFinite(newMs)) return;

  const { data: tickets, error } = await sb
    .from('tickets')
    .select('id, sale_ends_at')
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  const relativeOffsets = [
    0,
    12 * 60 * 60 * 1000,
    24 * 60 * 60 * 1000,
    7 * 24 * 60 * 60 * 1000,
  ];

  for (const ticket of tickets || []) {
    const endRaw = ticket.sale_ends_at ? String(ticket.sale_ends_at).trim() : '';
    if (!endRaw) continue;
    const endMs = new Date(endRaw).getTime();
    if (!Number.isFinite(endMs)) continue;

    let synced = false;
    for (const offset of relativeOffsets) {
      if (endMs !== oldMs - offset) continue;
      const nextEnd = new Date(newMs - offset).toISOString();
      const { error: updateErr } = await sb
        .from('tickets')
        .update({ sale_ends_at: nextEnd })
        .eq('id', ticket.id);
      if (updateErr) throw new Error(updateErr.message);
      synced = true;
      break;
    }
    if (!synced && endMs < newMs) {
      const { error: updateErr } = await sb
        .from('tickets')
        .update({ sale_ends_at: newStart })
        .eq('id', ticket.id);
      if (updateErr) throw new Error(updateErr.message);
    }
  }
}

async function updateEvent(eventId, payload) {
  const sb = getSupabaseAdmin();
  const { data: existing } = await sb.from('events').select('*').eq('id', eventId).maybeSingle();
  const previousLink = String(existing?.meeting_link || '').trim();
  let patchPayload = { ...payload, groupId: payload.groupId };
  patchPayload = await applyDuplicateTitleGuard(sb, existing, patchPayload);
  const saleLocked =
    existing &&
    (existing.locked ||
      (await loadLockedOrActiveSaleEvents(sb, [eventId])).some((row) => row.id === eventId));
  if (saleLocked) {
    if (existing && !existing.locked) {
      await lockEventOnFirstSale(sb, eventId);
    }
    patchPayload._locked = true;
    patchPayload.groupId = existing.organiser_id;
    patchPayload.type = existing.event_type;
    patchPayload.eventFormat = existing.meeting_type;
    patchPayload.venue = existing.venue;
    patchPayload.addressLine1 = existing.address;
    patchPayload.city = existing.city;
    patchPayload.postcode = existing.postcode;
    patchPayload.date = existing.starts_at;
    patchPayload.endDate = existing.ends_at;
    patchPayload.location = existing.location_label;
    if (!String(patchPayload.onlineLink || '').trim()) {
      patchPayload.onlineLink = existing.meeting_link;
    }
    delete patchPayload.photoBase64;
    delete patchPayload.photoUrl;
    delete patchPayload.imagePosition;
    patchPayload.clearPhoto = false;
  }
  const deferImage = Boolean(payload.photoBase64);
  const row = await buildEventRow(
    deferImage ? { ...patchPayload, _deferImage: true } : patchPayload,
    eventId,
    'update'
  );
  const effectiveStartsAt = row.starts_at !== undefined ? row.starts_at : existing?.starts_at ?? null;
  const wasPublished = String(existing?.status || '').toLowerCase() === 'published';
  if (!effectiveStartsAt) {
    if (!wasPublished || payloadTouchesDate(patchPayload)) {
      demoteToDraftWithoutDate(row);
      if (payloadTouchesDate(patchPayload)) {
        row.starts_at = null;
        row.ends_at = null;
      }
    }
  }
  const { data, error } = await sb.from('events').update(row).eq('id', eventId).select('*').single();
  if (error) throw new Error(error.message);
  if (existing?.starts_at !== data?.starts_at && data?.starts_at) {
    await syncTicketSaleEndsAfterStartChange(sb, eventId, existing?.starts_at, data.starts_at);
  }
  await propagateSeriesEventDetails(sb, data);

  if (payload.photoBase64 && !saleLocked) {
    const updated = await applyEventPhotoAfterSave(eventId, payload);
    if (updated) {
      const event = rowToEvent(updated);
      const notifyStats = await finalizeEventUpdateNotifications(
        sb,
        eventId,
        existing,
        updated,
        previousLink
      );
      if (notifyStats.linkUpdateEmails?.sent > 0) event.linkUpdateEmails = notifyStats.linkUpdateEmails;
      if (notifyStats.detailsUpdateEmails?.sent > 0) {
        event.detailsUpdateEmails = notifyStats.detailsUpdateEmails;
      }
      return event;
    }
  }

  const event = rowToEvent(data);
  const notifyStats = await finalizeEventUpdateNotifications(sb, eventId, existing, data, previousLink);
  if (notifyStats.linkUpdateEmails?.sent > 0) event.linkUpdateEmails = notifyStats.linkUpdateEmails;
  if (notifyStats.detailsUpdateEmails?.sent > 0) event.detailsUpdateEmails = notifyStats.detailsUpdateEmails;
  return event;
}

async function maybeNotifyAttendeesOfEventUpdate(sb, eventId, existingRow, updatedRow) {
  if (!existingRow || !updatedRow) return null;
  try {
    const {
      detectNotifyableEventChanges,
      sendEventDetailsUpdatedEmails,
    } = require('./event-update-notifications');
    const changes = detectNotifyableEventChanges(existingRow, updatedRow);
    if (!changes.length) return null;
    return await sendEventDetailsUpdatedEmails(sb, eventId, changes, updatedRow);
  } catch (e) {
    console.error('[event-details-updated-email]', eventId, e.message || e);
    return { sent: 0, errors: [{ message: e.message || String(e) }] };
  }
}

async function finalizeEventUpdateNotifications(sb, eventId, existingRow, updatedRow, previousLink) {
  const stats = { linkUpdateEmails: null, detailsUpdateEmails: null };
  stats.linkUpdateEmails = await maybeSendMeetingLinkEmails(
    sb,
    eventId,
    previousLink,
    updatedRow.meeting_link
  );
  stats.detailsUpdateEmails = await maybeNotifyAttendeesOfEventUpdate(
    sb,
    eventId,
    existingRow,
    updatedRow
  );
  return stats;
}

async function maybeSendMeetingLinkEmails(sb, eventId, previousLink, newLink) {
  if (!String(newLink || '').trim() || String(previousLink || '').trim()) return null;
  try {
    const { sendMeetingLinkAddedEmails } = require('./registration-emails');
    return await sendMeetingLinkAddedEmails(sb, eventId, { previousLink, newLink });
  } catch (e) {
    console.error('[meeting-link-email]', eventId, e.message || e);
    return { sent: 0, errors: [{ message: e.message || String(e) }] };
  }
}

async function deleteEventForSession(session, eventId, groupIds) {
  const sb = getSupabaseAdmin();
  const { data: row, error } = await sb.from('events').select('*').eq('id', eventId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) {
    const e = new Error('Event not found');
    e.status = 404;
    throw e;
  }

  const organiserId = row.organiser_id;
  if (Array.isArray(groupIds) && groupIds.length && !groupIds.includes(organiserId)) {
    const e = new Error('You do not have access to this event');
    e.status = 403;
    e.code = 'event_not_owned';
    throw e;
  }

  if (row.locked) {
    const e = new Error(
      'This event has active ticket sales and cannot be deleted. Cancel the event instead.'
    );
    e.status = 409;
    e.code = 'event_locked';
    throw e;
  }

  const { count, error: regErr } = await sb
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId);
  if (regErr) throw new Error(regErr.message);
  if (count > 0) {
    const e = new Error('This event has registrations and cannot be deleted.');
    e.status = 409;
    e.code = 'event_has_registrations';
    throw e;
  }

  const { error: ticketErr } = await sb.from('tickets').delete().eq('event_id', eventId);
  if (ticketErr) throw new Error(ticketErr.message);

  const { error: delErr } = await sb.from('events').delete().eq('id', eventId);
  if (delErr) throw new Error(delErr.message);

  return { id: eventId, title: row.title || '' };
}

function mapTicketStatus(status) {
  const s = String(status || 'Active').toLowerCase();
  if (s.includes('sold')) return 'Sold out';
  if (s.includes('pause')) return 'Paused';
  return 'Active';
}

const ALLOWED_TICKET_TYPES = new Set(['Standard', 'Application-based', 'Guest-visit', 'Alumni']);

function buildTicketInsertRow({
  eventId,
  name,
  price,
  description,
  status,
  quantityAvailable,
  saleEnd,
  saleStart,
  categoryExclusivity,
  displayOrder,
  ticketType,
  visibility,
  seriesScope,
}) {
  const priceNum = parseFloat(String(price || '0').replace(/[^0-9.]/g, '')) || 0;
  const qty =
    quantityAvailable != null && quantityAvailable !== ''
      ? Number(quantityAvailable)
      : null;
  let type =
    ticketType ||
    (categoryExclusivity || /application/i.test(String(name || '')) ? 'Application-based' : 'Standard');
  type = String(type || '').trim();
  if (!ALLOWED_TICKET_TYPES.has(type)) {
    type =
      categoryExclusivity || /application/i.test(String(name || ''))
        ? 'Application-based'
        : 'Standard';
  }
  return {
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
    visibility: normalizeTicketVisibility(visibility),
    series_scope: String(seriesScope || 'date').trim() === 'series_pass' ? 'series_pass' : 'date',
  };
}

async function insertTicketsBatch(rows) {
  if (!rows.length) return [];
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('tickets').insert(rows).select('*');
  if (error) throw new Error(error.message);
  return (data || []).map(rowToTicket);
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
  categoryExclusivity,
  displayOrder,
  ticketType,
  visibility,
  seriesScope,
}) {
  const sb = getSupabaseAdmin();
  await assertTicketsEditableForEvents(sb, [eventId]);
  const row = buildTicketInsertRow({
    eventId,
    name,
    price,
    description,
    status,
    quantityAvailable,
    saleEnd,
    saleStart,
    categoryExclusivity,
    displayOrder,
    ticketType,
    visibility,
    seriesScope,
  });
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

/** Persist refund policy and organiser terms when saving tickets before publish (review step). */
async function saveRefundPolicyForEvents(eventIds, refundPayload) {
  const policy = String(refundPayload?.refundPolicy || '').trim();
  if (!policy) return;
  const sb = getSupabaseAdmin();
  const ids = (eventIds || []).filter(Boolean);
  if (!ids.length) return;
  const patch = {
    refund_policy: policy,
    refund_policy_details: String(refundPayload.refundPolicyDetails || '').trim() || null,
    refund_cutoff_days:
      refundPayload.refundCutoffDays != null ? Number(refundPayload.refundCutoffDays) : null,
  };
  if (refundPayload.refundTermsAgreed) {
    patch.refund_terms_agreed = true;
    patch.refund_terms_agreed_at = new Date().toISOString();
  }
  const { error } = await sb.from('events').update(patch).in('id', ids);
  if (error) throw new Error(error.message);
}

async function assertEventsHaveTicketsForPublish(sb, eventIds) {
  const ids = (eventIds || []).filter(Boolean);
  if (!ids.length) return;
  const { data, error } = await sb.from('tickets').select('event_id').in('event_id', ids);
  if (error) throw new Error(error.message);
  const withTickets = new Set((data || []).map((row) => row.event_id));
  for (const id of ids) {
    if (!withTickets.has(id)) {
      const e = new Error('Add at least one ticket type before publishing this event.');
      e.status = 400;
      e.code = 'tickets_required_for_publish';
      throw e;
    }
  }
}

async function publishEventsWithRefund(eventIds, refundPayload, ticketsForSales) {
  const sb = getSupabaseAdmin();
  const { ensureEventSlug } = require('./event-slug');
  const { eventRowReadyForAutoApproval } = require('./supabase-events');
  const ids = (eventIds || []).filter(Boolean);
  if (!ids.length) {
    const e = new Error('No events to publish');
    e.status = 400;
    throw e;
  }

  await assertEventsHaveTicketsForPublish(sb, ids);

  const patch = {
    status: 'published',
    published_at: new Date().toISOString(),
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
    .select(
      'id, title, slug, starts_at, organiser_id, event_type, meeting_type, vat_treatment, refund_policy, refund_terms_agreed, refund_terms_agreed_at, approval_status'
    )
    .in('id', ids);
  if (loadErr) throw new Error(loadErr.message);

  const orgIds = [...new Set((existing || []).map((row) => row.organiser_id).filter(Boolean))];
  let orgById = new Map();
  if (orgIds.length) {
    const { data: orgs, error: orgErr } = await sb
      .from('organisers')
      .select('id, listing_status')
      .in('id', orgIds);
    if (orgErr) throw new Error(orgErr.message);
    orgById = new Map((orgs || []).map((o) => [o.id, o]));
  }

  const ticketsByEvent = new Map();
  (ticketsForSales || []).forEach((ticket) => {
    const eventId = ticket.event_id || ticket.eventId;
    if (!eventId) return;
    if (!ticketsByEvent.has(eventId)) ticketsByEvent.set(eventId, []);
    ticketsByEvent.get(eventId).push(ticket);
  });

  const updated = [];
  for (const row of existing || []) {
    assertEventHasDateForPublish(row);
    const slug = await ensureEventSlug(sb, {
      title: row.title,
      eventId: row.id,
      currentSlug: row.slug,
    });
    const eventTickets = ticketsByEvent.get(row.id) || [];
    const rowPatch = {
      ...patch,
      slug,
      ticket_sales_enabled: eventHasTicketsOnSale(eventTickets, undefined, row.starts_at),
    };
    if (row.refund_terms_agreed || row.refund_terms_agreed_at) {
      rowPatch.refund_terms_agreed = true;
      rowPatch.refund_terms_agreed_at = row.refund_terms_agreed_at || new Date().toISOString();
    }
    const mergedRow = { ...row, ...rowPatch };
    const organiser = row.organiser_id ? orgById.get(row.organiser_id) : null;
    if (eventRowReadyForAutoApproval(mergedRow, organiser, eventTickets, refundPayload)) {
      rowPatch.approval_status = 'Approved';
    } else if (String(row.approval_status || '').trim() !== 'Approved') {
      rowPatch.approval_status = 'Pending Review';
    }
    const { data, error } = await sb
      .from('events')
      .update(rowPatch)
      .eq('id', row.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    if (data) updated.push(data);
  }

  await publishOrganiserListingsForEventIds(sb, updated);

  // Notify member-list people for newly Approved published events (non-blocking).
  try {
    const { notifyRosterMembersOfPublishedEvent } = require('./organiser-member-roster');
    for (const row of updated || []) {
      if (String(row.approval_status || '').trim() !== 'Approved') continue;
      notifyRosterMembersOfPublishedEvent(row).catch((err) => {
        console.error('[publish] member list new-event email failed', row.id, err?.message || err);
      });
    }
  } catch (err) {
    console.error('[publish] member list notify wiring failed', err?.message || err);
  }

  return updated.map(rowToEvent);
}

async function saveAttendeeExtrasForEvents(eventIds, attendeeExtras) {
  const ids = Array.isArray(eventIds) ? eventIds.filter(Boolean) : [];
  if (!ids.length || attendeeExtras == null || typeof attendeeExtras !== 'object') return;

  const sb = getSupabaseAdmin();
  const extrasRow = mapAttendeeExtrasToRow(attendeeExtras);
  const { data: rows, error: loadErr } = await sb
    .from('events')
    .select('id, description')
    .in('id', ids);
  if (loadErr) throw new Error(loadErr.message);

  await Promise.all(
    (rows || []).map(async (row) => {
      const description = composeEventDescription(row.description, attendeeExtras);
      const { error } = await sb
        .from('events')
        .update({ ...extrasRow, description: description || null })
        .eq('id', row.id);
      if (error) throw new Error(error.message);
    })
  );
}

/** Check ownership for specific event ids without loading the full organiser catalogue. */
async function filterOwnedEventIds(eventIds, groupIds, adminView) {
  const ids = [...new Set((eventIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return [];
  if (adminView) return ids;
  const groups = groupIds || [];
  if (!groups.length) return [];

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('events').select('id').in('id', ids).in('organiser_id', groups);
  if (error) throw new Error(error.message);
  return (data || []).map((row) => row.id).filter(Boolean);
}

const ACTIVE_SERIES_STATUSES = ['draft', 'published', 'unpublished'];

async function fetchSeriesPeerIds(sb, row) {
  if (!row?.id) return [];
  if (row.duplicated_from_event_id) return [];
  if (!row.series_group_id) return [];
  const exclude = new Set([row.id]);

  const { data, error } = await sb
    .from('events')
    .select('id')
    .eq('series_group_id', row.series_group_id)
    .in('status', ACTIVE_SERIES_STATUSES);
  if (error) throw new Error(error.message);
  return (data || []).map((peer) => peer.id).filter((id) => id && !exclude.has(id));
}

/** Include every date in the same listing when tickets are saved for one series event. */
async function expandEventIdsToSeriesPeers(sb, eventIds) {
  const seedIds = [...new Set((eventIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!seedIds.length) return [];

  const { data: anchors, error } = await sb
    .from('events')
    .select('id, series_group_id, organiser_id, title, status')
    .in('id', seedIds);
  if (error) throw new Error(error.message);

  const expanded = new Set(seedIds);
  const peerLists = await Promise.all((anchors || []).map((row) => fetchSeriesPeerIds(sb, row)));
  peerLists.forEach((peerIds) => peerIds.forEach((id) => expanded.add(id)));
  return [...expanded];
}

function seriesDetailsPatchFromRow(row) {
  if (!row) return null;
  return {
    title: row.title,
    description: row.description,
    event_type: row.event_type,
    meeting_type: row.meeting_type,
    venue: row.venue,
    address: row.address,
    city: row.city,
    postcode: row.postcode,
    outcode: row.outcode,
    location_label: row.location_label,
    latitude: row.latitude,
    longitude: row.longitude,
    meeting_link: row.meeting_link,
    image_url: row.image_url,
    image_position: row.image_position ?? null,
    industries: row.industries,
    recurrence_pattern: row.recurrence_pattern,
    recurrence_end_date: row.recurrence_end_date,
    food_included: row.food_included,
    collect_dietary: row.collect_dietary,
    collect_accessibility: row.collect_accessibility,
    series_group_id: row.series_group_id || null,
  };
}

async function propagateSeriesEventDetails(sb, updatedRow) {
  const peerIds = await fetchSeriesPeerIds(sb, updatedRow);
  if (!peerIds.length) return;

  const basePatch = seriesDetailsPatchFromRow(updatedRow);
  if (!basePatch) return;

  const { data: peers, error } = await sb.from('events').select('id, locked').in('id', peerIds);
  if (error) throw new Error(error.message);

  for (const peer of peers || []) {
    const patch = { ...basePatch };
    if (peer.locked) {
      delete patch.event_type;
      delete patch.meeting_type;
      delete patch.venue;
      delete patch.address;
      delete patch.city;
      delete patch.postcode;
      delete patch.outcode;
      delete patch.location_label;
      delete patch.latitude;
      delete patch.longitude;
    }
    const { error: updateErr } = await sb.from('events').update(patch).eq('id', peer.id);
    if (updateErr) throw new Error(updateErr.message);
  }

  if (updatedRow.series_group_id) {
    const { error: groupErr } = await sb
      .from('events')
      .update({ series_group_id: updatedRow.series_group_id })
      .in('id', peerIds)
      .is('series_group_id', null);
    if (groupErr) throw new Error(groupErr.message);
  }
}

/** Same shape as Airtable API: { eventIds, tickets, publish, refund } */
async function createTicketsForEvents({
  eventIds,
  tickets,
  publish,
  refund,
  vatTreatment,
  attendeeExtras,
  attendanceMode,
  alumniFastPass,
  guestPassesDisabled,
}) {
  const sb = getSupabaseAdmin();
  const ids = await expandEventIdsToSeriesPeers(sb, eventIds);
  let tiers = Array.isArray(tickets) ? tickets : [];
  if (!ids.length || !tiers.length) return { created: 0, tickets: [] };

  const mode = normalizeAttendanceMode(attendanceMode);

  const guestPassesDisabledFlag = Boolean(guestPassesDisabled);
  const { guestVisitTierPayload } = require('./guest-visits');
  const { alumniTierPayload } = require('./alumni-invites');

  if (mode === 'guest_programme') {
    const { data: eventRows, error: eventRowsErr } = await sb
      .from('events')
      .select('organiser_id')
      .in('id', ids);
    if (eventRowsErr) throw new Error(eventRowsErr.message);
    const organiserIds = [...new Set((eventRows || []).map((row) => row.organiser_id).filter(Boolean))];
    if (!organiserIds.length) {
      const e = new Error('guest_programme_requires_organiser');
      e.status = 400;
      throw e;
    }
    const { data: orgRows, error: orgErr } = await sb
      .from('organisers')
      .select('id, complimentary_visits_allowed')
      .in('id', organiserIds);
    if (orgErr) throw new Error(orgErr.message);
    const blocked = (orgRows || []).find((org) => !Number(org.complimentary_visits_allowed));
    if (blocked) {
      const e = new Error(
        'Enable complimentary guest visits on your organiser page (1–3) before using the guest visit programme.'
      );
      e.status = 400;
      e.code = 'guest_programme_requires_complimentary_visits';
      throw e;
    }
    if (!guestPassesDisabledFlag) {
      tiers = [...tiers, guestVisitTierPayload()];
    }
  }

  let alumniConfig =
    alumniFastPass && alumniFastPass.enabled
      ? {
          price: alumniFastPass.price,
          quantityAvailable: alumniFastPass.quantityAvailable,
          saleEnd: alumniFastPass.saleEnd || null,
          description: alumniFastPass.description || '',
          sourceEventId: alumniFastPass.sourceEventId || null,
        }
      : null;

  // Drop any Alumni tiers that arrived from a stale client / draft.
  tiers = tiers.filter((t) => {
    const type = String(t?.ticketType || t?.ticket_type || '').trim();
    return type !== 'Alumni' && !/^alumni/i.test(String(t?.name || '').trim()) && !t?.isAlumni;
  });

  if (alumniConfig) {
    tiers.push(
      alumniTierPayload({
        price: alumniConfig.price,
        quantityAvailable: alumniConfig.quantityAvailable,
        saleEnd: alumniConfig.saleEnd,
        description: alumniConfig.description,
      })
    );
  }

  const alumniEventUpdate = {
    alumni_fast_pass_enabled: Boolean(alumniConfig),
    guest_passes_disabled: mode === 'guest_programme' ? guestPassesDisabledFlag : false,
  };
  if (alumniConfig?.sourceEventId) {
    alumniEventUpdate.alumni_source_event_id = alumniConfig.sourceEventId;
  }

  await assertTicketsEditableForEvents(sb, ids);

  const { data: eventRows, error: eventRowsErr } = await sb
    .from('events')
    .select('id, starts_at')
    .in('id', ids);
  if (eventRowsErr) throw new Error(eventRowsErr.message);
  const startsByEventId = new Map((eventRows || []).map((row) => [row.id, row.starts_at || null]));

  if (publish) {
    const missingSaleEnd = ids.some((eventId) => {
      const eventStartsAt = startsByEventId.get(eventId) || null;
      return tiers.some((tier) => {
        const ticketType = String(tier?.ticketType || tier?.ticket_type || '').trim();
        if (/guest-visit/i.test(ticketType)) return false;
        return !resolveTierSaleEnd(tier, eventStartsAt);
      });
    });
    if (missingSaleEnd) {
      const e = new Error('Choose a valid sale end for every ticket tier before publishing.');
      e.status = 400;
      e.code = 'ticket_sale_end_required';
      throw e;
    }
  }

  if (vatTreatment) {
    await updateEventVatTreatment(ids, vatTreatment);
  }

  const { tiersHavePaidPrice } = require('./supabase-events');
  const hasPaidTickets = tiersHavePaidPrice(tiers);
  if (!publish && hasPaidTickets && refund && String(refund.refundPolicy || '').trim()) {
    await saveRefundPolicyForEvents(ids, refund);
  }

  const { error: deleteErr } = await sb.from('tickets').delete().in('event_id', ids);
  if (deleteErr) throw new Error(deleteErr.message);

  const { error: alumniFlagErr } = await sb.from('events').update(alumniEventUpdate).in('id', ids);
  if (alumniFlagErr) throw new Error(alumniFlagErr.message);

  const insertRows = [];
  for (const eventId of ids) {
    const eventStartsAt = startsByEventId.get(eventId) || null;
    for (const tier of tiers) {
      insertRows.push(
        buildTicketInsertRow({
          eventId,
          name: tier.name,
          price: tier.price,
          description: tier.description,
          status: tier.status,
          quantityAvailable: tier.quantityAvailable,
          saleEnd: resolveTierSaleEnd(tier, eventStartsAt),
          saleStart: tier.saleStart,
          categoryExclusivity: tier.categoryExclusivity,
          displayOrder: tier.displayOrder,
          ticketType: tier.ticketType,
          visibility: tier.visibility,
          seriesScope: tier.seriesScope || tier.series_scope || 'date',
        })
      );
    }
  }
  const out = await insertTicketsBatch(insertRows);

  const hasCategoryExclusivity =
    mode === 'category_exclusivity' ||
    tiers.some(
      (t) => t.categoryExclusivity || /application/i.test(String(t.ticketType || t.name || ''))
    );
  const { error: approvalErr } = await sb
    .from('events')
    .update({ auto_approve: !hasCategoryExclusivity, attendance_mode: mode })
    .in('id', ids);
  if (approvalErr) throw new Error(approvalErr.message);

  let publishedEvents = null;
  if (publish) {
    const hasPaidTicketsAfterCreate = tiersHavePaidPrice(out);
    const refundPayload = hasPaidTicketsAfterCreate ? refund : {};
    if (hasPaidTicketsAfterCreate && (!refund || !String(refund.refundPolicy || '').trim())) {
      const e = new Error('Select a refund policy before publishing paid tickets.');
      e.status = 400;
      e.code = 'refund_policy_required';
      throw e;
    }
    const { data: eventRows, error: eventLoadErr } = await sb
      .from('events')
      .select('id, organiser_id')
      .in('id', ids);
    if (eventLoadErr) throw new Error(eventLoadErr.message);
    const organiserIds = [...new Set((eventRows || []).map((row) => row.organiser_id).filter(Boolean))];
    const { assertOrganiserReadyForPaidPublish } = require('./stripe-connect');
    await assertOrganiserReadyForPaidPublish(sb, organiserIds, out);
    publishedEvents = await publishEventsWithRefund(ids, refundPayload || {}, out);
  }

  if (attendeeExtras != null && typeof attendeeExtras === 'object') {
    await saveAttendeeExtrasForEvents(ids, attendeeExtras);
  }

  return { created: out.length, tickets: out, publishedEvents };
}

async function enableTicketSalesForEvent(session, eventId, groupIds) {
  const sb = getSupabaseAdmin();
  const id = String(eventId || '').trim();
  const { data: event, error } = await sb
    .from('events')
    .select(
      'id, organiser_id, status, approval_status, ticket_sales_enabled, refund_policy, refund_policy_details, refund_terms_agreed, refund_terms_agreed_at'
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!event) {
    const e = new Error('Event not found');
    e.status = 404;
    throw e;
  }
  if (!groupIds.includes(event.organiser_id)) {
    const e = new Error('Not allowed');
    e.status = 403;
    throw e;
  }
  if (String(event.status || '').toLowerCase() !== 'published') {
    const e = new Error('Publish the event before enabling ticket sales');
    e.status = 400;
    throw e;
  }

  const { data: tickets, error: ticketErr } = await sb.from('tickets').select('*').eq('event_id', id);
  if (ticketErr) throw new Error(ticketErr.message);
  if (!(tickets || []).length) {
    const e = new Error('Add at least one ticket type before enabling sales');
    e.status = 400;
    throw e;
  }

  const hasPaid = (tickets || []).some((t) => Number(t.price) > 0);
  if (hasPaid) {
    const { assertOrganiserReadyForPaidPublish } = require('./stripe-connect');
    const { assertRefundPolicyForPaidCheckout } = require('./event-refund-policy');
    await assertOrganiserReadyForPaidPublish(sb, [event.organiser_id], tickets);
    try {
      assertRefundPolicyForPaidCheckout(event);
    } catch (refundErr) {
      const e = new Error(refundErr.message);
      e.status = refundErr.status || 400;
      e.code = refundErr.code || 'refund_policy_required';
      throw e;
    }
  }

  const { data: updated, error: updateErr } = await sb
    .from('events')
    .update({ ticket_sales_enabled: true })
    .eq('id', id)
    .select('*')
    .single();
  if (updateErr) throw new Error(updateErr.message);
  return rowToEvent(updated);
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

async function loadOrganiserEventsPage(session, groups, groupIds, adminView, pagination, options) {
  const opts = options || {};
  const { limit, offset, knownTotal, eventsLite } = pagination;
  const skipSideLoads = offset > 0 && knownTotal != null;
  const skipSalesEnrichment = Boolean(eventsLite || opts.eventsLite);

  const [groupEventCounts, upcomingRaw, total] = await Promise.all([
    skipSideLoads ? Promise.resolve(null) : countEventsByOrganiserGroup(groupIds),
    skipSideLoads ? Promise.resolve([]) : listUpcomingEventsForOrganiser(groupIds, WORKSPACE_UPCOMING_LIMIT),
    skipSideLoads
      ? Promise.resolve(knownTotal)
      : adminView
        ? countAllEvents()
        : countEventsForOrganiser(groupIds),
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

  if (!skipSalesEnrichment) {
    try {
      const { enrichOrganiserWorkspaceSales, enrichEventsWithRegistrationSales } = require('./supabase-organiser-payouts');
      const sales = await enrichOrganiserWorkspaceSales(overview.events, tickets);
      overview = {
        ...overview,
        events: sales.events,
        groups: enrichOrganiserOverview(groups, sales.events, sales.tickets, groupEventCounts).groups,
      };
      const { enrichEventsWithPayoutData } = require('./supabase-organiser-payouts');
      const upcomingPayout = await enrichEventsWithPayoutData(upcomingOverview.events);
      upcomingOverview.events = upcomingPayout.events;
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
        const { listCancellationsForEvents, buildRevenueContext, mapLatestCancellationsByEvent } =
          require('./supabase-organiser-payouts');
        const cancellations = await listCancellationsForEvents([
          ...new Set(regs.map((row) => row.event_id).filter(Boolean)),
        ]);
        const cancellationsByEvent = mapLatestCancellationsByEvent(cancellations);
        const revenueContextByEventId = {};
        [...enrichedEvents, ...upcomingOverview.events].forEach((ev) => {
          if (!ev?.id || revenueContextByEventId[ev.id]) return;
          revenueContextByEventId[ev.id] = buildRevenueContext(
            ev,
            cancellationsByEvent[ev.id] || null
          );
        });
        overview = {
          ...overview,
          events: enrichedEvents,
          groups: enrichOrganiserOverview(groups, enrichedEvents, tickets, groupEventCounts).groups,
        };
        upcomingOverview.events = await enrichEventsWithRegistrationSales(upcomingOverview.events);
        tickets = enrichTicketsWithSales(tickets, regs, revenueContextByEventId);
      } catch {
        /* registration enrichment optional */
      }
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

async function getLeanOrganiserWorkspace(req) {
  const { requireOrganiserSession } = require('./organiser');
  const wsAuth = requireOrganiserSession(req);
  if (!wsAuth.ok) return wsAuth;

  const { session } = wsAuth;
  const isAdmin = sbOrg.isPlatformAdmin(session);
  const personalScope = isAdmin && organiserPersonalScopeFromRequest(req);
  const adminView = isAdmin && !personalScope;

  const { getOrganiserAccessStatus } = require('./organiser-access-guard');
  const { listPendingClaimGroupsForSession } = require('./supabase-organiser-claims');
  const accessPromise = resolveOrganiserAccess(session).catch(() => null);
  const accessStatusPromise = getOrganiserAccessStatus(session).catch(() => null);
  const pendingClaimsPromise = adminView
    ? Promise.resolve([])
    : listPendingClaimGroupsForSession(session).catch(() => []);

  let groups = [];
  let groupsError = null;
  const access = await accessPromise;
  try {
    groups = await sbOrg.listGroupsForSession(session, adminView, access);
  } catch (e) {
    groupsError = e.message;
  }

  const groupIds = groups.map((g) => g.id);
  const { buildRosterSummariesForOrganisers } = require('./organiser-member-roster');
  const [pendingClaimGroups, eventSummaries, accessStatus, rosterSummaries] = await Promise.all([
    pendingClaimsPromise,
    listEventSummariesForOrganiserGroups(groupIds, adminView).catch(() => []),
    accessStatusPromise,
    buildRosterSummariesForOrganisers(groupIds).catch(() => new Map()),
  ]);

  const workspaceSummary = null;

  groups = enrichGroupsFromLeanData(groups, eventSummaries, workspaceSummary, rosterSummaries);

  let stripeConnectEnabled = false;
  try {
    const { isStripeConnectEnabled } = require('./stripe-connect');
    stripeConnectEnabled = isStripeConnectEnabled();
  } catch {
    stripeConnectEnabled = false;
  }

  return {
    ok: true,
    session,
    groups,
    pendingClaimGroups,
    events: [],
    upcomingEvents: [],
    tickets: [],
    eventsPagination: {
      total: eventSummaries.length,
      limit: 0,
      offset: 0,
      hasMore: false,
    },
    workspaceSummary,
    eventSummaries,
    reviews: [],
    groupRankings: {},
    pendingApplications: { count: 0, preview: [] },
    groupsError,
    hubView: hubViewFromRequest(req),
    adminView,
    personalScope,
    isAdmin,
    canOrganise: groups.length > 0 || adminView,
    organiserRole: access ? access.role : null,
    canManageTeam: access ? access.canManageTeam : true,
    canDeleteEvents: access ? access.canDeleteEvents : true,
    canManagePayments: access ? access.canManagePayments : true,
    canCreateGroups: access ? access.canCreateGroups : true,
    useTeamWorkspace: access ? Boolean(access.useTeamWorkspace) : false,
    accessStatus,
    stripeConnectEnabled,
    user: {
      email: session.email,
      name: session.name || '',
      role: session.role,
      sub: session.sub,
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
  let pendingClaimGroups = [];
  let groupsError = null;
  try {
    groups = await sbOrg.listGroupsForSession(session, adminView);
    if (!adminView) {
      const { listPendingClaimGroupsForSession } = require('./supabase-organiser-claims');
      pendingClaimGroups = await listPendingClaimGroupsForSession(session);
    }
  } catch (e) {
    groupsError = e.message;
  }

  const groupIds = groups.map((g) => g.id);
  const eventsOnly = String(req.query?.eventsOnly || '') === '1';

  if (eventsOnly) {
    try {
      if (eventsPaginationQuery.offset === 0) {
        scheduleArchivePastPublishedEvents(groupIds);
      }
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

  scheduleArchivePastPublishedEvents(groupIds);

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

  let workspaceSalesCache = null;
  let eventSummaries = [];
  let reviews = [];
  let groupRankings = {};
  let allEventIds = [];
  let pendingApplications = { count: 0, preview: [] };

  const { listReviewsForOrganiserGroups } = require('./supabase-reviews');
  const { getGroupRankingsForOrganiser } = require('./organiser-group-ranking');
  const { summarizePendingApplicationsForEventIds } = require('./supabase-organiser-attendees');

  const [salesResult, summariesResult, reviewsResult, rankingsResult, eventIdsResult] =
    await Promise.all([
      (async () => {
        try {
          const { buildOrganiserWorkspaceSummary } = require('./supabase-organiser-payouts');
          return await buildOrganiserWorkspaceSummary(groupIds, adminView);
        } catch {
          return null;
        }
      })(),
      listEventSummariesForOrganiserGroups(groupIds, adminView).catch(() => []),
      listReviewsForOrganiserGroups(
        groupIds,
        new Map(overviewGroups.map((g) => [g.id, g])),
        adminView
      ).catch(() => []),
      getGroupRankingsForOrganiser(groupIds).catch(() => ({})),
      listEventIdsForOrganiserGroups(groupIds, adminView).catch(() => []),
    ]);

  workspaceSalesCache = salesResult;
  eventSummaries = summariesResult || [];
  reviews = reviewsResult || [];
  groupRankings = rankingsResult || {};
  allEventIds = eventIdsResult || [];

  try {
    pendingApplications = await summarizePendingApplicationsForEventIds(allEventIds);
  } catch {
    pendingApplications = { count: 0, preview: [] };
  }

  const workspaceSummary = workspaceSalesCache
    ? {
        computed: workspaceSalesCache.computed,
        totalRevenue: workspaceSalesCache.totalRevenue,
        totalTicketsSold: workspaceSalesCache.totalTicketsSold,
        revenueByGroupId: workspaceSalesCache.revenueByGroupId,
        ticketsSoldByGroupId: workspaceSalesCache.ticketsSoldByGroupId,
      }
    : null;

  if (workspaceSummary?.computed) {
    overviewGroups = applyGroupSalesSummary(overviewGroups, workspaceSummary);
  }

  try {
    if (allEventIds.length) {
      const { enrichTicketsWithSales, listRegistrationsForEvents } = require('./supabase-organiser-payouts');
      const allTickets = await listTicketsForEventIds(allEventIds);
      const regs = workspaceSalesCache?.registrations?.length
        ? workspaceSalesCache.registrations
        : await listRegistrationsForEvents(allEventIds);
      const revenueContextByEventId = workspaceSalesCache?.revenueContextByEventId || {};
      tickets = enrichTicketsWithSales(allTickets, regs, revenueContextByEventId);
    }
  } catch {
    /* keep page-scoped tickets */
  }

  let stripeConnectEnabled = false;
  try {
    const { isStripeConnectEnabled } = require('./stripe-connect');
    stripeConnectEnabled = isStripeConnectEnabled();
  } catch {
    stripeConnectEnabled = false;
  }

  return {
    ok: true,
    session,
    groups: overviewGroups,
    pendingClaimGroups,
    events,
    upcomingEvents,
    tickets,
    eventsPagination,
    workspaceSummary,
    eventSummaries,
    reviews,
    groupRankings,
    pendingApplications,
    groupsError,
    hubView: hubViewFromRequest(req),
    adminView,
    personalScope,
    isAdmin,
    canOrganise: groups.length > 0 || adminView,
    organiserRole: access ? access.role : null,
    canManageTeam: access ? access.canManageTeam : true,
    canDeleteEvents: access ? access.canDeleteEvents : true,
    canManagePayments: access ? access.canManagePayments : true,
    canCreateGroups: access ? access.canCreateGroups : true,
    useTeamWorkspace: access ? Boolean(access.useTeamWorkspace) : false,
    stripeConnectEnabled,
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

/** Revenue/ticket totals for the signed-in workspace — deferred from lean bootstrap. */
async function getOrganiserWorkspaceStats(req) {
  const { requireOrganiserSession } = require('./organiser');
  const wsAuth = requireOrganiserSession(req);
  if (!wsAuth.ok) return wsAuth;

  const { session } = wsAuth;
  const isAdmin = sbOrg.isPlatformAdmin(session);
  const personalScope = isAdmin && organiserPersonalScopeFromRequest(req);
  const adminView = isAdmin && !personalScope;

  const access = await resolveOrganiserAccess(session).catch(() => null);
  let groups = [];
  try {
    groups = await sbOrg.listGroupsForSession(session, adminView, access);
  } catch (e) {
    return { ok: false, status: 500, error: 'groups_failed', message: e.message };
  }

  const groupIds = groups.map((g) => g.id);
  let workspaceSalesCache = null;
  try {
    const { buildOrganiserWorkspaceSummary } = require('./supabase-organiser-payouts');
    workspaceSalesCache = await buildOrganiserWorkspaceSummary(groupIds, adminView);
  } catch {
    workspaceSalesCache = null;
  }

  const workspaceSummary = workspaceSalesCache
    ? {
        computed: workspaceSalesCache.computed,
        totalRevenue: workspaceSalesCache.totalRevenue,
        totalTicketsSold: workspaceSalesCache.totalTicketsSold,
        revenueByGroupId: workspaceSalesCache.revenueByGroupId,
        ticketsSoldByGroupId: workspaceSalesCache.ticketsSoldByGroupId,
      }
    : null;

  return {
    ok: true,
    session,
    workspaceSummary,
  };
}

module.exports = {
  WORKSPACE_EVENTS_LIMIT_DEFAULT,
  WORKSPACE_EVENTS_LIMIT_MAX,
  parseWorkspaceEventsQuery,
  countEventsForOrganiser,
  loadOrganiserEventsPage,
  listEventsForSession,
  listEventsForOrganiser,
  listEventsForSeriesGroup,
  listEventIdsForOrganiserGroups,
  listEventSummariesForOrganiserGroups,
  applyGroupSalesSummary,
  listTicketsForEventIds,
  listTicketsForSession,
  getEventById,
  createEvent,
  duplicateEventForSession,
  updateEvent,
  deleteEventForSession,
  enableTicketSalesForEvent,
  createTicket,
  createTicketsForEvents,
  filterOwnedEventIds,
  publishEventsWithRefund,
  enrichGroupForDashboard,
  enrichOrganiserOverview,
  getLeanOrganiserWorkspace,
  getOrganiserWorkspaceStats,
  getOrganiserWorkspace,
  airtableSetupHint,
  rowToEvent,
  newSeriesGroupId,
  resolveSeriesGroupId,
};
