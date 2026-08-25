/**
 * Admin — International map leads (country interest + building market group intake).
 */
const { requireAdmin, json, setCors, sessionFromRequest } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');

function mapInterest(row) {
  return {
    id: row.id,
    email: row.email,
    countryCode: row.country_code,
    countryName: row.country_name,
    intent: row.intent,
    source: row.source || 'international_map',
    createdAt: row.created_at,
  };
}

function mapIntake(row) {
  return {
    id: row.id,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone || null,
    groupName: row.group_name,
    websiteUrl: row.website_url || null,
    orgType: row.org_type || 'networking_group',
    description: row.description || null,
    countryCode: row.country_code,
    countryName: row.country_name,
    status: row.status || 'open',
    source: row.source || 'international_map',
    createdAt: row.created_at,
    resolvedAt: row.resolved_at || null,
    resolvedBy: row.resolved_by || null,
  };
}

const INTAKE_SELECT =
  'id, contact_name, email, phone, group_name, website_url, org_type, description, country_code, country_name, status, source, created_at, resolved_at, resolved_by';

async function listInterest(limit) {
  const sb = getSupabaseAdmin();
  const max = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const res = await sb
    .from('international_country_interest')
    .select('id, email, country_code, country_name, intent, source, created_at')
    .order('created_at', { ascending: false })
    .limit(max);

  if (res.error) {
    if (/international_country_interest/i.test(res.error.message || '')) {
      const err = new Error('interest_table_missing');
      err.code = 'interest_table_missing';
      throw err;
    }
    throw new Error(res.error.message);
  }

  const interest = (res.data || []).map(mapInterest);
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const recentCount = interest.filter(function (row) {
    return row.createdAt && new Date(row.createdAt) >= since;
  }).length;

  return { interest, recentCount, total: interest.length };
}

async function listIntake(limit, status) {
  const sb = getSupabaseAdmin();
  const max = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const statusFilter = String(status || '').trim().toLowerCase();

  let query = sb
    .from('international_group_intake')
    .select(INTAKE_SELECT)
    .order('created_at', { ascending: false })
    .limit(max);
  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const res = await query;
  if (res.error) {
    if (/international_group_intake/i.test(res.error.message || '')) {
      const err = new Error('intake_table_missing');
      err.code = 'intake_table_missing';
      throw err;
    }
    throw new Error(res.error.message);
  }

  const intake = (res.data || []).map(mapIntake);
  const openCount = intake.filter(function (row) {
    return row.status === 'open';
  }).length;

  return { intake, openCount, total: intake.length };
}

async function updateIntakeStatus(id, status, session) {
  const allowed = { open: true, done: true, spam: true };
  const next = String(status || '').trim().toLowerCase();
  if (!allowed[next]) {
    const err = new Error('invalid_status');
    err.code = 'invalid_status';
    throw err;
  }

  const sb = getSupabaseAdmin();
  const patch = {
    status: next,
    resolved_at: next === 'open' ? null : new Date().toISOString(),
    resolved_by:
      next === 'open'
        ? null
        : String((session && (session.email || session.userEmail || session.sub)) || 'admin').trim(),
  };

  const { data, error } = await sb
    .from('international_group_intake')
    .update(patch)
    .eq('id', id)
    .select(INTAKE_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return { ok: true, submission: mapIntake(data) };
}

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

  try {
    if (req.method === 'GET') {
      const type = String((req.query && req.query.type) || 'all').toLowerCase();
      const limit = req.query && req.query.limit;
      const status = req.query && req.query.status;

      if (type === 'interest') {
        const interest = await listInterest(limit);
        return json(res, 200, { ok: true, configured: true, ...interest });
      }
      if (type === 'intake' || type === 'building') {
        const intake = await listIntake(limit, status);
        return json(res, 200, { ok: true, configured: true, ...intake });
      }

      const [interest, intake] = await Promise.all([
        listInterest(limit),
        listIntake(limit, status || 'all'),
      ]);
      return json(res, 200, {
        ok: true,
        configured: true,
        interest: interest.interest,
        interestTotal: interest.total,
        interestRecentCount: interest.recentCount,
        intake: intake.intake,
        intakeTotal: intake.total,
        intakeOpenCount: intake.openCount,
      });
    }

    if (req.method === 'PATCH' || req.method === 'POST') {
      const body = parseBody(req);
      const id = String(body.id || '').trim();
      if (!id) return json(res, 400, { ok: false, error: 'missing_id' });
      const result = await updateIntakeStatus(id, body.status, session);
      return json(res, 200, result);
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    if (e.code === 'interest_table_missing' || e.code === 'intake_table_missing') {
      return json(res, 503, {
        ok: false,
        error: e.code,
        message:
          'Run migrations 261_international_country_interest.sql and 262_international_group_intake.sql in Supabase.',
      });
    }
    if (e.code === 'invalid_status') {
      return json(res, 400, {
        ok: false,
        error: 'invalid_status',
        message: 'Status must be open, done, or spam.',
      });
    }
    return json(res, 500, {
      ok: false,
      error: 'international_leads_failed',
      message: e.message,
    });
  }
};
