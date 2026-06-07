const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { publicOrganiserSlug } = require('../organiser-slug');

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body || {};
}

async function fetchAllOrganisers(sb) {
  const pageSize = 1000;
  let from = 0;
  const all = [];

  while (true) {
    const res = await sb
      .from('organisers')
      .select('id, name, description, photo_url, website, listing_status, slug, created_at')
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

async function eventCountsByOrganiser(sb) {
  const counts = {};
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const res = await sb
      .from('events')
      .select('organiser_id')
      .not('organiser_id', 'is', null)
      .range(from, from + pageSize - 1);
    if (res.error) throw new Error(res.error.message);
    const batch = res.data || [];
    batch.forEach((row) => {
      counts[row.organiser_id] = (counts[row.organiser_id] || 0) + 1;
    });
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return counts;
}

function mapOrganiserRow(row, eventCount) {
  const description = String(row.description || '').trim();
  const photoUrl = String(row.photo_url || '').trim();
  const website = String(row.website || '').trim();
  const missing = [];
  if (!description) missing.push('description');
  if (!photoUrl) missing.push('logo');
  if (!website) missing.push('website');

  return {
    id: row.id,
    name: String(row.name || '').trim(),
    description,
    photo_url: photoUrl,
    website,
    listing_status: row.listing_status || '',
    slug: publicOrganiserSlug(row) || '',
    event_count: eventCount || 0,
    missing,
  };
}

async function listOrganisersForAdmin() {
  const sb = getSupabaseAdmin();
  const [rows, counts] = await Promise.all([fetchAllOrganisers(sb), eventCountsByOrganiser(sb)]);
  return rows.map((row) => mapOrganiserRow(row, counts[row.id] || 0));
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  if (req.method === 'GET') {
    try {
      const organisers = await listOrganisersForAdmin();
      const incomplete = organisers.filter((o) => o.missing.length).length;
      return json(res, 200, { ok: true, organisers, count: organisers.length, incomplete });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'list_failed', message: e.message });
    }
  }

  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  const body = parseBody(req);
  const id = String(body.id || '').trim();
  if (!id) return json(res, 400, { error: 'missing_id' });

  const patch = {};
  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    patch.name = String(body.name || '').trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    patch.description = String(body.description || '').trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'photo_url')) {
    const url = String(body.photo_url || '').trim();
    patch.photo_url = url || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'website')) {
    const site = String(body.website || '').trim();
    patch.website = site || null;
  }

  if (!Object.keys(patch).length) {
    return json(res, 400, { error: 'no_fields' });
  }

  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from('organisers').update(patch).eq('id', id).select('*').single();
    if (error) throw new Error(error.message);
    return json(res, 200, { ok: true, organiser: mapOrganiserRow(data, undefined) });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'update_failed', message: e.message });
  }
};
