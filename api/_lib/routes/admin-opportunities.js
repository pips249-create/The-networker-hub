const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { normalizeType } = require('../supabase-opportunities');

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

function mapOpportunityRow(row) {
  return {
    id: row.id,
    title: String(row.title || '').trim(),
    description: String(row.description || '').trim(),
    host: String(row.host || '').trim(),
    type: row.type || '',
    category: row.category || '',
    status: row.status || 'draft',
    approval_status: row.approval_status || 'Pending Review',
    featured: Boolean(row.featured),
    owner_email: String(row.owner_email || '').toLowerCase(),
    organiser_id: row.organiser_id || '',
    image_url: row.image_url || '',
    logo_url: row.logo_url || '',
    package_tier: row.package_tier || '',
    created_at: row.created_at || '',
    updated_at: row.updated_at || '',
    published_at: row.published_at || '',
  };
}

async function listOpportunitiesForAdmin(query) {
  const sb = getSupabaseAdmin();
  const status = String(query.status || '').trim();
  const approvalStatus = String(query.approval_status || '').trim();
  const type = String(query.type || '').trim();
  const search = String(query.q || '').trim();
  const sort = String(query.sort || 'recent').trim().toLowerCase();
  const featuredOnly = query.featured === '1' || query.featured === 'true';
  const noImage = query.no_image === '1' || query.no_image === 'true';
  const offset = Math.max(parseInt(String(query.offset || ''), 10) || 0, 0);
  const limit = Math.min(Math.max(parseInt(String(query.limit || ''), 10) || 40, 1), 100);

  let dbQuery = sb.from('business_opportunities').select('*', { count: 'exact' });

  if (sort === 'title') {
    dbQuery = dbQuery.order('title', { ascending: true });
  } else if (sort === 'host') {
    dbQuery = dbQuery.order('host', { ascending: true });
  } else if (sort === 'published') {
    dbQuery = dbQuery.order('published_at', { ascending: false, nullsFirst: false });
  } else {
    dbQuery = dbQuery.order('updated_at', { ascending: false });
  }

  if (status) dbQuery = dbQuery.eq('status', status);
  if (approvalStatus) dbQuery = dbQuery.eq('approval_status', approvalStatus);
  if (type) dbQuery = dbQuery.eq('type', normalizeType(type));
  if (featuredOnly) dbQuery = dbQuery.eq('featured', true);
  if (noImage) dbQuery = dbQuery.or('image_url.is.null,image_url.eq.');

  if (search) {
    const term = `%${search}%`;
    dbQuery = dbQuery.or(`title.ilike.${term},host.ilike.${term},owner_email.ilike.${term}`);
  }

  dbQuery = dbQuery.range(offset, offset + limit - 1);

  const res = await dbQuery;
  if (res.error) throw new Error(res.error.message);

  const rows = res.data || [];
  const total = res.count != null ? res.count : rows.length;

  const pendingCountRes = await sb
    .from('business_opportunities')
    .select('id', { count: 'exact', head: true })
    .eq('approval_status', 'Pending Review');
  if (pendingCountRes.error) throw new Error(pendingCountRes.error.message);

  return {
    opportunities: rows.map(mapOpportunityRow),
    count: rows.length,
    total,
    offset,
    limit,
    hasMore: offset + rows.length < total,
    pending_count: pendingCountRes.count || 0,
  };
}

async function deleteOpportunities(ids) {
  const sb = getSupabaseAdmin();
  const unique = [...new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!unique.length) return { deleted: 0, skipped: [], titles: [] };

  const { data, error } = await sb
    .from('business_opportunities')
    .delete()
    .in('id', unique)
    .select('id, title');
  if (error) throw new Error(error.message);

  const deleted = data || [];
  const deletedIds = new Set(deleted.map((row) => String(row.id)));
  const skipped = unique
    .filter((id) => !deletedIds.has(String(id)))
    .map((id) => ({ id, reason: 'not_found' }));

  return {
    deleted: deleted.length,
    skipped,
    titles: deleted.map((row) => String(row.title || '').trim()).filter(Boolean),
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
      const data = await listOpportunitiesForAdmin(queryFromRequest(req));
      return json(res, 200, { ok: true, ...data });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'list_failed', message: e.message });
    }
  }

  if (req.method === 'PATCH' || req.method === 'POST') {
    const body = parseBody(req);

    if (body.action === 'bulk_delete') {
      const ids = [
        ...new Set(
          (Array.isArray(body.ids) ? body.ids : [])
            .map((rowId) => String(rowId || '').trim())
            .filter(Boolean)
        ),
      ];
      if (!ids.length) return json(res, 400, { error: 'missing_ids' });
      try {
        const result = await deleteOpportunities(ids);
        return json(res, 200, { ok: true, ...result });
      } catch (e) {
        return json(res, 500, { ok: false, error: 'bulk_delete_failed', message: e.message });
      }
    }

    const id = String(body.id || '').trim();
    if (!id) return json(res, 400, { error: 'missing_id' });

    if (body.action === 'approve') {
      try {
        const sb = getSupabaseAdmin();
        const patch = {
          approval_status: 'Approved',
          updated_at: new Date().toISOString(),
        };
        const { data: current } = await sb
          .from('business_opportunities')
          .select('status, published_at')
          .eq('id', id)
          .maybeSingle();
        if (current && current.status === 'published' && !current.published_at) {
          patch.published_at = new Date().toISOString();
        }
        const { data, error } = await sb
          .from('business_opportunities')
          .update(patch)
          .eq('id', id)
          .select('*')
          .single();
        if (error) throw new Error(error.message);
        return json(res, 200, { ok: true, opportunity: mapOpportunityRow(data) });
      } catch (e) {
        return json(res, 500, { ok: false, error: 'approve_failed', message: e.message });
      }
    }

    if (body.action === 'reject') {
      try {
        const sb = getSupabaseAdmin();
        const { data, error } = await sb
          .from('business_opportunities')
          .update({
            approval_status: 'Rejected',
            status: 'unpublished',
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select('*')
          .single();
        if (error) throw new Error(error.message);
        return json(res, 200, { ok: true, opportunity: mapOpportunityRow(data) });
      } catch (e) {
        return json(res, 500, { ok: false, error: 'reject_failed', message: e.message });
      }
    }

    if (body.action === 'delete') {
      try {
        const result = await deleteOpportunities([id]);
        if (!result.deleted) {
          return json(res, 404, { ok: false, error: 'not_found' });
        }
        return json(res, 200, { ok: true, ...result });
      } catch (e) {
        return json(res, 500, { ok: false, error: 'delete_failed', message: e.message });
      }
    }

    const patch = {};
    if (Object.prototype.hasOwnProperty.call(body, 'title')) {
      patch.title = String(body.title || '').trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'description')) {
      patch.description = String(body.description || '').trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'host')) {
      patch.host = String(body.host || '').trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'type')) {
      patch.type = normalizeType(body.type);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'image_url')) {
      patch.image_url = String(body.image_url || '').trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      const status = String(body.status || '').trim();
      if (status && !['draft', 'published', 'unpublished', 'archived'].includes(status)) {
        return json(res, 400, { error: 'invalid_status' });
      }
      patch.status = status || null;
      if (status === 'published') {
        patch.approval_status = 'Approved';
        patch.published_at = new Date().toISOString();
      } else if (status === 'draft') {
        patch.approval_status = 'Pending Review';
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, 'approval_status')) {
      const approval = String(body.approval_status || '').trim();
      if (approval && !['Pending Review', 'Approved', 'Rejected'].includes(approval)) {
        return json(res, 400, { error: 'invalid_approval_status' });
      }
      patch.approval_status = approval || null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'featured')) {
      patch.featured = Boolean(body.featured);
    }

    if (!Object.keys(patch).length) {
      return json(res, 400, { error: 'no_fields' });
    }

    patch.updated_at = new Date().toISOString();

    try {
      const sb = getSupabaseAdmin();
      const { data, error } = await sb
        .from('business_opportunities')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return json(res, 200, { ok: true, opportunity: mapOpportunityRow(data) });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'update_failed', message: e.message });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
