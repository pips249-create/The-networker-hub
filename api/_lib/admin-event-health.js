/**
 * Scan published events for missing data that breaks public listings.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { publicEventSlug } = require('./event-slug');
const { publicOrganiserSlug } = require('./organiser-slug');
const { normalizeEventType } = require('./event-types');

const ISSUE_DEFS = {
  missing_date: { label: 'Missing event date', severity: 'high' },
  missing_organiser: { label: 'No organiser linked', severity: 'high' },
  invalid_organiser: { label: 'Organiser link broken', severity: 'high' },
  organiser_not_published: { label: 'Organiser profile not published', severity: 'medium' },
  missing_organiser_logo: { label: 'Organiser has no logo', severity: 'medium' },
  missing_organiser_profile: { label: 'Organiser profile empty', severity: 'medium' },
  missing_vat: { label: 'VAT not set (paid tickets)', severity: 'medium' },
  missing_event_type: { label: 'Event type not set', severity: 'low' },
  missing_meeting_type: { label: 'Format not set', severity: 'low' },
  stale_past_date: { label: 'Event date is in the past', severity: 'medium' },
};

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };
const PAGE_SIZE = 1000;
const IN_CHUNK_SIZE = 80;

function issuePayload(code) {
  const def = ISSUE_DEFS[code] || { label: code, severity: 'low' };
  return { code, label: def.label, severity: def.severity };
}

function normalizeMeetingType(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const formats = ['In person', 'Online', 'Hybrid'];
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
        .select('*')
        .eq('status', 'published')
        .order('title', { ascending: true })
        .range(from, to)
    );
  } catch (tableErr) {
    const viewRes = await sb.from('published_events').select('*').order('title', { ascending: true });
    if (!viewRes.error) return viewRes.data || [];

    const tableMsg = String(tableErr?.message || tableErr || '');
    const viewMsg = String(viewRes.error?.message || viewRes.error || '');
    if (!isMissingPublishedEventsView(tableErr) && !isMissingPublishedEventsView(viewRes.error)) {
      throw new Error(tableMsg || viewMsg || 'Could not load published events');
    }

    return fetchAllRows(sb, (from, to) =>
      sb
        .from('events')
        .select('*')
        .eq('approval_status', 'Approved')
        .eq('status', 'published')
        .order('title', { ascending: true })
        .range(from, to)
    );
  }
}

async function fetchRowsByIds(sb, table, idColumn, ids, select) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return [];

  const all = [];
  for (let i = 0; i < unique.length; i += IN_CHUNK_SIZE) {
    const chunk = unique.slice(i, i + IN_CHUNK_SIZE);
    const res = await sb.from(table).select(select).in(idColumn, chunk);
    if (res.error) throw new Error(res.error.message);
    all.push(...(res.data || []));
  }
  return all;
}

async function fetchAllOrganisers(sb) {
  return fetchAllRows(sb, (from, to) =>
    sb
      .from('organisers')
      .select('id, name, listing_status, slug')
      .order('name', { ascending: true })
      .range(from, to)
  );
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
  const eventIds = events.map((e) => e.id);
  const orgIds = [...new Set(events.map((e) => e.organiser_id).filter(Boolean))];

  const [organisers, tickets, allOrganisers] = await Promise.all([
    fetchRowsByIds(
      sb,
      'organisers',
      'id',
      orgIds,
      'id, name, photo_url, description, listing_status, slug, website'
    ),
    fetchRowsByIds(sb, 'tickets', 'event_id', eventIds, 'event_id, price'),
    fetchAllOrganisers(sb),
  ]);

  const orgById = new Map(organisers.map((o) => [o.id, o]));
  const tixByEvent = new Map();
  tickets.forEach((t) => {
    if (!tixByEvent.has(t.event_id)) tixByEvent.set(t.event_id, []);
    tixByEvent.get(t.event_id).push(t);
  });

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

    const eventTix = tixByEvent.get(row.id) || [];
    const hasPaid = eventTix.some((t) => ticketPrice(t) > 0);
    if (hasPaid && !row.vat_treatment) codes.push('missing_vat');

    if (!String(row.event_type || '').trim()) codes.push('missing_event_type');
    if (!String(row.meeting_type || '').trim()) codes.push('missing_meeting_type');

    if (!codes.length) continue;

    codes.forEach((code) => {
      issuesByCode[code] = (issuesByCode[code] || 0) + 1;
    });

    const org = row.organiser_id ? orgById.get(row.organiser_id) : null;
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
      issues: codes.map(issuePayload),
    });
  }

  return {
    configured: true,
    count: flagged.length,
    totalPublished: events.length,
    events: flagged,
    issuesByCode,
    organisers: allOrganisers.map((o) => ({
      id: o.id,
      name: String(o.name || '').trim(),
      listingStatus: o.listing_status || '',
      slug: publicOrganiserSlug(o) || '',
    })),
  };
}

module.exports = { scanEventHealth, ISSUE_DEFS, issuePayload, SEVERITY_ORDER };
