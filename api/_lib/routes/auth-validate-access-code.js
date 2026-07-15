const { setCors, json } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { isUuid } = require('../uuid');
const { lookupAccessCode } = require('../ticket-access-codes');
const { ticketRowToTier, fetchRegistrationCountsByTicket } = require('../supabase-events');

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

/** Validate an access code and return unlocked hidden ticket tier(s). */
module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  try {
    const body = parseBody(req);
    const eventId = String(body.eventId || body.event_id || '').trim();
    const code = String(body.code || body.accessCode || body.access_code || '').trim();

    if (!isUuid(eventId)) {
      return json(res, 400, { ok: false, error: 'invalid_event_id' });
    }
    if (!code) {
      return json(res, 400, { ok: false, error: 'missing_access_code' });
    }

    const sb = getSupabaseAdmin();
    const evRes = await sb
      .from('events')
      .select('id, status, approval_status')
      .eq('id', eventId)
      .maybeSingle();
    if (evRes.error) throw new Error(evRes.error.message);
    if (!evRes.data) return json(res, 404, { ok: false, error: 'event_not_found' });
    if (String(evRes.data.status || '').toLowerCase() !== 'published') {
      return json(res, 400, { ok: false, error: 'event_not_published' });
    }

    const lookup = await lookupAccessCode(sb, { eventId, code });
    if (!lookup.valid) {
      const messages = {
        access_code_not_found: 'That access code is not valid for this event.',
        access_code_expired: 'That access code has expired or reached its usage limit.',
        invalid_access_code: 'Enter a valid access code.',
      };
      return json(res, 400, {
        ok: false,
        error: lookup.error || 'access_code_invalid',
        message: messages[lookup.error] || 'That access code is not valid for this event.',
      });
    }

    const counts = await fetchRegistrationCountsByTicket(sb, [lookup.ticket]);
    const sold = counts.get(lookup.ticket.id) || 0;
    const tier = ticketRowToTier(lookup.ticket, sold);
    tier.unlockedByAccessCode = true;

    return json(res, 200, {
      ok: true,
      tiers: [tier],
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: 'validate_access_code_failed',
      message: e.message || String(e),
    });
  }
};
