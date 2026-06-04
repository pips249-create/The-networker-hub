const { sessionFromRequest, json } = require('../lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  if (!session) return json(res, 200, { ok: false, user: null });

  return json(res, 200, {
    ok: true,
    user: {
      email: session.email,
      role: session.role,
      name: session.name,
      sub: session.sub,
    },
  });
};
