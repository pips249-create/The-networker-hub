const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { createEvent } = require('../supabase-organiser-events');
const { publicEventSlug } = require('../event-slug');
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

async function fetchOrganiserOptions(sb) {
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

  return all.map((o) => ({
    id: o.id,
    name: String(o.name || '').trim(),
    listing_status: o.listing_status || '',
    slug: publicOrganiserSlug(o) || '',
  }));
}

function mapEventRow(row, orgById) {
  const org = row.organiser_id ? orgById.get(row.organiser_id) : null;
  return {
    id: row.id,
    title: String(row.title || '').trim(),
    description: String(row.description || '').trim(),
    photo_url: String(row.photo_url || '').trim(),
    organiser_id: row.organiser_id || '',
    organiser_name: org ? String(org.name || '').trim() : '',
    organiser_slug: org ? publicOrganiserSlug(org) || '' : '',
    starts_at: row.starts_at || '',
    ends_at: row.ends_at || '',
    event_type: row.event_type || '',
    meeting_type: row.meeting_type || '',
    status: row.status || '',
    approval_status: row.approval_status || '',
    vat_treatment: row.vat_treatment || '',
    slug: publicEventSlug({ slug: row.slug, title: row.title }),
    city: row.city || '',
  };
}

async function listEventsForAdmin(query) {
  const sb = getSupabaseAdmin();
  const organiserId = String(query.organiser_id || '').trim();
  const unlinked = query.unlinked === '1' || query.unlinked === 'true';
  const search = String(query.q || '').trim().toLowerCase();

  let dbQuery = sb
    .from('events')
    .select(
      'id, title, description, photo_url, organiser_id, starts_at, ends_at, event_type, meeting_type, status, approval_status, vat_treatment, slug, city, created_at'
    )
    .order('title', { ascending: true })
    .limit(500);

  if (unlinked) {
    dbQuery = dbQuery.is('organiser_id', null);
  } else if (organiserId) {
    dbQuery = dbQuery.eq('organiser_id', organiserId);
  }

  const [eventsRes, organisers] = await Promise.all([dbQuery, fetchOrganiserOptions(sb)]);
  if (eventsRes.error) throw new Error(eventsRes.error.message);

  const orgById = new Map(
    organisers.map((o) => [o.id, { id: o.id, name: o.name, slug: o.slug, listing_status: o.listing_status }])
  );

  let events = (eventsRes.data || []).map((row) => mapEventRow(row, orgById));
  if (search) {
    events = events.filter(function (ev) {
      return (
        ev.title.toLowerCase().includes(search) ||
        ev.organiser_name.toLowerCase().includes(search) ||
        ev.city.toLowerCase().includes(search)
      );
    });
  }

  const unlinkedCountRes = await sb
    .from('events')
    .select('id', { count: 'exact', head: true })
    .is('organiser_id', null);
  if (unlinkedCountRes.error) throw new Error(unlinkedCountRes.error.message);

  return {
    events,
    organisers,
    count: events.length,
    unlinked_count: unlinkedCountRes.count || 0,
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
      const data = await listEventsForAdmin(req.query || {});
      return json(res, 200, { ok: true, ...data });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'list_failed', message: e.message });
    }
  }

  if (req.method === 'PATCH' || req.method === 'POST') {
    const body = parseBody(req);

    if (body.action === 'create') {
      const title = String(body.title || '').trim();
      const organiserId = String(body.organiser_id || '').trim();
      if (!title) return json(res, 400, { error: 'missing_title' });
      if (!organiserId) return json(res, 400, { error: 'missing_organiser_id' });

      try {
        const event = await createEvent({
          title,
          groupId: organiserId,
          type: body.event_type || 'Networking meeting',
          eventFormat: body.meeting_type || 'In person',
          date: body.starts_at || null,
          endDate: body.ends_at || null,
          description: body.description || '',
          photoUrl: body.photo_url || '',
          listingStatus: body.status || 'draft',
        });
        return json(res, 201, { ok: true, event });
      } catch (e) {
        return json(res, 500, { ok: false, error: 'create_failed', message: e.message });
      }
    }

    const id = String(body.id || '').trim();
    if (!id) return json(res, 400, { error: 'missing_id' });

    const patch = {};
    if (Object.prototype.hasOwnProperty.call(body, 'title')) {
      patch.title = String(body.title || '').trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'description')) {
      patch.description = String(body.description || '').trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'photo_url')) {
      patch.photo_url = String(body.photo_url || '').trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'starts_at')) {
      const raw = body.starts_at;
      patch.starts_at = raw ? new Date(raw).toISOString() : null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'ends_at')) {
      const raw = body.ends_at;
      patch.ends_at = raw ? new Date(raw).toISOString() : null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'organiser_id')) {
      patch.organiser_id = body.organiser_id ? String(body.organiser_id).trim() : null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'event_type')) {
      patch.event_type = String(body.event_type || '').trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'meeting_type')) {
      patch.meeting_type = String(body.meeting_type || '').trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      const status = String(body.status || '').trim();
      if (status && !['draft', 'published', 'unpublished', 'archived', 'cancelled'].includes(status)) {
        return json(res, 400, { error: 'invalid_status' });
      }
      patch.status = status || null;
      if (status === 'published') patch.approval_status = 'Approved';
      else if (status === 'draft') patch.approval_status = 'Pending Review';
    }
    if (Object.prototype.hasOwnProperty.call(body, 'vat_treatment')) {
      const vat = String(body.vat_treatment || '').trim();
      if (vat && !['included', 'added'].includes(vat)) {
        return json(res, 400, { error: 'invalid_vat_treatment' });
      }
      patch.vat_treatment = vat || null;
    }

    if (!Object.keys(patch).length) {
      return json(res, 400, { error: 'no_fields' });
    }

    try {
      const sb = getSupabaseAdmin();
      const { data, error } = await sb.from('events').update(patch).eq('id', id).select('*').single();
      if (error) throw new Error(error.message);
      const organisers = await fetchOrganiserOptions(sb);
      const orgById = new Map(organisers.map((o) => [o.id, o]));
      return json(res, 200, { ok: true, event: mapEventRow(data, orgById) });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'update_failed', message: e.message });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
