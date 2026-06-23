const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { publicEventSlug } = require('../event-slug');
const { publicOrganiserSlug } = require('../organiser-slug');
const { normalizeEventType } = require('../event-types');
const { eventImageUrl, eventImageDbValue } = require('../event-image');

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

function queryFromRequest(req) {
  const q = { ...(req.query || {}) };
  if (req.url) {
    try {
      const url = new URL(req.url, 'https://internal.local');
      url.searchParams.forEach((value, key) => {
        if (q[key] == null || q[key] === '') q[key] = value;
      });
    } catch {
      /* ignore */
    }
  }
  return q;
}

function mapOrganiserOptionRow(o) {
  return {
    id: o.id,
    name: String(o.name || '').trim(),
    listing_status: o.listing_status || '',
    slug: publicOrganiserSlug(o) || '',
  };
}

async function fetchOrganisersByIds(sb, organiserIds) {
  const ids = [...new Set((organiserIds || []).filter(Boolean))];
  if (!ids.length) return [];

  const all = [];
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const res = await sb.from('organisers').select('id, name, listing_status, slug').in('id', chunk);
    if (res.error) throw new Error(res.error.message);
    all.push(...(res.data || []));
  }

  return all.map(mapOrganiserOptionRow);
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

  return all.map(mapOrganiserOptionRow);
}

function mapEventRow(row, orgById) {
  const org = row.organiser_id ? orgById.get(row.organiser_id) : null;
  return {
    id: row.id,
    title: String(row.title || '').trim(),
    description: String(row.description || '').trim(),
    photo_url: eventImageUrl(row),
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
    featured: Boolean(row.featured),
  };
}

async function listEventsForAdmin(query) {
  const sb = getSupabaseAdmin();
  const organiserId = String(query.organiser_id || '').trim();
  const unlinked = query.unlinked === '1' || query.unlinked === 'true';
  const noDate = query.no_date === '1' || query.no_date === 'true';
  const status = String(query.status || '').trim();
  const approvalStatus = String(query.approval_status || '').trim();
  const search = String(query.q || '').trim();
  const sort = String(query.sort || 'recent').trim().toLowerCase();
  const featuredOnly = query.featured === '1' || query.featured === 'true';
  const offset = Math.max(parseInt(String(query.offset || ''), 10) || 0, 0);
  const limit = Math.min(Math.max(parseInt(String(query.limit || ''), 10) || 40, 1), 100);

  let dbQuery = sb
    .from('events')
    .select(
      'id, title, description, image_url, photo_url, organiser_id, starts_at, ends_at, event_type, meeting_type, status, approval_status, vat_treatment, slug, city, featured, created_at',
      { count: 'exact' }
    );

  if (sort === 'title') {
    dbQuery = dbQuery.order('title', { ascending: true });
  } else if (sort === 'date') {
    dbQuery = dbQuery.order('starts_at', { ascending: false, nullsFirst: false });
  } else {
    dbQuery = dbQuery.order('created_at', { ascending: false });
  }

  if (unlinked) {
    dbQuery = dbQuery.is('organiser_id', null);
  } else if (organiserId) {
    dbQuery = dbQuery.eq('organiser_id', organiserId);
  }

  if (noDate) {
    dbQuery = dbQuery.is('starts_at', null);
  }

  if (status) {
    dbQuery = dbQuery.eq('status', status);
  }

  if (approvalStatus) {
    dbQuery = dbQuery.eq('approval_status', approvalStatus);
  }

  if (featuredOnly) {
    dbQuery = dbQuery.eq('featured', true);
  }

  if (search) {
    const term = `%${search}%`;
    dbQuery = dbQuery.or(`title.ilike.${term},city.ilike.${term}`);
  }

  dbQuery = dbQuery.range(offset, offset + limit - 1);

  const includeOrganisers =
    query.include_organisers === '1' || query.include_organisers === 'true';

  const eventsRes = await dbQuery;
  if (eventsRes.error) throw new Error(eventsRes.error.message);

  const rows = eventsRes.data || [];
  const organisers = includeOrganisers
    ? await fetchOrganiserOptions(sb)
    : await fetchOrganisersByIds(
        sb,
        rows.map((row) => row.organiser_id)
      );

  const orgById = new Map(
    organisers.map((o) => [o.id, { id: o.id, name: o.name, slug: o.slug, listing_status: o.listing_status }])
  );
  const events = rows.map((row) => mapEventRow(row, orgById));
  const total = eventsRes.count != null ? eventsRes.count : rows.length;

  const unlinkedCountRes = await sb
    .from('events')
    .select('id', { count: 'exact', head: true })
    .is('organiser_id', null);
  if (unlinkedCountRes.error) throw new Error(unlinkedCountRes.error.message);

  return {
    events,
    organisers,
    count: events.length,
    total,
    offset,
    limit,
    hasMore: offset + events.length < total,
    unlinked_count: unlinkedCountRes.count || 0,
  };
}

function buildEventPatchFromBody(body) {
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(body, 'title')) {
    patch.title = String(body.title || '').trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    patch.description = String(body.description || '').trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'photo_url')) {
    patch.image_url = eventImageDbValue(body.photo_url);
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
  if (Object.prototype.hasOwnProperty.call(body, 'unlink_organiser') && body.unlink_organiser) {
    patch.organiser_id = null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'event_type')) {
    patch.event_type = normalizeEventType(body.event_type || '');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'meeting_type')) {
    patch.meeting_type = String(body.meeting_type || '').trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    const status = String(body.status || '').trim();
    if (status && !['draft', 'published', 'unpublished', 'archived', 'cancelled'].includes(status)) {
      const err = new Error('invalid_status');
      err.status = 400;
      throw err;
    }
    patch.status = status || null;
    if (status === 'published') {
      patch.approval_status = 'Approved';
      patch.ticket_sales_enabled = true;
    } else if (status === 'draft') patch.approval_status = 'Pending Review';
  }
  if (Object.prototype.hasOwnProperty.call(body, 'approval_status')) {
    const approval = String(body.approval_status || '').trim();
    if (approval && !['Pending Review', 'Approved', 'Rejected'].includes(approval)) {
      const err = new Error('invalid_approval_status');
      err.status = 400;
      throw err;
    }
    patch.approval_status = approval || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'featured')) {
    patch.featured = Boolean(body.featured);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'vat_treatment')) {
    const vat = String(body.vat_treatment || '').trim();
    if (vat && !['included', 'added'].includes(vat)) {
      const err = new Error('invalid_vat_treatment');
      err.status = 400;
      throw err;
    }
    patch.vat_treatment = vat || null;
  }
  return patch;
}

async function applyEventPatch(sb, id, patch) {
  const { data: current, error: currentErr } = await sb
    .from('events')
    .select('starts_at, title')
    .eq('id', id)
    .maybeSingle();
  if (currentErr) throw new Error(currentErr.message);
  if (!current) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }

  const effectiveStartsAt =
    Object.prototype.hasOwnProperty.call(patch, 'starts_at') ? patch.starts_at : current.starts_at;

  if (!effectiveStartsAt) {
    if (patch.status === 'published' || patch.approval_status === 'Approved') {
      const err = new Error('missing_date');
      err.message = 'Events must have a date before they can be published or approved.';
      err.status = 400;
      throw err;
    }
    patch.status = 'draft';
    patch.approval_status = 'Pending Review';
    patch.ticket_sales_enabled = false;
  }

  const { data, error } = await sb.from('events').update(patch).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);
  const organisers = await fetchOrganisersByIds(sb, [data.organiser_id]);
  const orgById = new Map(organisers.map((o) => [o.id, o]));
  return mapEventRow(data, orgById);
}

async function adminDeleteEvent(sb, eventId, opts) {
  const force = Boolean(opts && opts.force);
  const { data: row, error } = await sb.from('events').select('*').eq('id', eventId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) {
    return { id: eventId, skipped: true, reason: 'not_found', title: '' };
  }

  const title = String(row.title || '').trim() || 'Untitled';

  if (row.locked && !force) {
    return { id: eventId, skipped: true, reason: 'locked', title };
  }

  const { count, error: regErr } = await sb
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId);
  if (regErr) throw new Error(regErr.message);
  if (count > 0 && !force) {
    return { id: eventId, skipped: true, reason: 'has_registrations', title, registrationCount: count };
  }

  const { error: ticketErr } = await sb.from('tickets').delete().eq('event_id', eventId);
  if (ticketErr) throw new Error(ticketErr.message);

  const { error: delErr } = await sb.from('events').delete().eq('id', eventId);
  if (delErr) throw new Error(delErr.message);

  return { id: eventId, deleted: true, title };
}

async function bulkUpdateEvents(ids, body) {
  const patch = buildEventPatchFromBody(body);
  if (!Object.keys(patch).length) {
    const err = new Error('no_fields');
    err.status = 400;
    throw err;
  }

  const sb = getSupabaseAdmin();
  const updated = [];
  const skipped = [];

  for (const id of ids) {
    try {
      const event = await applyEventPatch(sb, id, { ...patch });
      updated.push(event);
    } catch (e) {
      skipped.push({
        id,
        reason: e.message || String(e),
        code: e.message || 'update_failed',
      });
    }
  }

  return { updated: updated.length, skipped, events: updated };
}

async function bulkDeleteEvents(ids, opts) {
  const sb = getSupabaseAdmin();
  const deleted = [];
  const skipped = [];

  for (const id of ids) {
    try {
      const result = await adminDeleteEvent(sb, id, opts);
      if (result.deleted) deleted.push(result);
      else skipped.push(result);
    } catch (e) {
      skipped.push({ id, skipped: true, reason: e.message || 'delete_failed', title: '' });
    }
  }

  return { deleted: deleted.length, skipped, titles: deleted.map((d) => d.title) };
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
      const data = await listEventsForAdmin(queryFromRequest(req));
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
        const { createEvent } = require('../supabase-organiser-events');
        const event = await createEvent({
          title,
          groupId: organiserId,
          type: normalizeEventType(body.event_type || 'Meeting'),
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

    if (body.action === 'bulk_update') {
      const ids = [
        ...new Set(
          (Array.isArray(body.ids) ? body.ids : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean)
        ),
      ];
      if (!ids.length) return json(res, 400, { error: 'missing_ids' });
      try {
        const result = await bulkUpdateEvents(ids, body);
        return json(res, 200, { ok: true, ...result });
      } catch (e) {
        return json(res, e.status || 500, {
          ok: false,
          error: e.message || 'bulk_update_failed',
          message: e.message,
        });
      }
    }

    if (body.action === 'bulk_delete') {
      const ids = [
        ...new Set(
          (Array.isArray(body.ids) ? body.ids : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean)
        ),
      ];
      if (!ids.length) return json(res, 400, { error: 'missing_ids' });
      try {
        const result = await bulkDeleteEvents(ids, { force: Boolean(body.force) });
        return json(res, 200, { ok: true, ...result });
      } catch (e) {
        return json(res, 500, { ok: false, error: 'bulk_delete_failed', message: e.message });
      }
    }

    const id = String(body.id || '').trim();
    if (!id) return json(res, 400, { error: 'missing_id' });

    let patch;
    try {
      patch = buildEventPatchFromBody(body);
    } catch (e) {
      return json(res, e.status || 400, { error: e.message });
    }

    if (!Object.keys(patch).length) {
      return json(res, 400, { error: 'no_fields' });
    }

    try {
      const sb = getSupabaseAdmin();
      const event = await applyEventPatch(sb, id, patch);
      return json(res, 200, { ok: true, event });
    } catch (e) {
      if (e.message === 'missing_date') {
        return json(res, 400, { error: 'missing_date', message: e.message });
      }
      if (e.message === 'not_found') return json(res, 404, { error: 'not_found' });
      return json(res, 500, { ok: false, error: 'update_failed', message: e.message });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
