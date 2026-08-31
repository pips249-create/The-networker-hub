const crypto = require('crypto');
const { isAllowedOrigin } = require('./allowed-origins');

/** Hub account roles: `admin` (platform) | `client` (attendee ↔ organiser toggle). */
const USER_ROLES = {
  ADMIN: 'admin',
  CLIENT: 'client',
};

function normalizeRole(raw) {
  const r = String(raw || '')
    .toLowerCase()
    .trim();
  if (r === USER_ROLES.ADMIN) return USER_ROLES.ADMIN;
  if (r === USER_ROLES.CLIENT) return USER_ROLES.CLIENT;
  // Legacy: attendee, organiser, member, organizer → client
  return USER_ROLES.CLIENT;
}

function isAdminRole(role) {
  return normalizeRole(role) === USER_ROLES.ADMIN;
}

function isClientRole(role) {
  return normalizeRole(role) === USER_ROLES.CLIENT;
}

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64').toString('utf8');
}

function signSession(payload, secret) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifySession(token, secret) {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const data = `${header}.${body}`;
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(b64urlDecode(body));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  const out = {};
  raw.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i === -1) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (!k) return;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  });
  return out;
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
}

function sessionFromRequest(req) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const cookies = parseCookies(req);
  const token = cookies.hub_session;
  if (!token) return null;
  return verifySession(token, secret);
}

/** Organiser pages the admin opened impersonation from — must stay editable. */
function impersonatedOrganiserIdsFromSession(session) {
  if (!session || !session.impersonator) return [];
  const raw = session.impersonatedOrganiserIds;
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((id) => String(id || '').trim()).filter(Boolean))];
}

function applyImpersonationToSessionUser(fresh, session) {
  if (!fresh || !session || !session.impersonator) return fresh;
  fresh.impersonator = session.impersonator;
  const ids = impersonatedOrganiserIdsFromSession(session);
  if (ids.length) fresh.impersonatedOrganiserIds = ids;
  return fresh;
}

const SESSION_MAX_AGE_DEFAULT_SEC = 60 * 60 * 24 * 7;
const SESSION_MAX_AGE_REMEMBER_SEC = 60 * 60 * 24 * 30;
const SESSION_MAX_AGE_BROWSER_SEC = 60 * 60 * 24;

function cookieSecureSuffix() {
  return process.env.VERCEL_ENV === 'production' ? '; Secure' : '';
}

function appendSetCookie(res, cookie) {
  const prev = res.getHeader('Set-Cookie');
  if (!prev) {
    res.setHeader('Set-Cookie', cookie);
    return;
  }
  const list = Array.isArray(prev) ? prev.concat(cookie) : [String(prev), cookie];
  res.setHeader('Set-Cookie', list);
}

function setSessionCookie(res, payload, options) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;

  let maxAgeSec = SESSION_MAX_AGE_DEFAULT_SEC;
  let sessionOnly = false;

  if (options && typeof options.rememberMe === 'boolean') {
    if (options.rememberMe) {
      maxAgeSec = SESSION_MAX_AGE_REMEMBER_SEC;
    } else {
      sessionOnly = true;
      maxAgeSec = SESSION_MAX_AGE_BROWSER_SEC;
    }
  }

  const token = signSession(
    {
      ...payload,
      exp: Math.floor(Date.now() / 1000) + maxAgeSec,
    },
    secret
  );
  const maxAgePart = sessionOnly ? '' : `; Max-Age=${maxAgeSec}`;
  appendSetCookie(
    res,
    `hub_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${maxAgePart}${cookieSecureSuffix()}`
  );
  return true;
}

function clearSessionCookie(res) {
  appendSetCookie(
    res,
    `hub_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${cookieSecureSuffix()}`
  );
}

const HUB_VIEW_COOKIE = 'hub_view';
const HUB_ORGANISER_SCOPE_COOKIE = 'hub_organiser_scope';

/**
 * Platform-admin workspace scope.
 * - `all` → full platform admin view
 * - `my` or unset → personal organiser data only (default: faster first paint)
 */
function organiserPersonalScopeFromRequest(req) {
  const cookies = parseCookies(req);
  const raw = String(cookies[HUB_ORGANISER_SCOPE_COOKIE] || '').toLowerCase();
  return raw !== 'all';
}

function hubViewFromRequest(req) {
  const cookies = parseCookies(req);
  const mode = String(cookies[HUB_VIEW_COOKIE] || 'attendee').toLowerCase();
  return mode === 'organiser' ? 'organiser' : 'attendee';
}

function setHubViewCookie(res, mode) {
  const view = mode === 'organiser' ? 'organiser' : 'attendee';
  appendSetCookie(
    res,
    `${HUB_VIEW_COOKIE}=${view}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}${cookieSecureSuffix()}`
  );
}

function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

function requireAdmin(session) {
  if (!session) return { ok: false, status: 401, error: 'not_authenticated' };
  if (session.impersonator) {
    return {
      ok: false,
      status: 403,
      error: 'impersonating',
      message: 'Stop impersonating to use the Command Center.',
    };
  }
  if (!isAdminRole(session.role)) return { ok: false, status: 403, error: 'admin_only' };
  return { ok: true, session };
}

/**
 * Prefer this when a cookie claims admin: confirm hub_accounts.role is still admin.
 * Non-admin cookies are left unchanged. Lookup failure demotes claimed admins (fail closed).
 */
async function sessionWithLiveAdminRole(session) {
  if (!session || !isAdminRole(session.role)) return session;

  const userId = String(session.sub || session.userId || session.id || '').trim();
  if (!userId) {
    return { ...session, role: USER_ROLES.CLIENT };
  }

  try {
    const { getHubAccount } = require('./supabase-auth');
    const { isSupabaseConfigured } = require('./supabase');
    if (!isSupabaseConfigured()) {
      return { ...session, role: USER_ROLES.CLIENT };
    }
    const hub = await getHubAccount(userId);
    if (!isAdminRole(hub?.role)) {
      return { ...session, role: normalizeRole(hub?.role) || USER_ROLES.CLIENT };
    }
    return { ...session, role: USER_ROLES.ADMIN };
  } catch (e) {
    console.error('[auth] sessionWithLiveAdminRole failed', e?.message || e);
    return { ...session, role: USER_ROLES.CLIENT };
  }
}

/**
 * Prefer this on privileged entry points: cookie role + live hub_accounts.role.
 * Revoking admin in the DB takes effect immediately (not after session expiry).
 */
async function requireAdminLive(session) {
  const gate = requireAdmin(session);
  if (!gate.ok) return gate;

  const userId = String(session.sub || session.userId || session.id || '').trim();
  if (!userId) {
    return { ok: false, status: 403, error: 'admin_only' };
  }

  try {
    const { getHubAccount } = require('./supabase-auth');
    const { isSupabaseConfigured } = require('./supabase');
    if (!isSupabaseConfigured()) {
      return { ok: false, status: 503, error: 'supabase_not_configured' };
    }
    const hub = await getHubAccount(userId);
    if (!isAdminRole(hub?.role)) {
      return { ok: false, status: 403, error: 'admin_only', message: 'Admin access revoked.' };
    }
    return { ok: true, session: { ...session, role: USER_ROLES.ADMIN } };
  } catch (e) {
    console.error('[auth] requireAdminLive failed', e?.message || e);
    return {
      ok: false,
      status: 503,
      error: 'admin_check_failed',
      message: 'Could not verify admin access. Try again.',
    };
  }
}

function cleanEnvVal(v) {
  if (v == null || v === '') return '';
  let s = String(v).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/** Optional audit log — console only (Airtable System Logs removed). */
async function appendSystemLog(message, type = 'info') {
  try {
    console.info('[auth-log]', type, String(message || '').slice(0, 500));
  } catch {
    /* ignore */
  }
}

module.exports = {
  USER_ROLES,
  normalizeRole,
  isAdminRole,
  isClientRole,
  setCors,
  cleanEnvVal,
  sessionFromRequest,
  impersonatedOrganiserIdsFromSession,
  applyImpersonationToSessionUser,
  setSessionCookie,
  clearSessionCookie,
  json,
  requireAdmin,
  requireAdminLive,
  sessionWithLiveAdminRole,
  appendSystemLog,
  hubViewFromRequest,
  setHubViewCookie,
  HUB_VIEW_COOKIE,
  organiserPersonalScopeFromRequest,
  HUB_ORGANISER_SCOPE_COOKIE,
};
