/**
 * Scan published events for missing data that breaks public listings.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { publicEventSlug } = require('./event-slug');
const { publicOrganiserSlug } = require('./organiser-slug');
const { normalizeEventType } = require('./event-types');
const { scanEventForOffPlatformBooking } = require('./off-platform-booking');
const { scanEventListingLanguage } = require('./listing-language-moderation');

function listingLanguageExcerpts(languageScan) {
  const excerpts = [];
  (languageScan?.fields || []).forEach((field) => {
    (field.excerpts || []).forEach((item) => {
      const clean = String(item || '').trim();
      if (clean && !excerpts.includes(clean)) excerpts.push(clean);
    });
  });
  return excerpts;
}

const ISSUE_DEFS = {
  missing_date: { label: 'Missing event date', severity: 'high' },
  missing_organiser: { label: 'No organiser linked', severity: 'high' },
  invalid_organiser: { label: 'Organiser link broken', severity: 'high' },
  listing_hate_speech: { label: 'Hate speech / extreme abuse in listing', severity: 'high' },
  organiser_not_published: { label: 'Organiser profile not published', severity: 'medium' },
  missing_organiser_logo: { label: 'Organiser has no logo', severity: 'medium' },
  missing_organiser_profile: { label: 'Organiser profile empty', severity: 'medium' },
  missing_vat: { label: 'VAT not set (paid tickets)', severity: 'medium' },
  off_platform_booking: {
    label: 'Off-platform booking (Eventbrite / Luma / Ticket Tailor / Net Hub / etc.)',
    severity: 'medium',
  },
  listing_profanity: { label: 'Strong language in listing', severity: 'medium' },
  missing_event_type: { label: 'Event type not set', severity: 'low' },
  missing_meeting_type: { label: 'Format not set', severity: 'low' },
  stale_past_date: { label: 'Event date is in the past', severity: 'medium' },
};

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };
const PAGE_SIZE = 1000;
const SCAN_CACHE_MS = 60 * 1000;
const EVENT_HEALTH_COLUMNS =
  'id, title, slug, description, organiser_id, starts_at, ends_at, event_type, meeting_type, vat_treatment, locked, status, meeting_link, location_label, venue';
const ORGANISER_HEALTH_COLUMNS =
  'id, name, photo_url, description, listing_status, slug, website';

let scanCache = { at: 0, report: null, inflight: null };

function issuePayload(code) {
  const def = ISSUE_DEFS[code] || { label: code, severity: 'low' };
  return { code, label: def.label, severity: def.severity };
}

function normalizeMeetingType(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const formats = ['In person', 'Online'];
  const exact = formats.find((f) => f.toLowerCase() === s.toLowerCase());
  return exact || s;
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

async function fetchAllRows(sb, buildQuery) {
  let from = 0;
  const all = [];

  while (true) {
    const res = await buildQuery(from, from + PAGE_SIZE - 1);
    if (res.error) throw res.error;
    const batch = res.data || [];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

async function fetchPublishedRows(sb) {
  try {
    return await fetchAllRows(sb, (from, to) =>
      sb
        .from('events')
        .select(EVENT_HEALTH_COLUMNS)
        .eq('status', 'published')
        .order('id', { ascending: true })
        .range(from, to)
    );
  } catch (tableErr) {
    const viewRes = await sb
      .from('published_events')
      .select(EVENT_HEALTH_COLUMNS)
      .order('id', { ascending: true });
    if (!viewRes.error) return viewRes.data || [];

    const tableMsg = String(tableErr?.message || tableErr || '');
    const viewMsg = String(viewRes.error?.message || viewRes.error || '');
    if (!isMissingPublishedEventsView(tableErr) && !isMissingPublishedEventsView(viewRes.error)) {
      throw new Error(tableMsg || viewMsg || 'Could not load published events');
    }

    return fetchAllRows(sb, (from, to) =>
      sb
        .from('events')
        .select(EVENT_HEALTH_COLUMNS)
        .eq('approval_status', 'Approved')
        .eq('status', 'published')
        .order('id', { ascending: true })
        .range(from, to)
    );
  }
}

async function fetchAllOrganisers(sb) {
  return fetchAllRows(sb, (from, to) =>
    sb
      .from('organisers')
      .select(ORGANISER_HEALTH_COLUMNS)
      .order('id', { ascending: true })
      .range(from, to)
  );
}

async function fetchPaidTicketEventIds(sb) {
  const rows = await fetchAllRows(sb, (from, to) =>
    sb.from('tickets').select('event_id, price').gt('price', 0).range(from, to)
  );
  const ids = new Set();
  rows.forEach((ticket) => {
    if (ticket.event_id && ticketPrice(ticket) > 0) ids.add(ticket.event_id);
  });
  return ids;
}

async function fetchRegistrationStats(sb) {
  const rows = await fetchAllRows(sb, (from, to) =>
    sb.from('registrations').select('event_id, payment_status').range(from, to)
  );
  const stats = {};
  rows.forEach((row) => {
    if (!row.event_id) return;
    if (!stats[row.event_id]) stats[row.event_id] = { registration_count: 0, paid_booking_count: 0 };
    stats[row.event_id].registration_count += 1;
    if (String(row.payment_status || '').trim() === 'Paid') {
      stats[row.event_id].paid_booking_count += 1;
    }
  });
  return stats;
}

function ticketPrice(ticket) {
  return Number(ticket?.price) || 0;
}

async function scanEventHealth() {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      count: 0,
      totalPublished: 0,
      events: [],
      organisers: [],
      issuesByCode: {},
    };
  }

  const sb = getSupabaseAdmin();
  const events = await fetchPublishedRows(sb);

  // Paid tickets and registrations are small tables. Looking them up per event
  // (thousands of published rows, 80 ids at a time) ran past the admin function limit.
  const [allOrganisers, paidTicketEventIds, commerceStats] = await Promise.all([
    fetchAllOrganisers(sb),
    fetchPaidTicketEventIds(sb),
    fetchRegistrationStats(sb),
  ]);

  const orgById = new Map(allOrganisers.map((o) => [o.id, o]));

  const flagged = [];
  const issuesByCode = {};

  for (const row of events) {
    const codes = [];

    if (!row.starts_at) {
      codes.push('missing_date');
    } else {
      const startMs = new Date(row.starts_at).getTime();
      if (!Number.isNaN(startMs) && startMs < Date.now() - 86400000) {
        codes.push('stale_past_date');
      }
    }

    if (!row.organiser_id) {
      codes.push('missing_organiser');
    } else {
      const org = orgById.get(row.organiser_id);
      if (!org) {
        codes.push('invalid_organiser');
      } else {
        const listingStatus = String(org.listing_status || '').toLowerCase();
        if (listingStatus === 'draft' || listingStatus === 'unpublished') {
          codes.push('organiser_not_published');
        }
        if (!String(org.photo_url || '').trim()) codes.push('missing_organiser_logo');
        if (!String(org.description || '').trim()) codes.push('missing_organiser_profile');
      }
    }

    if (paidTicketEventIds.has(row.id) && !row.vat_treatment) codes.push('missing_vat');

    if (!String(row.event_type || '').trim()) codes.push('missing_event_type');
    if (!String(row.meeting_type || '').trim()) codes.push('missing_meeting_type');

    const offPlatformHits = scanEventForOffPlatformBooking(row);
    if (offPlatformHits.length) codes.push('off_platform_booking');

    const languageScan = scanEventListingLanguage(row);
    const languageExcerpts = listingLanguageExcerpts(languageScan);
    if (languageScan.hate.length) codes.push('listing_hate_speech');
    else if (languageScan.profanity.length) codes.push('listing_profanity');

    if (!codes.length) continue;

    codes.forEach((code) => {
      issuesByCode[code] = (issuesByCode[code] || 0) + 1;
    });

    const org = row.organiser_id ? orgById.get(row.organiser_id) : null;
    const issues = codes.map((code) => {
      if (code === 'off_platform_booking' && offPlatformHits.length) {
        const labels = offPlatformHits.map((hit) => hit.label);
        return {
          code,
          label: 'Off-platform booking: ' + labels.join(', '),
          severity: 'medium',
          platforms: labels,
        };
      }
      if (code === 'listing_hate_speech' && languageScan.hate.length) {
        return {
          code,
          label: 'Hate speech / extreme abuse in listing',
          severity: 'high',
          matches: languageExcerpts.length ? languageExcerpts : languageScan.hate,
        };
      }
      if (code === 'listing_profanity' && languageScan.profanity.length) {
        return {
          code,
          label: 'Strong language in listing',
          severity: 'medium',
          matches: languageScan.profanity,
        };
      }
      return issuePayload(code);
    });
    flagged.push({
      id: row.id,
      title: String(row.title || '').trim(),
      slug: publicEventSlug({ slug: row.slug, title: row.title }),
      organiser_id: row.organiser_id || '',
      organiser_name: org ? String(org.name || '').trim() : '',
      organiser_slug: org ? publicOrganiserSlug(org) || '' : '',
      organiser_listing_status: org ? String(org.listing_status || '').trim() : '',
      organiser_photo_url: org ? String(org.photo_url || '').trim() : '',
      organiser_description: org ? String(org.description || '').trim() : '',
      organiser_website: org ? String(org.website || '').trim() : '',
      starts_at: row.starts_at || '',
      event_type: String(row.event_type || '').trim()
        ? normalizeEventType(row.event_type)
        : '',
      meeting_type: normalizeMeetingType(row.meeting_type),
      vat_treatment: row.vat_treatment || '',
      off_platform_platforms: offPlatformHits.map((hit) => hit.label),
      language_matches: languageScan.hate.length
        ? languageExcerpts.length
          ? languageExcerpts
          : languageScan.hate
        : languageScan.profanity,
      issues,
    });
  }

  const eventById = new Map(events.map((eventRow) => [eventRow.id, eventRow]));
  flagged.forEach((row) => {
    const source = eventById.get(row.id);
    const stats = commerceStats[row.id] || { registration_count: 0, paid_booking_count: 0 };
    row.locked = Boolean(source && source.locked);
    row.ends_at = (source && source.ends_at) || row.starts_at || '';
    row.status = (source && source.status) || 'published';
    row.registration_count = stats.registration_count;
    row.paid_booking_count = stats.paid_booking_count;
  });

  return {
    configured: true,
    count: flagged.length,
    totalPublished: events.length,
    events: flagged,
    issuesByCode,
    organisers: allOrganisers
      .slice()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
      .map((o) => ({
      id: o.id,
      name: String(o.name || '').trim(),
      listingStatus: o.listing_status || '',
      slug: publicOrganiserSlug(o) || '',
    })),
  };
}

function invalidateEventHealthCache() {
  scanCache = { at: 0, report: null, inflight: null };
}

function scanEventHealthCached() {
  const now = Date.now();
  if (scanCache.report && now - scanCache.at < SCAN_CACHE_MS) {
    return Promise.resolve(scanCache.report);
  }
  if (scanCache.inflight) return scanCache.inflight;
  scanCache.inflight = scanEventHealth()
    .then((report) => {
      scanCache.report = report;
      scanCache.at = Date.now();
      scanCache.inflight = null;
      return report;
    })
    .catch((err) => {
      scanCache.inflight = null;
      throw err;
    });
  return scanCache.inflight;
}

module.exports = {
  scanEventHealth,
  scanEventHealthCached,
  invalidateEventHealthCache,
  ISSUE_DEFS,
  issuePayload,
  SEVERITY_ORDER,
};
