const { setCors, json, sessionFromRequest, hubViewFromRequest, setHubViewCookie } = require('../lib/auth');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = sessionFromRequest(req);
  if (!session) return json(res, 401, { error: 'not_authenticated' });

  if (req.method === 'GET') {
    return json(res, 200, { ok: true, hubView: hubViewFromRequest(req) });
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    const mode = String(body.mode || body.hubView || '').toLowerCase();
    if (mode !== 'attendee' && mode !== 'organiser') {
      return json(res, 400, { error: 'invalid_mode' });
    }
    setHubViewCookie(res, mode);
    return json(res, 200, {
      ok: true,
      hubView: mode,
      redirect: mode === 'organiser' ? '/organiser/index.html' : '/events/index.html',
    });
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
