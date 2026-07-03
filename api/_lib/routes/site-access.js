const { json, setCors, sessionFromRequest, isAdminRole } = require('../auth');
const {
  getSiteAccessPassword,
  isSiteAccessRequired,
  setSiteAccessCookie,
  siteAccessStatus,
} = require('../site-access');
const { addPreviewWaitlistEmail } = require('../preview-waitlist');

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

async function handleWaitlistSignup(req, res, body) {
  if (String(body.website || '').trim()) {
    return json(res, 200, {
      ok: true,
      message: 'Thanks — we will be in touch before launch.',
    });
  }

  try {
    const result = await addPreviewWaitlistEmail(body.email, { source: 'site_access' });
    return json(res, 200, {
      ok: true,
      alreadyRegistered: result.alreadyRegistered,
      message: result.alreadyRegistered
        ? 'You are already on the preview list — we will email you when access opens.'
        : 'Thanks — you are on the list. We will email you before the public launch.',
    });
  } catch (e) {
    const code = e.code || 'waitlist_failed';
    const status =
      code === 'invalid_email' ? 400 : code === 'not_configured' ? 503 : 500;
    return json(res, status, {
      error: code,
      message: e.message || 'Could not save your email.',
    });
  }
}

async function handlePasswordUnlock(req, res, body) {
  if (!isSiteAccessRequired()) {
    return json(res, 200, { ok: true, message: 'Site access gate is not enabled.' });
  }

  if (!process.env.SESSION_SECRET) {
    return json(res, 503, {
      error: 'not_configured',
      message: 'Set SESSION_SECRET in Vercel to enable the site access gate.',
    });
  }

  const password = String(body.password || '');
  const expected = getSiteAccessPassword();

  if (!password || password !== expected) {
    return json(res, 401, {
      error: 'invalid_password',
      message: 'Incorrect access password.',
    });
  }

  if (!setSiteAccessCookie(res)) {
    return json(res, 503, { error: 'cookie_failed' });
  }

  const session = sessionFromRequest(req);
  let redirect = String(body.next || '/').trim();
  if (!redirect.startsWith('/') || redirect.startsWith('//')) {
    redirect = '/';
  }

  return json(res, 200, {
    ok: true,
    redirect,
    adminSession: Boolean(session && isAdminRole(session.role)),
  });
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return json(res, 200, siteAccessStatus());
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const body = parseBody(req);
  const intent = String(body.intent || '').trim().toLowerCase();

  if (intent === 'waitlist' || (body.email && !body.password)) {
    return handleWaitlistSignup(req, res, body);
  }

  return handlePasswordUnlock(req, res, body);
};
