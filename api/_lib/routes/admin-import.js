const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { isSupabaseConfigured } = require('../supabase');
const { importOrganisersFromCsv, importAttendeesFromCsv } = require('../admin-csv-import');

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  const body = parseBody(req);
  const type = String(body.type || '').trim().toLowerCase();
  const csv = String(body.csv || '');

  if (!csv.trim()) return json(res, 400, { ok: false, error: 'missing_csv' });
  if (type !== 'organisers' && type !== 'attendees') {
    return json(res, 400, { ok: false, error: 'invalid_type' });
  }

  try {
    const result =
      type === 'organisers' ? await importOrganisersFromCsv(csv) : await importAttendeesFromCsv(csv);
    return json(res, 200, {
      ok: true,
      type,
      ...result,
      message:
        result.ok +
        ' row' +
        (result.ok === 1 ? '' : 's') +
        ' imported' +
        (result.fail ? ', ' + result.fail + ' skipped' : '') +
        '.',
    });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'import_failed', message: e.message });
  }
};
