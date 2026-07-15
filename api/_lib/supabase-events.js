/**
 * Public events API — Supabase.
 */
const { getSupabaseAdmin, isSupabaseConfigured, supabaseConfig } = require('./supabase');
const { isEventCurrentlyFeatured } = require('./event-featured-plans');
const { eventImageUrl, normalizeEventImagePosition } = require('./event-image');
const { eventHasTicketsOnSale, resolveTicketSalesEnabled, earliestTicketSaleStart, formatTicketSalesOpensLabel, formatTicketSalesOpensShort, isEventPublishedForSale } = require('./ticket-sales');
const { connectRequiredForPaidCheckout } = require('./stripe-connect');
const { publicOrganiserSlug } = require('./organiser-slug');
const { isMembersOnlyTicket } = require('./ticket-visibility');

const IN_CHUNK_SIZE = 80;

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

const BROWSE_ORGANISER_COLUMNS =
  'id,name,photo_url,description,listing_status,stripe_account_id,stripe_charges_enabled,stripe_connect_details_submitted,slug';

const BROWSE_TICKET_COLUMNS =
  'id,event_id,price,quantity,name,ticket_type,description,sale_ends_at,sale_starts_at,status,visibility';

function upcomingBrowseOrFilter(nowIso) {
  const now = nowIso || new Date().toISOString();
  return `ends_at.gte.${now},and(ends_at.is.null,starts_at.gte.${now})`;
}

function stripBrowseListPayload(ev) {
  if (!ev) return ev;
  const desc = String(ev.description || '');
  return {
    ...ev,
    description: desc.length > 400 ? desc.slice(0, 400) : desc,
    tickets: [],
    organiserProfile: ev.organiserProfile ? String(ev.organiserProfile).slice(0, 200) : '',
    highlights: [],
    refundPolicy: null,
    refundPolicyDetails: null,
  };
}

async function fetchRowsInChunks(sb, table, idColumn, ids, select = '*') {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return [];

  const rows = [];
  for (let i = 0; i < unique.length; i += IN_CHUNK_SIZE) {
    const chunk = unique.slice(i, i + IN_CHUNK_SIZE);
    const { data, error } = await sb.from(table).select(select).in(idColumn, chunk);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
  }
  return rows;
}

function parsePriceNum(raw) {
  if (raw == null || raw === '') return 0;
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function normalizePrice(priceNum) {
  if (!priceNum || priceNum <= 0) return { display: 'Free', priceKey: 'free' };
  return { display: `£${priceNum.toFixed(2)}`, priceKey: 'paid' };
}

const {
  normalizeEventType,
  slugForEventType,
  parseTypeCategory: parseMeetingCategory,
} = require('./event-types');
const { plainEventDescription } = require('./event-description');
const { publicEventSlug } = require('./event-slug');

function parseTypeCategory(raw) {
  return parseMeetingCategory(raw);
}

function slugifyType(raw) {
  return slugForEventType(normalizeEventType(raw));
}

function slugLocation(loc) {
  return String(loc || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function slugIndustry(ind) {
  return String(ind || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function slugFormat(fmt) {
  const raw = String(fmt || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.includes('online') && !raw.includes('person')) return 'online';
  if (raw.includes('hybrid')) return 'hybrid';
  if (raw.includes('person') || raw.includes('in-person') || raw.includes('in person')) return 'in-person';
  return raw.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function eventTypeTabCategory(raw) {
  const t = normalizeEventType(raw);
  if (t === 'Exhibition') return 'exhibition';
  if (t === 'Conference') return 'conference';
  if (t === 'Events') return 'events';
  if (t === 'Awards') return 'awards';
  if (t === 'Webinar') return 'webinar';
  if (t === 'Workshop') return 'workshop';
  if (t === 'Masterclass') return 'masterclass';
  return 'meeting';
}

function inferMeetingType(row) {
  const fmt = String(row.meeting_type || '').trim();
  if (fmt) return fmt;
  if (String(row.meeting_link || '').trim()) return 'Online';
  if (row.venue || row.postcode || row.city || row.location_label) return 'In person';
  return 'In person';
}

function resolvedEventType(row, typeRaw) {
  return typeRaw;
}

function ukOutcode(postcode) {
  const m = String(postcode || '')
    .trim()
    .toUpperCase()
    .match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/);
  return m ? m[1] : '';
}

function formatDateParts(startsAt) {
  if (!startsAt) return { iso: '', ts: null, display: '', short: '', dateOnly: '', time: '' };
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) {
    return { iso: '', ts: null, display: '', short: '', dateOnly: '', time: '' };
  }
  const iso = d.toISOString();
  const dateOnly = d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const display = `${dateOnly}, ${time}`;
  const short = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return { iso, ts: d.getTime(), display, short, dateOnly, time };
}

function formatTimeRange(startsAt, endsAt) {
  if (!startsAt) return '';
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return '';
  const fmt = (d) =>
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (!endsAt) return fmt(start);
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
}

function cardLocationLabel(row) {
  const city = String(row.city || '').trim();
  if (city) return city.slice(0, 20);
  const outcode = String(row.outcode || '').trim() || ukOutcode(row.postcode);
  if (outcode) return outcode.slice(0, 20);
  if (String(inferMeetingType(row) || '')
    .toLowerCase()
    .includes('online')) {
    return 'Online';
  }
  return '';
}

function buildDateLine(location, parsedDate, time) {
  const parts = [parsedDate.short, time, location].filter(Boolean);
  return parts.join(' · ');
}

function ticketIsApplication(row, name) {
  const ticketType = String(row.ticket_type || '').toLowerCase();
  const ticketName = String(name || row.name || '').toLowerCase();
  return ticketType.includes('application') || /application to attend/.test(ticketName);
}

function ticketIsAlumni(row, ticketName) {
  const ticketType = String(row.ticket_type || row.ticketType || '').trim();
  if (ticketType === 'Alumni') return true;
  return /^alumni/i.test(String(ticketName || row.name || '').trim());
}

function ticketIsGuestVisit(row, ticketName) {
  const ticketType = String(row.ticket_type || row.ticketType || '').trim();
  if (ticketType === 'Guest-visit') return true;
  return /^guest\s*visit$/i.test(String(ticketName || row.name || '').trim());
}

function ticketRowToTier(row, registrationCount) {
  const priceNum = parsePriceNum(row.price);
  const { display: price, priceKey } = normalizePrice(priceNum);
  const qty = row.quantity != null ? Math.max(0, Number(row.quantity)) : null;
  const sold = Math.max(0, Number(registrationCount) || 0);
  const soldOut = qty !== null && Number.isFinite(qty) && sold >= qty;
  const name = String(row.name || 'Ticket').trim();
  const ticketType = String(row.ticket_type || 'Standard').trim();
  return {
    id: row.id,
    name,
    description: String(row.description || '').trim(),
    price,
    priceKey,
    priceNum,
    soldOut,
    quantityAvailable: qty,
    registrationsCount: sold,
    label: name.slice(0, 48) || 'Ticket',
    stripePaymentLink: String(row.stripe_payment_link || '').trim(),
    ticketType,
    categoryExclusivity: ticketIsApplication(row, name),
    isGuestVisit: ticketIsGuestVisit(row, name),
    isAlumni: ticketIsAlumni(row, name),
    isMembersOnly: isMembersOnlyTicket(row),
    visibility: String(row.visibility || 'public').toLowerCase(),
    saleEnd: row.sale_ends_at || null,
  };
}

async function fetchRegistrationCountsByTicket(sb, ticketRows) {
  const ids = (ticketRows || []).map((t) => t.id).filter(Boolean);
  if (!ids.length) return new Map();

  const counts = new Map();
  for (let i = 0; i < ids.length; i += IN_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + IN_CHUNK_SIZE);
    let data;
    let error;
    ({ data, error } = await sb
      .from('registrations')
      .select('ticket_id, quantity')
      .in('ticket_id', chunk)
      .eq('application_status', 'Approved')
      .neq('payment_status', 'Refunded'));
    if (error && /quantity/i.test(String(error.message || ''))) {
      ({ data, error } = await sb
        .from('registrations')
        .select('ticket_id')
        .in('ticket_id', chunk)
        .eq('application_status', 'Approved')
        .neq('payment_status', 'Refunded'));
    }
    if (error) throw new Error(error.message);
    (data || []).forEach((row) => {
      if (!row.ticket_id) return;
      const sold = Math.max(1, Number(row.quantity) || 1);
      counts.set(row.ticket_id, (counts.get(row.ticket_id) || 0) + sold);
    });
  }
  return counts;
}

function fallbackTicketTier(event) {
  return {
    id: event.id + '-standard',
    name: 'Standard ticket',
    description: event.priceKey === 'free' ? 'Free admission' : 'Ticket includes full event access',
    price: event.price,
    priceKey: event.priceKey,
    priceNum: event.priceNum,
    soldOut: Boolean(event.isSoldOut),
    quantityAvailable: event.spotsLeft,
    label: 'Standard',
  };
}

function rowToEvent(row, organiser, ticketRows, organiserRanking) {
  const title = String(row.title || '').trim();
  let descText = plainEventDescription(row.description);
  if (!descText && Array.isArray(row.highlights)) {
    descText = row.highlights.join('\n');
  }
  const typeRaw = normalizeEventType(row.event_type);
  const typeCategory = parseTypeCategory(typeRaw);
  const type = slugifyType(typeRaw);
  const format = inferMeetingType(row);
  const eventTypeLabel = resolvedEventType(row, typeRaw);
  const location = String(row.location_label || row.city || row.venue || '').trim();
  const city = String(row.city || '').trim();
  const locationShort = cardLocationLabel(row) || location.slice(0, 20);
  const postcode = String(row.postcode || '').trim();
  const venue = String(row.venue || '').trim();
  const industry = Array.isArray(row.industries) ? row.industries[0] || '' : '';
  const nextDateRaw = row.next_date || row.starts_at;
  const parsedDate = formatDateParts(nextDateRaw);
  const time = formatTimeRange(row.starts_at, row.ends_at) || parsedDate.time || '';

  const eventTickets = (ticketRows || []).filter((t) => t.event_id === row.id);
  const tiers = eventTickets.map((t) =>
    ticketRowToTier(t, t._registrationCount != null ? t._registrationCount : 0)
  );
  const publicTiers = tiers.filter(
    (t) => !t.isGuestVisit && !t.isAlumni && !t.isMembersOnly
  );
  const membersOnlyTierCount = tiers.filter((t) => t.isMembersOnly).length;
  const pricedTiers = publicTiers.length ? publicTiers : [];
  pricedTiers.sort((a, b) => {
    if (a.soldOut !== b.soldOut) return a.soldOut ? 1 : -1;
    return a.priceNum - b.priceNum;
  });

  let priceNum = pricedTiers.length
    ? Math.min(...pricedTiers.map((t) => t.priceNum).filter((n) => n >= 0))
    : 0;
  if (!pricedTiers.length) priceNum = 0;
  const { display: price, priceKey } = normalizePrice(priceNum);
  const hasFreeTickets = pricedTiers.some((t) => t.priceNum === 0);
  const hasPaidTickets = pricedTiers.some((t) => t.priceNum > 0);

  const hasTicketTiers = eventTickets.length > 0;
  const spotsLeft = null;
  const isSoldOut = hasTicketTiers && pricedTiers.length > 0 && pricedTiers.every((t) => t.soldOut);
  const ticketsOnSale = eventHasTicketsOnSale(eventTickets);
  const ticketSalesOpensAtDate = earliestTicketSaleStart(eventTickets);
  const ticketSalesOpensAt = ticketSalesOpensAtDate ? ticketSalesOpensAtDate.toISOString() : null;
  const ticketSalesOpensLabel = ticketSalesOpensAt
    ? formatTicketSalesOpensLabel(ticketSalesOpensAtDate)
    : '';
  const ticketSalesOpensShort = ticketSalesOpensAt
    ? formatTicketSalesOpensShort(ticketSalesOpensAtDate)
    : '';
  const ticketSalesEnabled = resolveTicketSalesEnabled(row, eventTickets);
  const isTicketSalesScheduled =
    isEventPublishedForSale(row) && hasTicketTiers && !ticketsOnSale && Boolean(ticketSalesOpensAt);
  const isTicketSalesPending =
    isEventPublishedForSale(row) && hasTicketTiers && !ticketsOnSale && !isTicketSalesScheduled;
  const connectRequired = connectRequiredForPaidCheckout() && hasPaidTickets;
  const connectReady =
    !connectRequired ||
    Boolean(
      organiser &&
        organiser.stripe_account_id &&
        organiser.stripe_charges_enabled &&
        organiser.stripe_connect_details_submitted
    );
  const isSalesClosed =
    isSoldOut ||
    !ticketSalesEnabled ||
    !ticketsOnSale ||
    (connectRequired && !connectReady);
  let salesClosedReason = '';
  if (isTicketSalesScheduled) salesClosedReason = 'scheduled';
  else if (!hasTicketTiers) salesClosedReason = 'no_tickets';
  else if (!ticketSalesEnabled) salesClosedReason = 'organiser_pending';
  else if (connectRequired && !connectReady) salesClosedReason = 'stripe_connect';
  else if (!ticketsOnSale) salesClosedReason = 'no_tickets';
  else if (isSoldOut) salesClosedReason = 'sold_out';

  const orgName = organiser ? String(organiser.name || '').trim() : '';

  const highlights = Array.isArray(row.highlights)
    ? row.highlights.map((h) => String(h || '').trim()).filter(Boolean)
    : [];

  const ev = {
    id: row.id,
    slug: publicEventSlug({ slug: row.slug, title }),
    title,
    description: descText,
    highlights,
    foodIncluded: Boolean(row.food_included),
    collectDietary: Boolean(row.collect_dietary),
    collectAccessibility: Boolean(row.collect_accessibility),
    date: parsedDate.dateOnly || parsedDate.display,
    dateRaw: parsedDate.iso,
    dateTs: parsedDate.ts,
    dateFieldRaw: nextDateRaw ? String(nextDateRaw) : '',
    endDateRaw: row.ends_at ? String(row.ends_at) : '',
    time,
    location,
    city,
    locationShort,
    postcode,
    outcode: String(row.outcode || '').trim() || ukOutcode(postcode),
    nextDate: nextDateRaw ? String(nextDateRaw) : '',
    nextDateTs: parsedDate.ts,
    eventType: eventTypeLabel,
    eventTypeCategory: eventTypeTabCategory(eventTypeLabel),
    address: String(row.address || '').trim(),
    venue,
    venueName: venue,
    venueAddress: [row.address, city, postcode].filter(Boolean).join(', '),
    organiserId: row.organiser_id || (organiser && organiser.id) || '',
    organiserSlug: organiser ? publicOrganiserSlug(organiser) || '' : '',
    organiserLogo: organiser ? String(organiser.photo_url || '') : '',
    organiserProfile: organiser ? String(organiser.description || '') : '',
    industry: String(industry),
    format,
    type,
    typeRaw: String(typeRaw),
    typeSlug: type,
    typeCategory,
    lat: row.latitude != null ? Number(row.latitude) : null,
    lng: row.longitude != null ? Number(row.longitude) : null,
    featured: isEventCurrentlyFeatured(row),
    featuredUntil: row.featured_until || null,
    price,
    priceKey,
    priceNum,
    photo: eventImageUrl(row),
    photoPosition: normalizeEventImagePosition(row.image_position),
    organiser: orgName,
    rating: Number(row.average_rating) || 0,
    reviews: Number(row.review_count) || 0,
    isApprovalRequired:
      normalizeAttendanceMode(row.attendance_mode) === 'category_exclusivity' ||
      row.auto_approve === false ||
      tiers.some((t) => t.categoryExclusivity || /application/i.test(t.ticketType || '')),
    isSoldOut,
    isSalesClosed,
    isTicketSalesPending,
    isTicketSalesScheduled,
    ticketSalesEnabled,
    ticketSalesOpensAt,
    ticketSalesOpensLabel,
    ticketSalesOpensShort,
    hasTicketTiers,
    salesClosedReason,
    spotsLeft,
    capacity: null,
    urgency: '',
    dateLine: buildDateLine(locationShort, parsedDate, time),
    meetingType: format || typeRaw,
    hasFreeTickets,
    hasPaidTickets,
    search: [title, descText, location, city, postcode, orgName, typeRaw, format, row.event_type]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
    listingStatusRaw: row.approval_status || 'Pending Review',
    organiserListingStatusRaw: organiser ? organiser.listing_status || '' : '',
    organiserRanking: organiserRanking || null,
    organiserRankingLabel: organiserRanking?.cardLabel || '',
    locationSlug: slugLocation(location),
    industrySlug: slugIndustry(industry),
    formatSlug: slugFormat(format),
    tickets: pricedTiers.length ? pricedTiers : [],
    hasMembersOnlyTiers: membersOnlyTierCount > 0,
    attendanceMode: normalizeAttendanceMode(row.attendance_mode),
    complimentaryVisitsAllowed: organiser
      ? Math.min(3, Math.max(0, Number(organiser.complimentary_visits_allowed) || 0))
      : 0,
    guestVisitTier: tiers.find((t) => t.isGuestVisit) || null,
    alumniFastPassEnabled: Boolean(row.alumni_fast_pass_enabled),
    alumniTier: tiers.find((t) => t.isAlumni) || null,
    guestPassesDisabled: Boolean(row.guest_passes_disabled),
    refundPolicy: row.refund_policy || null,
    refundPolicyDetails: row.refund_policy_details || null,
    refundCutoffDays: row.refund_cutoff_days != null ? Number(row.refund_cutoff_days) : null,
    vatTreatment: row.vat_treatment || null,
    stripePaymentLink: String(row.stripe_payment_link || '').trim(),
    recurrencePattern: row.recurrence_pattern || null,
    recurrenceEndDate: row.recurrence_end_date || null,
    seriesGroupId: row.series_group_id || null,
  };

  if (!ev.tickets.length && hasTicketTiers && !membersOnlyTierCount) {
    ev.tickets = [fallbackTicketTier(ev)];
  }
  return ev;
}

function isPublicEvent(row, organiser) {
  if (!row.starts_at && !row.next_date) return false;
  if (String(row.approval_status || '').trim() !== 'Approved') return false;
  const status = String(row.status || 'published').toLowerCase();
  if (status !== 'published') return false;
  if (organiser && organiser.listing_status === 'draft') return false;
  if (organiser && organiser.listing_status === 'unpublished') return false;
  return true;
}

function isApprovedPublicEventPayload(ev) {
  return String(ev?.listingStatusRaw || '').trim() === 'Approved';
}

function ticketPriceNum(ticket) {
  const n = Number(String(ticket?.price ?? '').replace(/[£,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Auto-approve when the organiser has completed everything needed for public browse. */
function eventRowReadyForAutoApproval(row, organiser, tickets, refundPayload) {
  if (!row) return false;
  if (!String(row.title || '').trim()) return false;
  if (!row.starts_at) return false;
  if (!row.organiser_id) return false;
  if (!String(row.event_type || '').trim()) return false;
  if (!String(row.meeting_type || '').trim()) return false;

  const ticketList = Array.isArray(tickets) ? tickets : [];
  if (!ticketList.length) return false;

  const refundPolicy = String(refundPayload?.refundPolicy || row.refund_policy || '').trim();
  if (!refundPolicy) return false;
  const refundAgreed = Boolean(
    refundPayload?.refundTermsAgreed ?? row.refund_terms_agreed ?? row.refund_terms_agreed_at
  );
  if (!refundAgreed) return false;

  const hasPaidTickets = ticketList.some((t) => ticketPriceNum(t) > 0);
  const vatTreatment = String(refundPayload?.vatTreatment || row.vat_treatment || '').trim();
  if (hasPaidTickets && !vatTreatment) return false;

  if (organiser) {
    const listingStatus = String(organiser.listing_status || '').toLowerCase();
    // Draft/null profiles are auto-published when the event goes live.
    if (listingStatus === 'unpublished') return false;
  }

  return true;
}

/** End instant used for browse/related listings (prefer ends_at over starts_at). */
function browseEventEndRaw(source) {
  if (!source) return null;
  return (
    source.ends_at ||
    source.starts_at ||
    source.next_date ||
    source.endDateRaw ||
    source.dateRaw ||
    source.nextDate ||
    source.dateFieldRaw ||
    null
  );
}

function isUpcomingBrowseEventRow(row) {
  const endRaw = browseEventEndRaw(row);
  if (!endRaw) return false;
  const d = new Date(endRaw);
  if (Number.isNaN(d.getTime())) return false;
  return d >= new Date();
}

function isUpcomingBrowseEvent(ev) {
  const endRaw = browseEventEndRaw(ev);
  if (!endRaw) return false;
  const d = new Date(endRaw);
  if (Number.isNaN(d.getTime())) return false;
  return d >= new Date();
}

function bestSeriesPhotoFromRows(rows) {
  for (const row of rows || []) {
    const url = eventImageUrl(row);
    if (url) return url;
  }
  return '';
}

function enrichEventPhotoFromSeries(event, siblingRows) {
  if (!event || event.photo) return event;
  const inherited = bestSeriesPhotoFromRows(siblingRows);
  if (inherited) event.photo = inherited;
  return event;
}

function seriesDatePayload(ev) {
  return {
    id: ev.id,
    slug: ev.slug,
    dateRaw: ev.dateRaw,
    endDateRaw: ev.endDateRaw,
    date: ev.date,
    time: ev.time,
    dateTs: ev.dateTs,
    isSoldOut: ev.isSoldOut,
    isSalesClosed: ev.isSalesClosed,
    price: ev.price,
    priceKey: ev.priceKey,
    priceNum: ev.priceNum,
    tickets: ev.tickets,
    venue: ev.venue,
    venueName: ev.venueName,
    venueAddress: ev.venueAddress,
    address: ev.address,
    city: ev.city,
    postcode: ev.postcode,
    location: ev.location,
    locationShort: ev.locationShort,
    outcode: ev.outcode,
    lat: ev.lat,
    lng: ev.lng,
  };
}

async function fetchEventSeriesDates(sb, row, organiser) {
  const siblings = (await fetchSeriesSiblingRows(sb, row)).filter((r) =>
    isPublicEvent(r, organiser)
  );
  const hasRecurrenceMeta = Boolean(row.series_group_id || row.recurrence_pattern);
  if (siblings.length <= 1 || (!hasRecurrenceMeta && siblings.length < 2)) {
    return { seriesDates: [], siblingRows: siblings };
  }

  siblings.sort((a, b) => new Date(a.starts_at || 0) - new Date(b.starts_at || 0));

  const eventIds = siblings.map((s) => s.id);
  const ticketsRaw = await fetchRowsInChunks(sb, 'tickets', 'event_id', eventIds);
  const regCounts = await fetchRegistrationCountsByTicket(sb, ticketsRaw);
  const ticketsByEvent = new Map();
  (ticketsRaw || []).forEach((t) => {
    const count = regCounts.get(t.id) || 0;
    const enriched = { ...t, _registrationCount: count };
    if (!ticketsByEvent.has(t.event_id)) ticketsByEvent.set(t.event_id, []);
    ticketsByEvent.get(t.event_id).push(enriched);
  });

  return {
    seriesDates: siblings.map((r) =>
      seriesDatePayload(rowToEvent(r, organiser, ticketsByEvent.get(r.id) || []))
    ),
    siblingRows: siblings,
  };
}

async function fetchSeriesSiblingRows(sb, row) {
  if (!row) return [];

  if (row.series_group_id) {
    const { data, error } = await sb
      .from('events')
      .select('*')
      .eq('series_group_id', row.series_group_id)
      .eq('approval_status', 'Approved')
      .eq('status', 'published')
      .order('starts_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map((r) => ({ ...r, next_date: r.starts_at }));
  }

  const titleKey = String(row.title || '')
    .trim()
    .toLowerCase();
  const organiserId = row.organiser_id || '';
  if (!titleKey || !organiserId) return [];

  const pattern = String(row.recurrence_pattern || '').trim().toLowerCase();
  const endDate = String(row.recurrence_end_date || '')
    .trim()
    .slice(0, 10);

  const { data, error } = await sb
    .from('events')
    .select('*')
    .eq('organiser_id', organiserId)
    .eq('approval_status', 'Approved')
    .eq('status', 'published')
    .order('starts_at', { ascending: true });
  if (error) throw new Error(error.message);

  return (data || [])
    .filter((r) => {
      if (
        String(r.title || '')
          .trim()
          .toLowerCase() !== titleKey
      ) {
        return false;
      }
      if (pattern && endDate) {
        return (
          String(r.recurrence_pattern || '').trim().toLowerCase() === pattern &&
          String(r.recurrence_end_date || '')
            .trim()
            .slice(0, 10) === endDate
        );
      }
      return true;
    })
    .map((r) => ({ ...r, next_date: r.starts_at }));
}

async function fetchRelatedPublishedRows(sb, organiserId, excludeIds, limit) {
  const exclude = new Set((excludeIds || []).filter(Boolean));
  if (!organiserId) return [];

  const { data, error } = await sb
    .from('events')
    .select('*')
    .eq('organiser_id', organiserId)
    .eq('approval_status', 'Approved')
    .eq('status', 'published')
    .order('starts_at', { ascending: true })
    .limit(Math.min(Math.max(limit + exclude.size + 4, limit), 24));
  if (error) throw new Error(error.message);

  return (data || [])
    .map((r) => ({ ...r, next_date: r.starts_at }))
    .filter((r) => !exclude.has(r.id) && isUpcomingBrowseEventRow(r))
    .slice(0, limit);
}

async function eventsFromPublishedRows(sb, rows, knownOrganiser, options = {}) {
  const list = rows || [];
  const browseList = Boolean(options.browseList);
  const eventIds = list.map((e) => e.id);
  const orgIds = [...new Set(list.map((e) => e.organiser_id).filter(Boolean))];
  const ticketSelect = browseList ? BROWSE_TICKET_COLUMNS : '*';
  const organiserSelect = browseList ? BROWSE_ORGANISER_COLUMNS : '*';

  const ticketsPromise = eventIds.length
    ? fetchRowsInChunks(sb, 'tickets', 'event_id', eventIds, ticketSelect)
    : Promise.resolve([]);

  let organisersPromise = Promise.resolve([]);
  if (
    knownOrganiser &&
    orgIds.length === 1 &&
    String(knownOrganiser.id) === String(orgIds[0])
  ) {
    organisersPromise = Promise.resolve([knownOrganiser]);
  } else if (orgIds.length) {
    organisersPromise = fetchRowsInChunks(sb, 'organisers', 'id', orgIds, organiserSelect);
  }

  const rankingsPromise = (async () => {
    if (!orgIds.length) return {};
    try {
      const { loadCurrentRankingsByOrganiserId } = require('./organiser-ranking-snapshot');
      return await loadCurrentRankingsByOrganiserId(orgIds);
    } catch {
      return {};
    }
  })();

  let [tickets, organisers, rankingsByOrg] = await Promise.all([
    ticketsPromise,
    organisersPromise,
    rankingsPromise,
  ]);

  if (!browseList && tickets.length) {
    const regCounts = await fetchRegistrationCountsByTicket(sb, tickets);
    tickets = tickets.map((t) => ({ ...t, _registrationCount: regCounts.get(t.id) || 0 }));
  }

  const orgById = new Map(organisers.map((o) => [o.id, o]));
  const ticketsByEvent = new Map();
  tickets.forEach((ticket) => {
    if (!ticketsByEvent.has(ticket.event_id)) ticketsByEvent.set(ticket.event_id, []);
    ticketsByEvent.get(ticket.event_id).push(ticket);
  });

  return list
    .map((row) => {
      const org = row.organiser_id ? orgById.get(row.organiser_id) : null;
      if (!isPublicEvent(row, org)) return null;
      const eventTickets = ticketsByEvent.get(row.id) || [];
      const ranking = row.organiser_id ? rankingsByOrg[row.organiser_id] || null : null;
      const ev = rowToEvent(row, org, eventTickets, ranking);
      if (!ev.hasTicketTiers) return null;
      return browseList ? stripBrowseListPayload(ev) : ev;
    })
    .filter(Boolean);
}

function isMissingPublishedEventsView(error) {
  const msg = String(error?.message || error || '').toLowerCase();
  return (
    msg.includes('published_events') &&
    (msg.includes('does not exist') ||
      msg.includes('relation') ||
      msg.includes('schema cache') ||
      msg.includes('could not find'))
  );
}

function isStalePublishedEventsView(error) {
  const msg = String(error?.message || error || '').toLowerCase();
  return msg.includes('published_events') && msg.includes('image_url');
}

/** Query events table directly — published_events view can lag behind new columns (e.g. image_url). */
async function fetchPublishedEventsFromTable(sb, options = {}) {
  let query = sb
    .from('events')
    .select('*')
    .eq('approval_status', 'Approved')
    .eq('status', 'published')
    .not('starts_at', 'is', null)
    .order('starts_at', { ascending: true, nullsFirst: false });
  if (options.upcomingOnly) {
    query = query.or(upcomingBrowseOrFilter());
  }
  const tableRes = await query;
  if (tableRes.error) throw new Error(tableRes.error.message);
  return (tableRes.data || []).map((row) => ({ ...row, next_date: row.starts_at }));
}

async function fetchPublishedEventRows(sb, options = {}) {
  let query = sb
    .from('published_events')
    .select('*')
    .order('next_date', { ascending: true, nullsFirst: false });
  if (options.upcomingOnly) {
    query = query.or(upcomingBrowseOrFilter());
  }
  const viewRes = await query;
  if (!viewRes.error) {
    const rows = viewRes.data || [];
    if (rows.length && rows[0].image_url === undefined && rows[0].photo_url !== undefined) {
      return fetchPublishedEventsFromTable(sb, options);
    }
    return rows;
  }

  if (!isMissingPublishedEventsView(viewRes.error) && !isStalePublishedEventsView(viewRes.error)) {
    throw new Error(viewRes.error.message);
  }

  return fetchPublishedEventsFromTable(sb, options);
}

async function fetchPublishedEventById(sb, recordId) {
  const tableRes = await sb.from('events').select('*').eq('id', recordId).maybeSingle();
  if (tableRes.error) throw new Error(tableRes.error.message);
  if (
    !tableRes.data ||
    tableRes.data.approval_status !== 'Approved' ||
    String(tableRes.data.status || 'published').toLowerCase() !== 'published'
  ) {
    return null;
  }
  return { ...tableRes.data, next_date: tableRes.data.starts_at };
}

function slugMatchesPublicRow(row, requestedSlug) {
  const want = String(requestedSlug || '').trim().toLowerCase();
  if (!want || !row) return false;
  const stored = row.slug ? String(row.slug).trim().toLowerCase() : '';
  if (stored && stored === want) return true;
  const computed = publicEventSlug({ slug: row.slug, title: row.title });
  return computed && String(computed).trim().toLowerCase() === want;
}

function isPublishedApprovedEventRow(row) {
  if (!row) return false;
  if (row.approval_status !== 'Approved') return false;
  if (String(row.status || 'published').toLowerCase() !== 'published') return false;
  if (!row.starts_at) return false;
  return true;
}

function asPublishedEventRow(row) {
  return { ...row, next_date: row.starts_at };
}

async function fetchPublishedEventBySlug(sb, slug) {
  const s = String(slug || '').trim();
  if (!s) return null;

  // Share/fallback links may use /events/:uuid — resolve by id before slug scan.
  const { isUuid } = require('./uuid');
  if (isUuid(s)) {
    const byId = await fetchPublishedEventById(sb, s);
    if (byId) return byId;
  }

  const tableRes = await sb.from('events').select('*').eq('slug', s).maybeSingle();
  if (tableRes.error) throw new Error(tableRes.error.message);
  if (tableRes.data && isPublishedApprovedEventRow(tableRes.data)) {
    return asPublishedEventRow(tableRes.data);
  }

  const prefix = s.replace(/-\d+$/, '') || s;
  const { data: slugCandidates, error: slugErr } = await sb
    .from('events')
    .select('*')
    .eq('approval_status', 'Approved')
    .eq('status', 'published')
    .not('starts_at', 'is', null)
    .ilike('slug', prefix + '%')
    .limit(32);
  if (slugErr) throw new Error(slugErr.message);
  let match = (slugCandidates || []).find((row) => slugMatchesPublicRow(row, s));
  if (match) return asPublishedEventRow(match);

  // Title-derived slugs — scan id/slug/title only, then load the winning row.
  const { data: slimRows, error: slimErr } = await sb
    .from('published_events')
    .select('id, slug, title')
    .order('next_date', { ascending: false, nullsFirst: false })
    .limit(2500);
  if (slimErr) throw new Error(slimErr.message);
  const slimHit = (slimRows || []).find((row) => slugMatchesPublicRow(row, s));
  if (!slimHit) return null;
  return fetchPublishedEventById(sb, slimHit.id);
}

async function fetchTicketedEventIds(sb) {
  const ids = new Set();
  const { data, error } = await sb.from('tickets').select('event_id');
  if (error) throw new Error(error.message);
  (data || []).forEach((row) => {
    if (row.event_id) ids.add(row.event_id);
  });
  return ids;
}

async function fetchApprovedEvents(sb, options = {}) {
  const browseList = options.browseList !== false;
  const [rows, ticketEventIds] = await Promise.all([
    fetchPublishedEventRows(sb, { upcomingOnly: browseList }),
    browseList ? fetchTicketedEventIds(sb) : Promise.resolve(null),
  ]);
  let list = rows;
  if (browseList && ticketEventIds && list.length) {
    list = list.filter((row) => ticketEventIds.has(row.id));
  }
  const mapped = await eventsFromPublishedRows(sb, list, null, { browseList });
  return mapped.filter((ev) => isApprovedPublicEventPayload(ev) && isUpcomingBrowseEvent(ev));
}

async function handle(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');

  const cfg = supabaseConfig();
  if (!isSupabaseConfigured()) {
    return res.status(200).json({
      configured: false,
      provider: 'supabase',
      message:
        'Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, set DATA_PROVIDER=supabase, then Redeploy.',
      events: [],
      envCheck: {
        hasSupabaseUrl: Boolean(cfg.url),
        hasSupabaseServiceKey: Boolean(cfg.serviceKey),
      },
    });
  }

  try {
    const sb = getSupabaseAdmin();
    const recordId = req.query?.id;
    const slug = req.query?.slug;
    const organiserId = String(req.query?.organiserId || '').trim();
    const excludeId = String(req.query?.exclude || req.query?.excludeId || '').trim();

    if (organiserId && !recordId && !slug) {
      const limit = Math.min(Math.max(parseInt(String(req.query?.limit || ''), 10) || 8, 1), 12);
      let organiser = null;
      const { data: org } = await sb.from('organisers').select('*').eq('id', organiserId).maybeSingle();
      organiser = org;
      const rows = await fetchRelatedPublishedRows(
        sb,
        organiserId,
        excludeId ? [excludeId] : [],
        limit
      );
      const events = await eventsFromPublishedRows(sb, rows, organiser);
      return res.status(200).json({
        configured: true,
        provider: 'supabase',
        events: events.filter(
          (ev) => isApprovedPublicEventPayload(ev) && isUpcomingBrowseEvent(ev)
        ),
      });
    }

    if (recordId || slug) {
      const row = recordId
        ? await fetchPublishedEventById(sb, recordId)
        : await fetchPublishedEventBySlug(sb, slug);
      if (!row) {
        return res.status(404).json({
          configured: true,
          provider: 'supabase',
          error: 'not_found',
          message: 'This event is not published.',
          event: null,
        });
      }

      let organiser = null;
      if (row.organiser_id) {
        const { data: org } = await sb.from('organisers').select('*').eq('id', row.organiser_id).maybeSingle();
        organiser = org;
        if (organiser && !isPublicEvent(row, organiser)) {
          return res.status(404).json({
            configured: true,
            provider: 'supabase',
            error: 'not_found',
            event: null,
          });
        }
      }

      const eventId = row.id;
      const organiserRankingPromise = organiser?.id
        ? (async () => {
            try {
              const { loadCurrentRankingsByOrganiserId } = require('./organiser-ranking-snapshot');
              const map = await loadCurrentRankingsByOrganiserId([organiser.id]);
              return map[organiser.id] || null;
            } catch {
              return null;
            }
          })()
        : Promise.resolve(null);
      const [{ data: ticketsRaw }, seriesResult, relatedRows, organiserRanking] = await Promise.all([
        sb.from('tickets').select('*').eq('event_id', eventId),
        fetchEventSeriesDates(sb, row, organiser),
        row.organiser_id
          ? fetchRelatedPublishedRows(sb, row.organiser_id, [row.id], 6)
          : Promise.resolve([]),
        organiserRankingPromise,
      ]);
      const seriesDates = seriesResult.seriesDates || [];
      const seriesSiblingRows = seriesResult.siblingRows || [];
      const ticketsList = ticketsRaw || [];
      const regCounts = await fetchRegistrationCountsByTicket(sb, ticketsList);
      const tickets = ticketsList.map((t) => ({
        ...t,
        _registrationCount: regCounts.get(t.id) || 0,
      }));
      const event = enrichEventPhotoFromSeries(
        rowToEvent(row, organiser, tickets, organiserRanking),
        seriesSiblingRows
      );
      if (!event.hasTicketTiers) {
        return res.status(404).json({
          configured: true,
          provider: 'supabase',
          error: 'not_found',
          message: 'This event is not published.',
          event: null,
        });
      }
      event.isSeries = seriesDates.length > 1;
      const seriesIds = new Set(seriesDates.map((d) => d.id));
      const relatedFiltered = (relatedRows || []).filter((r) => !seriesIds.has(r.id));
      const related = await eventsFromPublishedRows(sb, relatedFiltered, organiser);
      const publicRelated = related.filter(
        (ev) => isApprovedPublicEventPayload(ev) && isUpcomingBrowseEvent(ev)
      );
      // Ticket rows are replaced when an organiser edits an event, which changes their IDs.
      // Never cache detail payloads or checkout can receive a stale ticket ID.
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      return res.status(200).json({
        configured: true,
        provider: 'supabase',
        event,
        seriesDates: seriesDates.length > 1 ? seriesDates : [],
        related: publicRelated,
      });
    }

    if (String(req.query?.all || '') === '1') {
      const events = await fetchApprovedEvents(sb);
      return res.status(200).json({ configured: true, provider: 'supabase', events });
    }

    const meta = String(req.query?.meta || '').trim();
    if (meta === 'featured-slots') {
      const { getFeaturedSpotlightSlotStatus } = require('./event-featured-slots');
      const featuredSlots = await getFeaturedSpotlightSlotStatus();
      res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60');
      return res.status(200).json({
        configured: true,
        provider: 'supabase',
        ok: true,
        featuredSlots,
      });
    }

    const { fetchBrowseEventsPage } = require('./browse-events-query');
    const payload = await fetchBrowseEventsPage(sb, req.query || {});
    return res.status(200).json({
      configured: true,
      provider: 'supabase',
      browse: true,
      events: payload.events,
      featured: payload.featured || [],
      pagination: payload.pagination,
      meta: payload.meta,
    });
  } catch (e) {
    return res.status(500).json({
      configured: true,
      provider: 'supabase',
      error: 'server_error',
      message: e.message,
      events: [],
    });
  }
}

module.exports = {
  handle,
  rowToEvent,
  ticketRowToTier,
  fetchRegistrationCountsByTicket,
  fetchApprovedEvents,
  fetchPublishedEventRows,
  fetchPublishedEventBySlug,
  fetchEventSeriesDates,
  eventsFromPublishedRows,
  isApprovedPublicEventPayload,
  isPublicEvent,
  isUpcomingBrowseEvent,
  eventRowReadyForAutoApproval,
  isUpcomingBrowseEventRow,
  ukOutcode,
  slugFormat,
  eventTypeTabCategory,
};
