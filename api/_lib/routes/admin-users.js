const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getAdminUsers } = require('../admin-supabase-data');
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
      const report = await getAdminUsers();
      return json(res, 200, { ok: true, ...report });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'users_failed', message: e.message });
    }
  }

  if (req.method === 'PATCH') {
    if (!isSupabaseConfigured()) {
      return json(res, 503, { ok: false, error: 'supabase_not_configured' });
    }

    const body = parseBody(req);
    const organiserId = String(body.organiserId || body.organiser_id || '').trim();
    const userId = String(body.userId || body.user_id || body.id || '').trim();

    if (!Object.prototype.hasOwnProperty.call(body, 'featured')) {
      return json(res, 400, { error: 'no_fields' });
    }

    try {
      const sb = getSupabaseAdmin();
      let targetOrganiserId = organiserId;

      if (!targetOrganiserId && userId) {
        const lookup = await sb
          .from('organisers')
          .select('id')
          .eq('supabase_user_id', userId)
          .maybeSingle();
        if (lookup.error) throw new Error(lookup.error.message);
        targetOrganiserId = lookup.data?.id || '';
      }

      if (!targetOrganiserId) {
        return json(res, 400, { error: 'no_organiser_profile', message: 'This user has no organiser profile to feature.' });
      }

      const { data, error } = await sb
        .from('organisers')
        .update({ featured: Boolean(body.featured) })
        .eq('id', targetOrganiserId)
        .select('id, name, featured')
        .single();
      if (error) throw new Error(error.message);

      return json(res, 200, { ok: true, organiser: data });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'update_failed', message: e.message });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
