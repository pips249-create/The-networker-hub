/**
 * Admin — Hubert Matchmaker seed list (Rosie / ops).
 */
const { json, setCors, sessionFromRequest } = require('../auth');
const { isSupabaseConfigured } = require('../supabase');
const {
  normalizeSeedInput,
  listSeedContacts,
  createSeedContact,
  updateSeedContact,
  deleteSeedContact,
  isUuid,
} = require('../hubert-match-seed');

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body && typeof body === 'object' ? body : {};
}

function queryParam(req, key) {
  try {
    const url = new URL(req.url || '', 'https://internal.local');
    return String(url.searchParams.get(key) || '').trim();
  } catch {
    return '';
  }
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured', contacts: [] });
  }

  try {
    if (req.method === 'GET') {
      const data = await listSeedContacts({
        status: queryParam(req, 'status'),
        q: queryParam(req, 'q'),
        limit: queryParam(req, 'limit') || 200,
      });
      return json(res, 200, { ok: true, ...data });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const action = String(body.action || 'create').trim().toLowerCase();

      if (action === 'pause' || action === 'activate' || action === 'do_not_contact') {
        const id = String(body.id || '').trim();
        if (!isUuid(id)) return json(res, 400, { ok: false, error: 'invalid_id' });
        const status =
          action === 'activate' ? 'active' : action === 'pause' ? 'paused' : 'do_not_contact';
        const contact = await updateSeedContact(id, {
          status,
          paused_at: status === 'active' ? null : new Date().toISOString(),
          pause_reason:
            status === 'active'
              ? null
              : String(body.pauseReason || body.pause_reason || (action === 'pause' ? 'manual_pause' : 'do_not_contact')).slice(
                  0,
                  200
                ),
        });
        return json(res, 200, { ok: true, contact });
      }

      const parsed = normalizeSeedInput(body);
      if (!parsed.ok) {
        return json(res, 400, { ok: false, error: 'invalid_seed', fields: parsed.errors });
      }
      if (!parsed.fields.status) parsed.fields.status = 'active';
      const session = sessionFromRequest(req);
      const contact = await createSeedContact(
        parsed.fields,
        (session && (session.sub || session.userId || session.id)) || null
      );
      return json(res, 200, { ok: true, contact });
    }

    if (req.method === 'PATCH') {
      const body = parseBody(req);
      const id = String(body.id || queryParam(req, 'id') || '').trim();
      if (!isUuid(id)) return json(res, 400, { ok: false, error: 'invalid_id' });
      const parsed = normalizeSeedInput(body, { partial: true });
      if (!parsed.ok) {
        return json(res, 400, { ok: false, error: 'invalid_seed', fields: parsed.errors });
      }
      if (!Object.keys(parsed.fields).length) {
        return json(res, 400, { ok: false, error: 'empty_patch' });
      }
      const contact = await updateSeedContact(id, parsed.fields);
      return json(res, 200, { ok: true, contact });
    }

    if (req.method === 'DELETE') {
      const body = parseBody(req);
      const id = String(body.id || queryParam(req, 'id') || '').trim();
      const removed = await deleteSeedContact(id);
      return json(res, 200, { ok: true, id: removed });
    }

    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  } catch (e) {
    if (e && e.code === 'seed_table_missing') {
      return json(res, 503, {
        ok: false,
        error: 'seed_table_missing',
        message: 'Run migration 332_hubert_match_seed.sql in Supabase.',
        contacts: [],
      });
    }
    const status = e && e.status ? e.status : 500;
    return json(res, status, {
      ok: false,
      error: e && e.message ? e.message : 'seed_failed',
      message: e && e.message ? e.message : 'Seed request failed.',
    });
  }
};
