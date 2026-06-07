/**
 * Scan published events for missing data that breaks public listings.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { publicEventSlug } = require('./event-slug');
const { publicOrganiserSlug } = require('./organiser-slug');

const ISSUE_DEFS = {
  missing_date: { label: 'Missing event date', severity: 'high' },
  missing_organiser: { label: 'No organiser linked', severity: 'high' },
  missing_organiser_logo: { label: 'Organiser has no logo', severity: 'medium' },
  missing_organiser_profile: { label: 'Organiser profile empty', severity: 'medium' },
  missing_vat: { label: 'VAT not set (paid tickets)', severity: 'medium' },
  missing_event_type: { label: 'Event type not set', severity: 'low' },
  missing_meeting_type: { label: 'Format not set', severity: 'low' },
};

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

function issuePayload(code) {
  const def = ISSUE_DEFS[code] || { label: code, severity: 'low' };
  return { code, label: def.label, severity: def.severity };
}

async function fetchPublishedRows(sb) {
  const viewRes = await sb.from('published_events').select('*').order('title', { ascending: true });
  if (!viewRes.error) return viewRes.data || [];

  const tableRes = await sb
    .from('events')
    .select('*')
    .eq('approval_status', 'Approved')
    .order('title', { ascending: true });
  if (tableRes.error) throw new Error(tableRes.error.message);
  return tableRes.data || [];
}

async function fetchAllOrganisers(sb) {
  const pageSize = 1000;
  let from = 0;
  const all = [];

  while (true) {
    const res = await sb
      .from('organisers')
      .select('id, name, listing_status, slug')
      .order('name', { ascending: true })
      .range(from, from + pageSize - 1);
    if (res.error) throw new Error(res.error.message);
    const batch = res.data || [];
    all.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

async function scanEventHealth() {
  if (!isSupabaseConfigured()) {
    return { configured: false, count: 0, events: [], organisers: [], issuesByCode: {} };
  }

  const sb = getSupabaseAdmin();
  const events = await fetchPublishedRows(sb);
  const eventIds = events.map((e) => e.id);
  const orgIds = [...new Set(events.map((e) => e.organiser_id).filter(Boolean))];

  let organisers = [];
  let tickets = [];

  if (orgIds.length) {
    const orgRes = await sb
      .from('organisers')
      .select('id, name, photo_url, description, listing_status, slug')
      .in('id', orgIds);
    if (orgRes.error) throw new Error(orgRes.error.message);
    organisers = orgRes.data || [];
  }

  if (eventIds.length) {
    const tixRes = await sb.from('tickets').select('event_id, price').in('event_id', eventIds);
    if (tixRes.error) throw new Error(tixRes.error.message);
    tickets = tixRes.data || [];
  }

  const allOrganisers = await fetchAllOrganisers(sb);

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

    if (!row.starts_at) codes.push('missing_date');
    if (!row.organiser_id) {
      codes.push('missing_organiser');
    } else {
      const org = orgById.get(row.organiser_id);
      if (org && !String(org.photo_url || '').trim()) codes.push('missing_organiser_logo');
      if (org && !String(org.description || '').trim()) codes.push('missing_organiser_profile');
    }

    const eventTix = tixByEvent.get(row.id) || [];
    const hasPaid = eventTix.some((t) => Number(t.price) > 0);
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
      organiser_photo_url: org ? String(org.photo_url || '').trim() : '',
      organiser_description: org ? String(org.description || '').trim() : '',
      starts_at: row.starts_at || '',
      event_type: row.event_type || '',
      meeting_type: row.meeting_type || '',
      vat_treatment: row.vat_treatment || '',
      issues: codes.map(issuePayload),
    });
  }

  return {
    configured: true,
    count: flagged.length,
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
