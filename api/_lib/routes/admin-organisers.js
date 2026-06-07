const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { resolveImageUrl } = require('../supabase-storage');
const { publicOrganiserSlug } = require('../organiser-slug');

const INCOMPLETE_FILTER =
  'description.is.null,description.eq.,photo_url.is.null,photo_url.eq.,website.is.null,website.eq.';

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

function parseListQuery(query) {
  const offset = Math.max(parseInt(String(query?.offset || ''), 10) || 0, 0);
  const limit = Math.min(Math.max(parseInt(String(query?.limit || ''), 10) || 30, 1), 100);
  const q = String(query?.q || '').trim();
  const incomplete = query?.incomplete === '1' || query?.incomplete === 'true';
  return { offset, limit, q, incomplete };
}

async function eventCountsForOrganisers(sb, organiserIds) {
  const counts = {};
  const ids = [...new Set((organiserIds || []).filter(Boolean))];
  if (!ids.length) return counts;

  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const res = await sb.from('events').select('organiser_id').in('organiser_id', chunk);
    if (res.error) throw new Error(res.error.message);
    (res.data || []).forEach((row) => {
      counts[row.organiser_id] = (counts[row.organiser_id] || 0) + 1;
    });
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

async function resolveOrganiserPhotoUrl(body, folder) {
  let photo_url;
  if (Object.prototype.hasOwnProperty.call(body, 'photo_url')) {
    photo_url = String(body.photo_url || '').trim() || null;
  }
  if (body.logoBase64) {
    const uploaded = await resolveImageUrl({
      folder,
      logoUrl: body.photo_url || body.logoUrl,
      logoBase64: body.logoBase64,
      logoMime: body.logoMime,
      logoFilename: body.logoFilename,
    });
    if (uploaded) photo_url = uploaded;
  }
  return photo_url;
}

function buildOrganiserPatch(body, photo_url) {
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    patch.name = String(body.name || '').trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    patch.description = String(body.description || '').trim() || null;
  }
  if (photo_url !== undefined) patch.photo_url = photo_url;
  if (Object.prototype.hasOwnProperty.call(body, 'website')) {
    patch.website = String(body.website || '').trim() || null;
  }
  return patch;
}

async function listOrganisersForAdmin(query) {
  const sb = getSupabaseAdmin();
  const { offset, limit, q, incomplete } = parseListQuery(query);

  let dbQuery = sb
    .from('organisers')
    .select('id, name, description, photo_url, website, listing_status, slug, created_at', {
      count: 'exact',
    })
    .order('name', { ascending: true });

  if (q) dbQuery = dbQuery.ilike('name', `%${q}%`);
  if (incomplete) dbQuery = dbQuery.or(INCOMPLETE_FILTER);

  const res = await dbQuery.range(offset, offset + limit - 1);
  if (res.error) throw new Error(res.error.message);

  const rows = res.data || [];
  const counts = await eventCountsForOrganisers(
    sb,
    rows.map((r) => r.id)
  );
  const total = res.count != null ? res.count : rows.length;

  const incompleteRes = await sb
    .from('organisers')
    .select('id', { count: 'exact', head: true })
    .or(INCOMPLETE_FILTER);
  if (incompleteRes.error) throw new Error(incompleteRes.error.message);

  return {
    organisers: rows.map((row) => mapOrganiserRow(row, counts[row.id] || 0)),
    count: rows.length,
    total,
    offset,
    limit,
    hasMore: offset + rows.length < total,
    incomplete: incompleteRes.count || 0,
  };
}

async function bulkUpdateOrganisers(body) {
  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.map((id) => String(id || '').trim()).filter(Boolean))]
    : [];
  if (!ids.length) {
    const err = new Error('missing_ids');
    err.status = 400;
    throw err;
  }

  const photo_url = await resolveOrganiserPhotoUrl(body, 'organisers/bulk');
  const patch = buildOrganiserPatch(body, photo_url);
  if (!Object.keys(patch).length) {
    const err = new Error('no_fields');
    err.status = 400;
    throw err;
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('organisers').update(patch).in('id', ids).select('*');
  if (error) throw new Error(error.message);

  return {
    updated: (data || []).length,
    organisers: (data || []).map((row) => mapOrganiserRow(row, undefined)),
  };
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
      const data = await listOrganisersForAdmin(req.query || {});
      return json(res, 200, { ok: true, ...data });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'list_failed', message: e.message });
    }
  }

  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  const body = parseBody(req);

  if (body.action === 'bulk_update') {
    try {
      const result = await bulkUpdateOrganisers(body);
      return json(res, 200, { ok: true, ...result });
    } catch (e) {
      const status = e.status || 500;
      return json(res, status, { ok: false, error: e.message || 'bulk_update_failed', message: e.message });
    }
  }

  const id = String(body.id || '').trim();
  if (!id) return json(res, 400, { error: 'missing_id' });

  try {
    const photo_url = await resolveOrganiserPhotoUrl(body, `organisers/${id}`);
    const patch = buildOrganiserPatch(body, photo_url);
    if (!Object.keys(patch).length) {
      return json(res, 400, { error: 'no_fields' });
    }

    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from('organisers').update(patch).eq('id', id).select('*').single();
    if (error) throw new Error(error.message);
    return json(res, 200, { ok: true, organiser: mapOrganiserRow(data, undefined) });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'update_failed', message: e.message });
  }
};
