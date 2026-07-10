const { setCors, json, sessionFromRequest } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { isUuid } = require('../uuid');
const { getAlumniEligibility } = require('../alumni-invites');

/** GET ?eventId=&token= — alumni Fast-Pass eligibility for signed-in attendee or invite token. */
module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  const eventId = String(req.query?.eventId || req.query?.event_id || '').trim();
  const token = String(req.query?.token || req.query?.alumni_token || '').trim();
  if (!isUuid(eventId)) {
    return json(res, 400, { ok: false, error: 'invalid_event_id' });
  }

  const session = sessionFromRequest(req);
  const email = String(session?.email || '')
    .trim()
    .toLowerCase();

  if (!token && !email) {
    return json(res, 200, {
      ok: true,
      eligible: false,
      reason: 'not_authenticated',
    });
  }

  try {
    const sb = getSupabaseAdmin();
    const eligibility = await getAlumniEligibility(sb, {
      eventId,
      email: email || null,
      attendeeId: session?.sub || null,
      token: token || null,
    });

    return json(res, 200, {
      ok: true,
      eligible: eligibility.eligible,
      reason: eligibility.reason,
      alumniTierId: eligibility.alumniTierId || null,
      inviteToken: eligibility.inviteToken || null,
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: 'eligibility_failed',
      message: e.message || String(e),
    });
  }
};
