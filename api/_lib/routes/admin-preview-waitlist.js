/**
 * Admin — preview / peek launch waitlist (preview_waitlist).
 */
const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');

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

function clampLimit(raw) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 200;
  return Math.min(500, Math.floor(n));
}

async function loadPreviewWaitlistRows(sb, limit) {
  const res = await sb
    .from('preview_waitlist')
    .select('id, email, source, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (res.error) {
    if (/preview_waitlist/i.test(res.error.message || '')) {
      const err = new Error('waitlist_table_missing');
      err.code = 'waitlist_table_missing';
      throw err;
    }
    throw new Error(res.error.message);
  }
  return res.data || [];
}

function summariseBySource(rows) {
  const counts = new Map();
  (rows || []).forEach((row) => {
    const source = String(row.source || 'unknown').trim() || 'unknown';
    counts.set(source, (counts.get(source) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
}

function daysAgoIso(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function getPreviewWaitlistOverview(limit) {
  const sb = getSupabaseAdmin();
  const rows = await loadPreviewWaitlistRows(sb, limit);
  const bySource = summariseBySource(rows);
  const weekCutoff = daysAgoIso(7);
  const monthCutoff = daysAgoIso(30);
  let last7Days = 0;
  let last30Days = 0;
  rows.forEach((row) => {
    const created = String(row.created_at || '');
    if (created >= weekCutoff) last7Days += 1;
    if (created >= monthCutoff) last30Days += 1;
  });

  return {
    ok: true,
    configured: true,
    totals: {
      total: rows.length,
      last7Days,
      last30Days,
      sources: bySource.length,
    },
    bySource,
    entries: rows.map((row) => ({
      id: row.id,
      email: row.email,
      source: row.source || 'unknown',
      createdAt: row.created_at,
    })),
  };
}

async function removePreviewWaitlistEntry(id) {
  const entryId = String(id || '').trim();
  if (!entryId) {
    const err = new Error('missing_id');
    err.status = 400;
    throw err;
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('preview_waitlist')
    .delete()
    .eq('id', entryId)
    .select('id, email, source')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }
  return data;
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
      const limit = clampLimit(req.query && req.query.limit);
      const overview = await getPreviewWaitlistOverview(limit);
      return json(res, 200, overview);
    } catch (e) {
      if (e.code === 'waitlist_table_missing') {
        return json(res, 503, {
          ok: false,
          error: 'waitlist_table_missing',
          message: 'Run migration 109_preview_waitlist.sql in Supabase.',
        });
      }
      return json(res, 500, { ok: false, error: 'waitlist_load_failed', message: e.message });
    }
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    const action = String(body.action || '').trim().toLowerCase();
    if (action !== 'remove') {
      return json(res, 400, { ok: false, error: 'invalid_action' });
    }
    try {
      const removed = await removePreviewWaitlistEntry(body.id);
      return json(res, 200, { ok: true, removed });
    } catch (e) {
      const status = e.status || 500;
      return json(res, status, { ok: false, error: e.message || 'remove_failed' });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
