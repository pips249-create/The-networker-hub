const { json, setCors } = require('../auth');
const {
  getSiteAccessPassword,
  getBannerPeekToken,
  isSiteAccessRequired,
  setSiteAccessCookie,
  clearSiteAccessCookie,
  siteAccessStatus,
} = require('../site-access');
const { addPreviewWaitlistEmail } = require('../preview-waitlist');
const { enforceRateLimitAsync } = require('../rate-limit');
const { timingSafeEqualString } = require('../crypto-utils');

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

function safeNextPath(raw) {
  let redirect = String(raw || '/').trim();
  if (!redirect.startsWith('/') || redirect.startsWith('//')) {
    redirect = '/';
  }
  return redirect;
}

/** Banner soft-preview may only land inside the closed /peek mini-site. */
function safePeekNextPath(raw) {
  const next = safeNextPath(raw);
  if (next === '/peek' || next.startsWith('/peek/') || next.startsWith('/peek?')) {
    return next;
  }
  return '/peek';
}

function matchesTeamPassword(password) {
  const value = String(password || '').trim();
  const team = getSiteAccessPassword();
  return Boolean(value && team && timingSafeEqualString(value, team));
}

function matchesBannerPeek(password) {
  const value = String(password || '').trim();
  const banner = getBannerPeekToken();
  return Boolean(value && banner && timingSafeEqualString(value, banner));
}

async function handleWaitlistSignup(req, res, body) {
  const limited = await enforceRateLimitAsync(req, res, 'site_access_waitlist', { max: 6, windowMs: 300_000 });
  if (!limited.allowed) {
    return json(res, 429, {
      error: 'rate_limited',
      message: 'Too many sign-up attempts. Please try again shortly.',
      retryAfterSec: limited.retryAfterSec,
    });
  }

  if (String(body.website || '').trim()) {
    return json(res, 200, {
      ok: true,
      message: 'Thanks — we will be in touch before launch.',
    });
  }

  try {
    const source = String(body.source || 'site_access')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 40);
    const result = await addPreviewWaitlistEmail(body.email, {
      source: source || 'site_access',
    });
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

async function handleLockPreview(req, res) {
  clearSiteAccessCookie(res);
  return json(res, 200, {
    ok: true,
    locked: true,
    message: 'Preview access cleared. Enter the password to unlock again.',
  });
}

async function handlePasswordUnlock(req, res, body) {
  try {
    const limited = await enforceRateLimitAsync(req, res, 'site_access_password', { max: 8, windowMs: 300_000 });
    if (!limited.allowed) {
      return json(res, 429, {
        error: 'rate_limited',
        message: 'Too many attempts. Please wait a few minutes and try again.',
        retryAfterSec: limited.retryAfterSec,
      });
    }

    if (!isSiteAccessRequired()) {
      return json(res, 200, {
        ok: true,
        message: 'Site access gate is not enabled.',
        redirect: safeNextPath(body.next),
      });
    }

    const expected = getSiteAccessPassword();
    if (!expected) {
      return json(res, 503, {
        error: 'not_configured',
        message: 'Set SITE_ACCESS_PASSWORD in Vercel to enable the site access gate.',
      });
    }

    const password = String(body.password || '').trim();
    // Banner peek token must NOT unlock the full Hub — only the team password does.
    if (!matchesTeamPassword(password)) {
      if (matchesBannerPeek(password) || matchesBannerPeek(String(body.peek || '').trim())) {
        return json(res, 200, {
          ok: true,
          peekOnly: true,
          redirect: safePeekNextPath(body.next),
          message: 'Soft preview opens the Peek pages only — not the full Hub.',
        });
      }
      return json(res, 401, {
        error: 'invalid_password',
        message: 'Incorrect preview password. Check SITE_ACCESS_PASSWORD in Vercel matches exactly.',
      });
    }

    if (!setSiteAccessCookie(res)) {
      return json(res, 503, {
        error: 'cookie_failed',
        message: 'Could not save preview access. Try again shortly.',
      });
    }

    return json(res, 200, {
      ok: true,
      redirect: safeNextPath(body.next),
    });
  } catch (e) {
    return json(res, 500, {
      error: 'site_access_failed',
      message: e.message || 'Preview login failed.',
    });
  }
}

async function handlePeekUnlockGet(req, res) {
  const limited = await enforceRateLimitAsync(req, res, 'site_access_banner_peek', { max: 20, windowMs: 300_000 });
  if (!limited.allowed) {
    res.statusCode = 429;
    res.setHeader('Location', '/site-access');
    res.setHeader('Retry-After', String(limited.retryAfterSec || 60));
    return res.end();
  }

  let url;
  try {
    url = new URL(req.url, 'https://internal.local');
  } catch {
    res.statusCode = 302;
    res.setHeader('Location', '/site-access');
    return res.end();
  }

  const peek = String(url.searchParams.get('peek') || '').trim();
  const nextRaw = url.searchParams.get('next') || '/peek';

  if (!isSiteAccessRequired()) {
    res.statusCode = 302;
    res.setHeader('Location', safePeekNextPath(nextRaw));
    return res.end();
  }

  if (!getSiteAccessPassword()) {
    res.statusCode = 302;
    res.setHeader('Location', '/site-access');
    return res.end();
  }

  // Public banner token → /peek only (no full-site cookie).
  if (matchesBannerPeek(peek)) {
    res.statusCode = 302;
    res.setHeader('Location', safePeekNextPath(nextRaw));
    res.setHeader('Cache-Control', 'no-store');
    return res.end();
  }

  // Team password via GET peek= still unlocks full preview (internal share links).
  if (matchesTeamPassword(peek)) {
    if (!setSiteAccessCookie(res)) {
      res.statusCode = 302;
      res.setHeader('Location', '/site-access?peek_error=1');
      return res.end();
    }
    res.statusCode = 302;
    res.setHeader('Location', safeNextPath(nextRaw));
    res.setHeader('Cache-Control', 'no-store');
    return res.end();
  }

  res.statusCode = 302;
  res.setHeader('Location', '/site-access?peek_error=1');
  return res.end();
}

module.exports = async function handler(req, res) {
  try {
    setCors(req, res);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
      let peek = '';
      try {
        peek = String(new URL(req.url, 'https://internal.local').searchParams.get('peek') || '').trim();
      } catch {
        peek = '';
      }
      if (peek) {
        return handlePeekUnlockGet(req, res);
      }
      return json(res, 200, siteAccessStatus());
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

    const body = parseBody(req);
    const intent = String(body.intent || '').trim().toLowerCase();

    if (intent === 'lock' || intent === 'logout' || intent === 'clear') {
      return handleLockPreview(req, res);
    }

    if (intent === 'waitlist' || (body.email && !body.password && !body.peek)) {
      return handleWaitlistSignup(req, res, body);
    }

    return handlePasswordUnlock(req, res, body);
  } catch (e) {
    return json(res, 500, {
      error: 'site_access_failed',
      message: e.message || 'Preview access request failed.',
    });
  }
};
