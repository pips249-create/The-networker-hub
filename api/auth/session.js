const {
  sessionFromRequest,
  setSessionCookie,
  clearSessionCookie,
  findUserByEmail,
  setCors,
  json,
  hubViewFromRequest,
} = require('../lib/auth');
const { listGroupsForUser } = require('../lib/organiser');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  if (!session) return json(res, 200, { ok: false, user: null });

  try {
    const user = await findUserByEmail(session.email);
    if (!user || !user.passwordHash) {
      clearSessionCookie(res);
      return json(res, 200, { ok: false, user: null });
    }

    const fresh = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    setSessionCookie(res, fresh);

    let organiserProfiles = 0;
    try {
      const groups = await listGroupsForUser(fresh.sub, fresh.email);
      organiserProfiles = groups.length;
    } catch {
      /* Airtable optional at sign-in */
    }

    return json(res, 200, {
      ok: true,
      user: fresh,
      hubView: hubViewFromRequest(req),
      organiserProfiles,
      canOrganise: organiserProfiles > 0 || fresh.role === 'admin',
    });
  } catch {
    return json(res, 200, {
      ok: true,
      user: {
        email: session.email,
        role: session.role,
        name: session.name,
        sub: session.sub,
      },
    });
  }
};
