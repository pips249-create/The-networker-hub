const {
  sessionFromRequest,
  json,
  setCors,
  setSessionCookie,
  appendSystemLog,
  normalizeRole,
} = require('../auth');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  if (!session || !session.impersonator) {
    return json(res, 400, {
      error: 'not_impersonating',
      message: 'You are not impersonating anyone.',
    });
  }

  const admin = session.impersonator;
  const adminSession = {
    sub: admin.sub,
    email: admin.email,
    role: normalizeRole(admin.role || 'admin'),
    name: admin.name || '',
  };

  if (!setSessionCookie(res, adminSession)) {
    return json(res, 503, { error: 'session_failed' });
  }

  await appendSystemLog(
    `Admin ${admin.email} stopped impersonating ${session.email}`,
    'security'
  );

  return json(res, 200, {
    ok: true,
    message: 'Returned to your admin account.',
    redirect: '/admin/index.html#impersonate',
    user: adminSession,
  });
};
