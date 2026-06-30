const { setCors, json, sessionFromRequest } = require('../auth');
const { isSupabaseConfigured } = require('../supabase');
const { getEventApplicationForSession } = require('../supabase-application-submissions');
const { isUuid } = require('../uuid');

/** GET — current attendee's OSOP application status for one event. */
module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }
  if (!session) {
    return json(res, 401, { ok: false, error: 'not_authenticated', hasApplication: false });
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    const eventId = String(url.searchParams.get('eventId') || url.searchParams.get('event_id') || '').trim();
    if (!isUuid(eventId)) {
      return json(res, 400, { ok: false, error: 'invalid_event_id', hasApplication: false });
    }

    const application = await getEventApplicationForSession(session, eventId);
    return json(res, 200, { ok: true, ...application });
  } catch (e) {
    const code = e.code || e.message || 'application_lookup_failed';
    return json(res, 500, {
      ok: false,
      error: code,
      message: e.message,
      hasApplication: false,
    });
  }
};
