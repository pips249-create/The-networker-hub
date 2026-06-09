const { sessionFromRequest, json, setCors } = require('../auth');
const { isSupabaseConfigured } = require('../supabase');
const { acceptOrganiserTerms, CURRENT_ORGANISER_TERMS_VERSION } = require('../supabase-auth');

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  if (!session) return json(res, 401, { ok: false, error: 'not_authenticated' });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'not_configured' });
  }

  const body = parseBody(req);
  const version = String(body.version || CURRENT_ORGANISER_TERMS_VERSION).trim();

  try {
    const userId = session.userId || session.sub;
    const result = await acceptOrganiserTerms(userId, version);
    return json(res, 200, {
      ok: true,
      organiserTermsAccepted: true,
      organiserTermsVersion: result.organiser_terms_version,
      organiserTermsAcceptedAt: result.organiser_terms_accepted_at,
    });
  } catch (e) {
    const msg = e.message || String(e);
    if (msg === 'hub_account_not_found') {
      return json(res, 404, { ok: false, error: msg });
    }
    return json(res, 500, { ok: false, error: 'accept_failed', message: msg });
  }
};
