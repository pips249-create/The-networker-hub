const { sessionFromRequest, requireAdmin, json, setCors } = require('../_lib/auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../_lib/supabase');

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

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  if (req.method === 'PATCH') {
    const body = parseBody(req);
    const id = String(body.id || '').trim();
    if (!id) return json(res, 400, { error: 'missing_id' });

    const patch = {};
    if (Object.prototype.hasOwnProperty.call(body, 'starts_at')) {
      const raw = body.starts_at;
      patch.starts_at = raw ? new Date(raw).toISOString() : null;
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
      return json(res, 200, { ok: true, event: data });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'update_failed', message: e.message });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
