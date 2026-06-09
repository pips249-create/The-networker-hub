const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getAdminModeration } = require('../admin-supabase-data');
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

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (req.method === 'GET') {
    try {
      const report = await getAdminModeration();
      return json(res, 200, { ok: true, ...report });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'moderation_failed', message: e.message });
    }
  }

  if (req.method === 'PATCH' || req.method === 'POST') {
    if (!isSupabaseConfigured()) {
      return json(res, 503, { ok: false, error: 'supabase_not_configured' });
    }

    const body = parseBody(req);
    const action = String(body.action || '').trim();
    const id = String(body.id || '').trim();
    if (!action || !id) {
      return json(res, 400, { error: 'missing_action_or_id' });
    }

    const sb = getSupabaseAdmin();

    try {
      if (action === 'dismiss_report') {
        const { data, error } = await sb
          .from('listing_reports')
          .update({ status: 'dismissed' })
          .eq('id', id)
          .select('id, status')
          .single();
        if (error) throw new Error(error.message);
        return json(res, 200, { ok: true, report: data });
      }

      if (action === 'dismiss_review_report') {
        const { data, error } = await sb
          .from('review_reports')
          .update({ status: 'dismissed' })
          .eq('id', id)
          .select('id, status')
          .single();
        if (error) throw new Error(error.message);
        return json(res, 200, { ok: true, report: data });
      }

      if (action === 'delete_review') {
        const { error } = await sb.from('reviews').delete().eq('id', id);
        if (error) throw new Error(error.message);
        return json(res, 200, { ok: true, deleted: id });
      }

      if (action === 'reject_event') {
        const { data, error } = await sb
          .from('events')
          .update({ approval_status: 'Rejected', status: 'draft' })
          .eq('id', id)
          .select('id, title, approval_status, status')
          .single();
        if (error) throw new Error(error.message);
        return json(res, 200, { ok: true, event: data });
      }

      return json(res, 400, { error: 'unknown_action' });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'action_failed', message: e.message });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
