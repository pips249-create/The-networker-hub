const { clearSessionCookie, json, setCors } = require('../lib/auth');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  clearSessionCookie(res);
  return json(res, 200, { ok: true });
};
