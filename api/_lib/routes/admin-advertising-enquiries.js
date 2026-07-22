/**
 * Admin — advertising page enquiries from /advertising.
 */
const { requireAdmin, json, setCors, sessionFromRequest } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');

function mapRow(row) {
  return {
    id: row.id,
    companyName: row.company_name,
    contactName: row.contact_name,
    email: row.email,
    section: row.section,
    packageName: row.package_name,
    budget: row.budget || null,
    message: row.message || null,
    source: row.source || 'advertising_page',
    createdAt: row.created_at,
  };
}

async function listAdvertisingEnquiries(limit) {
  const sb = getSupabaseAdmin();
  const max = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const res = await sb
    .from('advertising_enquiries')
    .select(
      'id, company_name, contact_name, email, section, package_name, budget, message, source, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(max);

  if (res.error) {
    if (/advertising_enquiries/i.test(res.error.message || '')) {
      const err = new Error('enquiries_table_missing');
      err.code = 'enquiries_table_missing';
      throw err;
    }
    throw new Error(res.error.message);
  }

  const enquiries = (res.data || []).map(mapRow);
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const recentCount = enquiries.filter(function (row) {
    return row.createdAt && new Date(row.createdAt) >= since;
  }).length;

  return {
    ok: true,
    configured: true,
    total: enquiries.length,
    recentCount,
    enquiries,
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

  if (req.method !== 'GET') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  try {
    const limit = req.query && req.query.limit;
    const overview = await listAdvertisingEnquiries(limit);
    return json(res, 200, overview);
  } catch (e) {
    if (e.code === 'enquiries_table_missing') {
      return json(res, 503, {
        ok: false,
        error: 'enquiries_table_missing',
        message: 'Run migration 192_advertising_enquiries.sql in Supabase.',
      });
    }
    return json(res, 500, { ok: false, error: 'enquiries_load_failed', message: e.message });
  }
};
