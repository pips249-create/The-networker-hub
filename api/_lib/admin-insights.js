/**
 * Admin platform insights — leaderboards and growth metrics from Supabase.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { parseTypeCategory } = require('./event-types');
const { isTestFixtureText, isTestRegistration } = require('./test-fixture-filters');
const { normalizeIndustry } = require('./hub-profile-industries');

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function isTestActivityText(text) {
  return isTestFixtureText(text);
}

function parsePeriod(raw) {
  const p = String(raw || '30d').trim().toLowerCase();
  return p === '7d' || p === '30d' || p === 'ytd' || p === '12m' || p === 'all' ? p : '30d';
}

function sinceIso(period) {
  if (period === 'all') return null;
  if (period === 'ytd') {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();
  }
  if (period === '12m') {
    return new Date(Date.now() - 365 * 86400000).toISOString();
  }
  const days = period === '7d' ? 7 : 30;
  return new Date(Date.now() - days * 86400000).toISOString();
}

function paidAmount(reg) {
  return reg.payment_status === 'Paid' ? Number(reg.amount_paid) || 0 : 0;
}

function registrationTicketQty(reg) {
  return Math.max(1, Number(reg?.quantity) || 1);
}

function isConfirmedSiteTicket(reg) {
  if (!reg || reg.cancelled_at) return false;
  const status = String(reg.payment_status || '').trim();
  return status === 'Paid' || status === 'Free';
}

/** Tickets bought on The Networker UK in the period (quantity, not just booking rows). */
function computeTicketVolume(regs) {
  let bookings = 0;
  let tickets = 0;
  let paidTickets = 0;
  let freeTickets = 0;
  let paidBookings = 0;
  let freeBookings = 0;
  let paidSpend = 0;

  (regs || []).forEach((reg) => {
    if (!isConfirmedSiteTicket(reg)) return;
    const qty = registrationTicketQty(reg);
    const status = String(reg.payment_status || '').trim();
    bookings += 1;
    tickets += qty;
    if (status === 'Paid') {
      paidBookings += 1;
      paidTickets += qty;
      paidSpend = round2(paidSpend + paidAmount(reg));
    } else {
      freeBookings += 1;
      freeTickets += qty;
    }
  });

  return {
    bookings,
    tickets,
    paidTickets,
    freeTickets,
    paidBookings,
    freeBookings,
    paidSpend,
  };
}

function avgRating(sum, count) {
  if (!count) return null;
  return round2(sum / count);
}

function pctChange(current, prior) {
  if (!prior) return current > 0 ? 100 : 0;
  return round2(((current - prior) / prior) * 100);
}

function locationAreaLabel(value) {
  const raw = String(value || '').trim().replace(/\s+/g, ' ');
  if (!raw) return '';

  let area = raw.split(',')[0].trim();
  const postcode = area.match(/\b([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}\b/i);
  if (postcode) {
    const withoutPostcode = area.replace(postcode[0], '').trim();
    area = withoutPostcode || postcode[1].toUpperCase();
  }
  return area.replace(/\s+(?:UK|United Kingdom)$/i, '').trim() || area;
}

async function fetchAttendeeLocations(sb) {
  const rows = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb
      .from('attendees')
      .select('id, name, email, location')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return rows.filter((row) => !isTestActivityText(row.name || row.email || ''));
}

function aggregateUserLocations(attendees) {
  const areas = new Map();
  let provided = 0;

  (attendees || []).forEach((attendee) => {
    const label = locationAreaLabel(attendee.location);
    if (!label) return;
    provided += 1;
    const key = label.toLocaleLowerCase('en-GB');
    const current = areas.get(key) || { area: label, users: 0 };
    current.users += 1;
    areas.set(key, current);
  });

  return {
    total: (attendees || []).length,
    provided,
    missing: Math.max(0, (attendees || []).length - provided),
    areas: Array.from(areas.values())
      .sort((a, b) => b.users - a.users || a.area.localeCompare(b.area, 'en-GB'))
      .slice(0, 15),
  };
}

async function fetchAttendeeProfiles(sb) {
  const rows = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb
      .from('attendees')
      .select('id, name, email, business_sector, job_title, professional_role, supabase_user_id')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return rows.filter((row) => !isTestActivityText(row.name || row.email || ''));
}

function aggregateAttendeeProfiles(attendees) {
  const industries = new Map();
  const jobTitles = new Map();
  const roles = new Map();
  let withIndustry = 0;
  let withJobTitle = 0;
  let withBoth = 0;
  let withAccount = 0;

  (attendees || []).forEach((attendee) => {
    if (attendee.supabase_user_id) withAccount += 1;
    const industryRaw = String(attendee.business_sector || '').trim();
    const jobTitleRaw = String(attendee.job_title || '').trim();
    const industry = industryRaw ? normalizeIndustry(industryRaw) : '';
    const jobTitle = jobTitleRaw.replace(/\s+/g, ' ');

    if (industry) {
      withIndustry += 1;
      const key = industry.toLocaleLowerCase('en-GB');
      const row = industries.get(key) || { label: industry, users: 0 };
      row.users += 1;
      industries.set(key, row);
    }
    if (jobTitle) {
      withJobTitle += 1;
      const key = jobTitle.toLocaleLowerCase('en-GB');
      const row = jobTitles.get(key) || { label: jobTitle, users: 0 };
      row.users += 1;
      jobTitles.set(key, row);
    }
    if (industry && jobTitle) withBoth += 1;

    const role = String(attendee.professional_role || '').trim();
    if (role) {
      const row = roles.get(role) || { label: role, users: 0 };
      row.users += 1;
      roles.set(role, row);
    }
  });

  const total = (attendees || []).length;
  return {
    total,
    withAccount,
    withIndustry,
    withJobTitle,
    withBoth,
    missingIndustry: Math.max(0, total - withIndustry),
    missingJobTitle: Math.max(0, total - withJobTitle),
    missingBoth: Math.max(0, total - withBoth),
    industries: Array.from(industries.values())
      .sort((a, b) => b.users - a.users || a.label.localeCompare(b.label, 'en-GB'))
      .slice(0, 15),
    jobTitles: Array.from(jobTitles.values())
      .sort((a, b) => b.users - a.users || a.label.localeCompare(b.label, 'en-GB'))
      .slice(0, 15),
    professionalRoles: Array.from(roles.values())
      .sort((a, b) => b.users - a.users || a.label.localeCompare(b.label, 'en-GB'))
      .slice(0, 10),
  };
}

async function fetchRegistrations(sb, since) {
  let query = sb
    .from('registrations')
    .select(
      'id, created_at, cancelled_at, payment_status, amount_paid, quantity, application_status, screening_answer_industry, screening_answer_job_title, attendee_id, event_id, organiser_id, attendees(name, email, location), events(id, title, city, event_type), organisers(id, name)'
    )
    .order('created_at', { ascending: false });
  if (since) query = query.gte('created_at', since);
  const res = await query;
  if (res.error) throw new Error(res.error.message);
  return (res.data || []).filter((r) => !isTestRegistration(r));
}

async function fetchAllRegistrationsFiltered(sb) {
  const res = await sb
    .from('registrations')
    .select('attendee_id, event_id, organiser_id, payment_status, amount_paid, attendees(name, email), events(title)')
    .not('attendee_id', 'is', null);
  if (res.error) throw new Error(res.error.message);
  return (res.data || []).filter((r) => !isTestRegistration(r));
}

function buildRatingMaps(reviews) {
  const byEvent = new Map();
  const byOrganiser = new Map();

  reviews.forEach((r) => {
    const rating = Number(r.rating) || 0;
    if (!rating) return;

    if (r.event_id) {
      const row = byEvent.get(r.event_id) || { sum: 0, count: 0 };
      row.sum += rating;
      row.count += 1;
      byEvent.set(r.event_id, row);
    }
    if (r.organiser_id) {
      const row = byOrganiser.get(r.organiser_id) || { sum: 0, count: 0 };
      row.sum += rating;
      row.count += 1;
      byOrganiser.set(r.organiser_id, row);
    }
  });

  return { byEvent, byOrganiser };
}

function ticketCapacityByEvent(tickets) {
  const map = new Map();
  (tickets || []).forEach((t) => {
    if (!t.event_id || t.quantity == null) return;
    const qty = Number(t.quantity) || 0;
    if (qty <= 0) return;
    map.set(t.event_id, (map.get(t.event_id) || 0) + qty);
  });
  return map;
}

function aggregateInsights(regs, ratingMaps, capacityByEvent) {
  const { byEvent, byOrganiser } = ratingMaps;
  const organiserStats = new Map();
  const eventStats = new Map();
  const attendeeStats = new Map();
  const cityStats = new Map();
  const typeStats = new Map();
  const organiserAttendees = new Map();
  const funnel = { pending: 0, approved: 0, denied: 0, total: 0 };

  regs.forEach((reg) => {
    const revenue = paidAmount(reg);
    const event = reg.events || {};
    const organiser = reg.organisers || {};
    const attendee = reg.attendees || {};
    const eventId = reg.event_id || event.id;
    const organiserId = reg.organiser_id || organiser.id;

    const isApplication =
      reg.application_status === 'Pending' ||
      reg.application_status === 'Denied' ||
      Boolean(reg.screening_answer_industry || reg.screening_answer_job_title);
    if (isApplication) {
      if (reg.application_status === 'Pending') funnel.pending += 1;
      else if (reg.application_status === 'Denied') funnel.denied += 1;
      else if (reg.application_status === 'Approved') funnel.approved += 1;
    }

    if (organiserId) {
      const o = organiserStats.get(organiserId) || {
        id: organiserId,
        name: String(organiser.name || '').trim() || '—',
        revenue: 0,
        registrations: 0,
      };
      o.registrations += 1;
      o.revenue = round2(o.revenue + revenue);
      organiserStats.set(organiserId, o);

      if (reg.attendee_id) {
        const set = organiserAttendees.get(organiserId) || new Map();
        set.set(reg.attendee_id, (set.get(reg.attendee_id) || 0) + 1);
        organiserAttendees.set(organiserId, set);
      }
    }

    if (eventId) {
      const e = eventStats.get(eventId) || {
        id: eventId,
        title: String(event.title || '').trim() || '—',
        organiser: String(organiser.name || '').trim() || '—',
        city: String(event.city || '').trim() || '—',
        eventType: String(event.event_type || '').trim() || 'Event',
        revenue: 0,
        registrations: 0,
      };
      e.registrations += 1;
      e.revenue = round2(e.revenue + revenue);
      eventStats.set(eventId, e);
    }

    if (reg.attendee_id) {
      const a = attendeeStats.get(reg.attendee_id) || {
        id: reg.attendee_id,
        name: String(attendee.name || '').trim() || 'Attendee',
        email: String(attendee.email || '').trim() || '',
        location: String(attendee.location || '').trim() || '',
        spend: 0,
        eventsAttended: 0,
        eventIds: new Set(),
      };
      a.spend = round2(a.spend + revenue);
      if (eventId && !a.eventIds.has(eventId)) {
        a.eventIds.add(eventId);
        a.eventsAttended += 1;
      }
      attendeeStats.set(reg.attendee_id, a);
    }

    const city = String(event.city || '').trim();
    if (city) {
      const c = cityStats.get(city) || { city, registrations: 0, revenue: 0 };
      c.registrations += 1;
      c.revenue = round2(c.revenue + revenue);
      cityStats.set(city, c);
    }

    const eventType = String(event.event_type || 'Event').trim() || 'Event';
    const category = parseTypeCategory(eventType);
    const typeKey = category || eventType;
    const t = typeStats.get(typeKey) || { type: typeKey, count: 0, revenue: 0 };
    t.count += 1;
    t.revenue = round2(t.revenue + revenue);
    typeStats.set(typeKey, t);
  });

  const topOrganisers = Array.from(organiserStats.values())
    .map((o) => {
      const ratings = byOrganiser.get(o.id);
      const repeatSet = organiserAttendees.get(o.id);
      let repeatAttendees = 0;
      if (repeatSet) {
        repeatSet.forEach((n) => {
          if (n > 1) repeatAttendees += 1;
        });
      }
      return {
        id: o.id,
        name: o.name,
        revenue: o.revenue,
        registrations: o.registrations,
        avgRating: ratings ? avgRating(ratings.sum, ratings.count) : null,
        reviewCount: ratings ? ratings.count : 0,
        repeatAttendees,
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.registrations - a.registrations)
    .slice(0, 10);

  const topEvents = Array.from(eventStats.values())
    .map((e) => {
      const ratings = byEvent.get(e.id);
      const capacity = capacityByEvent.get(e.id) || 0;
      const fillRatePct =
        capacity > 0 ? Math.round((e.registrations / capacity) * 100) : null;
      return {
        id: e.id,
        title: e.title,
        organiser: e.organiser,
        city: e.city,
        eventType: e.eventType,
        revenue: e.revenue,
        registrations: e.registrations,
        avgRating: ratings ? avgRating(ratings.sum, ratings.count) : null,
        reviewCount: ratings ? ratings.count : 0,
        capacity: capacity || null,
        fillRatePct,
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.registrations - a.registrations)
    .slice(0, 10);

  const topAttendees = Array.from(attendeeStats.values())
    .map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      location: a.location,
      spend: a.spend,
      eventsAttended: a.eventsAttended,
    }))
    .sort((a, b) => b.spend - a.spend || b.eventsAttended - a.eventsAttended)
    .slice(0, 10);

  const topCities = Array.from(cityStats.values())
    .sort((a, b) => b.registrations - a.registrations || b.revenue - a.revenue)
    .slice(0, 12);

  const eventTypeMix = Array.from(typeStats.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return {
    topOrganisers,
    topEvents,
    topAttendees,
    topCities,
    eventTypeMix,
    applicationFunnel: {
      pending: funnel.pending,
      approved: funnel.approved,
      denied: funnel.denied,
      total: funnel.pending + funnel.approved + funnel.denied,
    },
    eventStats,
    organiserStats,
  };
}

function buildRatedLists(byEvent, byOrganiser, eventStats, organiserStats, organiserNames) {
  const topRatedOrganisers = Array.from(byOrganiser.entries())
    .filter(([, r]) => r.count >= 3)
    .map(([id, r]) => {
      const org = organiserStats.get(id);
      return {
        id,
        name: (org && org.name) || organiserNames.get(id) || '—',
        avgRating: avgRating(r.sum, r.count),
        reviewCount: r.count,
      };
    })
    .sort((a, b) => b.avgRating - a.avgRating || b.reviewCount - a.reviewCount)
    .slice(0, 10);

  const topRatedEvents = Array.from(byEvent.entries())
    .filter(([, r]) => r.count >= 3)
    .map(([id, r]) => {
      const ev = eventStats.get(id);
      return {
        id,
        title: ev ? ev.title : '—',
        organiser: ev ? ev.organiser : '—',
        avgRating: avgRating(r.sum, r.count),
        reviewCount: r.count,
      };
    })
    .sort((a, b) => b.avgRating - a.avgRating || b.reviewCount - a.reviewCount)
    .slice(0, 10);

  return { topRatedOrganisers, topRatedEvents };
}

function computeRepeatAttendees(allRegs) {
  const byAttendee = new Map();
  allRegs.forEach((r) => {
    if (!r.attendee_id) return;
    byAttendee.set(r.attendee_id, (byAttendee.get(r.attendee_id) || 0) + 1);
  });
  const total = byAttendee.size;
  let repeat = 0;
  byAttendee.forEach((n) => {
    if (n > 1) repeat += 1;
  });
  return {
    total,
    repeat,
    ratePct: total ? round2((repeat / total) * 100) : 0,
  };
}

function revenueInRange(regs, startIso, endIso) {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Infinity;
  return round2(
    regs.reduce((sum, r) => {
      const t = new Date(r.created_at).getTime();
      if (Number.isNaN(t) || t < start || t >= end) return sum;
      return sum + paidAmount(r);
    }, 0)
  );
}

async function getAdminInsights(periodRaw) {
  if (!isSupabaseConfigured()) {
    return { configured: false, provider: 'supabase' };
  }

  const period = parsePeriod(periodRaw);
  const since = sinceIso(period);
  const sb = getSupabaseAdmin();

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();

  const [
    periodRegs,
    allRegsFiltered,
    reviewsRes,
    ticketsRes,
    organisersRes,
    eventsRes,
    regs7dRes,
    orgs7dRes,
    accounts7dRes,
    revenueRegsRes,
    attendeeLocations,
    attendeeProfilesRaw,
  ] = await Promise.all([
    fetchRegistrations(sb, since),
    fetchAllRegistrationsFiltered(sb),
    sb.from('reviews').select('event_id, organiser_id, rating, created_at'),
    sb.from('tickets').select('event_id, quantity'),
    sb.from('organisers').select('id, name'),
    sb.from('events').select('id, title, organisers(name)'),
    sb
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo),
    sb
      .from('organisers')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo),
    sb
      .from('hub_accounts')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo),
    sb
      .from('registrations')
      .select('created_at, payment_status, amount_paid, attendees(name, email), events(title)')
      .gte('created_at', sixtyDaysAgo),
    fetchAttendeeLocations(sb),
    fetchAttendeeProfiles(sb),
  ]);

  if (reviewsRes.error) throw new Error(reviewsRes.error.message);
  if (ticketsRes.error) throw new Error(ticketsRes.error.message);
  if (organisersRes.error) throw new Error(organisersRes.error.message);
  if (eventsRes.error) throw new Error(eventsRes.error.message);
  if (revenueRegsRes.error) throw new Error(revenueRegsRes.error.message);

  const organiserNames = new Map(
    (organisersRes.data || []).map((o) => [o.id, String(o.name || '').trim() || '—'])
  );
  const eventTitles = new Map(
    (eventsRes.data || []).map((e) => [e.id, String(e.title || '').trim() || '—'])
  );

  const reviews = reviewsRes.data || [];
  const ratingMaps = buildRatingMaps(reviews);
  const capacityByEvent = ticketCapacityByEvent(ticketsRes.data || []);
  const aggregated = aggregateInsights(periodRegs, ratingMaps, capacityByEvent);

  const eventStats = aggregated.eventStats;
  eventTitles.forEach((title, id) => {
    if (!eventStats.has(id)) {
      eventStats.set(id, {
        id,
        title,
        organiser: '—',
        city: '—',
        eventType: 'Event',
        revenue: 0,
        registrations: 0,
      });
    }
  });

  const rated = buildRatedLists(
    ratingMaps.byEvent,
    ratingMaps.byOrganiser,
    eventStats,
    aggregated.organiserStats,
    organiserNames
  );
  delete aggregated.eventStats;
  delete aggregated.organiserStats;

  const revenueRegs = (revenueRegsRes.data || []).filter((r) => !isTestRegistration(r));
  const revenueComparison = {
    current30d: revenueInRange(revenueRegs, thirtyDaysAgo, null),
    prior30d: revenueInRange(revenueRegs, sixtyDaysAgo, thirtyDaysAgo),
    changePct: pctChange(
      revenueInRange(revenueRegs, thirtyDaysAgo, null),
      revenueInRange(revenueRegs, sixtyDaysAgo, thirtyDaysAgo)
    ),
  };

  let promoteRoi = {
    configured: false,
    totals: {},
    uniqueOrganisers: 0,
    landings: 0,
    toolUses: 0,
  };
  try {
    const { getPromoteActionStats } = require('./organiser-promote-log');
    promoteRoi = await getPromoteActionStats(period);
  } catch {
    /* table may not exist yet */
  }

  let pitchPages = {
    configured: false,
    totals: {},
    views: 0,
    pdfDownloads: 0,
    uniquePages: 0,
    pages: [],
  };
  try {
    const { getPitchPageStats } = require('./pitch-page-log');
    pitchPages = await getPitchPageStats(period);
  } catch {
    /* table may not exist yet */
  }

  return {
    configured: true,
    provider: 'supabase',
    period,
    currency: 'GBP',
    updatedAt: new Date().toISOString(),
    revenueComparison,
    ticketVolume: computeTicketVolume(periodRegs),
    promoteRoi,
    pitchPages,
    repeatAttendees: computeRepeatAttendees(allRegsFiltered),
    userLocations: aggregateUserLocations(attendeeLocations),
    attendeeProfiles: aggregateAttendeeProfiles(attendeeProfilesRaw),
    growthPulse: {
      registrations7d: regs7dRes.count || 0,
      newOrganisers7d: orgs7dRes.count || 0,
      newAccounts7d: accounts7dRes.count || 0,
    },
    ...aggregated,
    topRatedOrganisers: rated.topRatedOrganisers,
    topRatedEvents: rated.topRatedEvents,
  };
}

module.exports = { getAdminInsights };
