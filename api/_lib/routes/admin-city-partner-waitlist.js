/**
 * Admin — City Partner waitlist and slot availability overview.
 */
const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { getCityPartnerAvailability } = require('../networking-city-partners');
const { formatAvailableFromLabel } = require('../city-partner-waitlist');

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

function groupWaitlistRows(rows) {
  const bySlug = new Map();
  (rows || []).forEach((row) => {
    const slug = String(row.city_slug || '').trim().toLowerCase();
    if (!slug) return;
    if (!bySlug.has(slug)) bySlug.set(slug, { pending: [], notified: [] });
    const bucket = row.notified_at ? 'notified' : 'pending';
    bySlug.get(slug)[bucket].push({
      id: row.id,
      email: row.email,
      companyName: row.company_name || '',
      createdAt: row.created_at,
      notifiedAt: row.notified_at,
    });
  });
  return bySlug;
}

async function loadWaitlistRows(sb) {
  const res = await sb
    .from('city_partner_waitlist')
    .select('id, city_slug, email, company_name, notified_at, created_at')
    .order('created_at', { ascending: true });
  if (res.error) {
    if (/city_partner_waitlist/i.test(res.error.message || '')) {
      const err = new Error('waitlist_table_missing');
      err.code = 'waitlist_table_missing';
      throw err;
    }
    throw new Error(res.error.message);
  }
  return res.data || [];
}

async function getAdminCityPartnerWaitlistOverview() {
  const sb = getSupabaseAdmin();
  const availability = await getCityPartnerAvailability(sb);
  const waitlistRows = await loadWaitlistRows(sb);
  const grouped = groupWaitlistRows(waitlistRows);

  const cities = (availability.cities || []).map((city) => {
    const waitlist = grouped.get(city.slug) || { pending: [], notified: [] };
    return {
      slug: city.slug,
      name: city.name,
      slot: city.slot,
      status: city.status,
      live: city.live,
      available: city.available,
      availableFrom: city.availableFrom || null,
      availableFromLabel: city.availableFrom
        ? formatAvailableFromLabel(city.availableFrom)
        : null,
      sponsorEmail: city.sponsorEmail || null,
      waitlistPending: waitlist.pending.length,
      waitlistNotified: waitlist.notified.length,
      waitlist: waitlist.pending,
      recentNotified: waitlist.notified.slice(-5).reverse(),
    };
  });

  const totals = cities.reduce(
    (acc, city) => {
      acc.pending += city.waitlistPending;
      acc.notified += city.waitlistNotified;
      if (city.available) acc.available += 1;
      else if (city.status === 'booked_until') acc.openingSoon += 1;
      else acc.booked += 1;
      return acc;
    },
    { pending: 0, notified: 0, available: 0, booked: 0, openingSoon: 0 }
  );

  return {
    ok: true,
    configured: true,
    totals,
    cities,
  };
}

async function removeWaitlistEntry(id) {
  const entryId = String(id || '').trim();
  if (!entryId) {
    const err = new Error('missing_id');
    err.status = 400;
    throw err;
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('city_partner_waitlist')
    .delete()
    .eq('id', entryId)
    .select('id, city_slug, email')
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
      const overview = await getAdminCityPartnerWaitlistOverview();
      return json(res, 200, overview);
    } catch (e) {
      if (e.code === 'waitlist_table_missing') {
        return json(res, 503, {
          ok: false,
          error: 'waitlist_table_missing',
          message: 'Run migration 189_city_partner_waitlist.sql in Supabase.',
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
      const removed = await removeWaitlistEntry(body.id);
      return json(res, 200, { ok: true, removed });
    } catch (e) {
      const status = e.status || 500;
      return json(res, status, { ok: false, error: e.message || 'remove_failed' });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
