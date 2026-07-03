const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { searchAdminBookings } = require('../admin-bookings-data');

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

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (req.method !== 'GET') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  const query = queryFromRequest(req);
  const q = String(query.q || '').trim();
  if (!q) {
    return json(res, 200, {
      ok: true,
      bookings: [],
      message: 'Enter an email, booking reference (HUB-…), registration ID, or event title.',
    });
  }

  try {
    const sb = getSupabaseAdmin();
    const result = await searchAdminBookings(sb, query);
    return json(res, 200, { ok: true, ...result, updatedAt: new Date().toISOString() });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'bookings_search_failed', message: e.message });
  }
};
