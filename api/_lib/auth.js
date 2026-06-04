const crypto = require('crypto');

const USER_FIELDS = {
  email: ['Email', 'email'],
  passwordHash: ['Password Hash', 'Password', 'password_hash'],
  role: ['Role', 'role'],
  name: ['Name', 'Full Name', 'name'],
  resetToken: ['Reset Token', 'reset_token'],
  resetExpires: ['Reset Token Expires', 'Reset Expires', 'reset_expires'],
};

function pick(fields, keys) {
  for (const key of keys) {
    if (fields[key] !== undefined && fields[key] !== null && fields[key] !== '') {
      return fields[key];
    }
  }
  return null;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(password), salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2:${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split(':');
  if (parts[0] !== 'pbkdf2' || parts.length !== 3) return false;
  const [, salt, expected] = parts;
  const hash = crypto.pbkdf2Sync(String(password), salt, 100000, 64, 'sha512').toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
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
  if (origin) {
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

function setSessionCookie(res, payload) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const token = signSession(
    {
      ...payload,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    },
    secret
  );
  const secure = process.env.VERCEL_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `hub_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${secure}`
  );
  return true;
}

function clearSessionCookie(res) {
  const secure = process.env.VERCEL_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `hub_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

const HUB_VIEW_COOKIE = 'hub_view';

function hubViewFromRequest(req) {
  const cookies = parseCookies(req);
  const mode = String(cookies[HUB_VIEW_COOKIE] || 'attendee').toLowerCase();
  return mode === 'organiser' ? 'organiser' : 'attendee';
}

function setHubViewCookie(res, mode) {
  const view = mode === 'organiser' ? 'organiser' : 'attendee';
  const secure = process.env.VERCEL_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${HUB_VIEW_COOKIE}=${view}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}${secure}`
  );
}

function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

function requireAdmin(session) {
  if (!session) return { ok: false, status: 401, error: 'not_authenticated' };
  if (session.role !== 'admin') return { ok: false, status: 403, error: 'admin_only' };
  return { ok: true };
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

function parseAirtableError(detail) {
  if (!detail) return null;
  try {
    const j = JSON.parse(detail);
    return j.error || j;
  } catch {
    return { message: String(detail).slice(0, 200) };
  }
}

function airtableConfig() {
  return {
    apiKey: cleanEnvVal(process.env.AIRTABLE_API_KEY),
    baseId: cleanEnvVal(process.env.AIRTABLE_BASE_ID),
    usersTable: process.env.AIRTABLE_USERS_TABLE || 'Users',
    logsTable: process.env.AIRTABLE_LOGS_TABLE || 'System Logs',
    alertsTable: process.env.AIRTABLE_ALERTS_TABLE || 'System Alerts',
  };
}

async function testAirtableConnection() {
  const { apiKey, baseId, usersTable } = airtableConfig();
  if (!apiKey || !baseId) {
    return { ok: false, error: 'missing_env', message: 'AIRTABLE_API_KEY or AIRTABLE_BASE_ID not set' };
  }
  if (!apiKey.startsWith('pat')) {
    return {
      ok: false,
      error: 'invalid_token_format',
      message: 'AIRTABLE_API_KEY should start with pat (personal access token from airtable.com/create/tokens).',
    };
  }
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(usersTable)}?maxRecords=1`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (resp.ok) {
    return { ok: true, status: resp.status };
  }
  const text = await resp.text();
  const parsed = parseAirtableError(text);
  return {
    ok: false,
    status: resp.status,
    error: parsed?.type || 'airtable_error',
    message: parsed?.message || text.slice(0, 200),
  };
}

async function airtableFetch(path, options = {}) {
  const { apiKey, baseId } = airtableConfig();
  if (!apiKey || !baseId) throw new Error('airtable_not_configured');
  const url = `https://api.airtable.com/v0/${baseId}/${path}`;
  const resp = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  return resp;
}

function escapeFormulaValue(s) {
  return String(s).replace(/'/g, "''");
}

async function findUserByEmail(email) {
  const { usersTable } = airtableConfig();
  const formula = `{Email}='${escapeFormulaValue(email.toLowerCase())}'`;
  const q = new URLSearchParams({
    filterByFormula: formula,
    maxRecords: '1',
  });
  const resp = await airtableFetch(`${encodeURIComponent(usersTable)}?${q}`);
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(err || 'airtable_error');
  }
  const data = await resp.json();
  const record = (data.records || [])[0];
  if (!record) return null;
  return normalizeUser(record);
}

async function findUserByResetToken(token) {
  const { usersTable } = airtableConfig();
  const formula = `{Reset Token}='${escapeFormulaValue(token)}'`;
  const q = new URLSearchParams({
    filterByFormula: formula,
    maxRecords: '1',
  });
  const resp = await airtableFetch(`${encodeURIComponent(usersTable)}?${q}`);
  if (!resp.ok) throw new Error('airtable_error');
  const data = await resp.json();
  const record = (data.records || [])[0];
  if (!record) return null;
  return normalizeUser(record);
}

function normalizeUser(record) {
  const f = record.fields || {};
  return {
    id: record.id,
    email: String(pick(f, USER_FIELDS.email) || '').toLowerCase(),
    passwordHash: pick(f, USER_FIELDS.passwordHash),
    role: String(pick(f, USER_FIELDS.role) || 'attendee').toLowerCase(),
    name: pick(f, USER_FIELDS.name) || '',
    resetToken: pick(f, USER_FIELDS.resetToken),
    resetExpires: pick(f, USER_FIELDS.resetExpires),
    fields: f,
  };
}

async function createUser({ email, passwordHash, role, name }) {
  const { usersTable } = airtableConfig();
  const resp = await airtableFetch(encodeURIComponent(usersTable), {
    method: 'POST',
    body: JSON.stringify({
      records: [
        {
          fields: {
            Email: email.toLowerCase(),
            'Password Hash': passwordHash,
            Role: role,
            Name: name || '',
          },
        },
      ],
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(err || 'create_failed');
  }
  const data = await resp.json();
  return normalizeUser(data.records[0]);
}

function sanitizeAirtableFields(fields) {
  const out = {};
  Object.entries(fields).forEach(([key, val]) => {
    if (val === '' || val === undefined) {
      out[key] = null;
    } else {
      out[key] = val;
    }
  });
  return out;
}

async function updateUser(recordId, fields) {
  const { usersTable } = airtableConfig();
  const payload = sanitizeAirtableFields(fields);
  const resp = await airtableFetch(encodeURIComponent(usersTable), {
    method: 'PATCH',
    body: JSON.stringify({ records: [{ id: recordId, fields: payload }] }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    const parsed = parseAirtableError(err);
    const msg = parsed?.message || parsed?.type || err || 'update_failed';
    const hint =
      parsed?.type === 'UNKNOWN_FIELD_NAME'
        ? ' Check Users table field names match: Email, Password Hash, Role, Reset Token, Reset Token Expires.'
        : '';
    throw new Error(String(msg).slice(0, 240) + hint);
  }
  const data = await resp.json();
  return normalizeUser(data.records[0]);
}

async function appendSystemLog(message, type = 'info') {
  const { logsTable } = airtableConfig();
  try {
    await airtableFetch(encodeURIComponent(logsTable), {
      method: 'POST',
      body: JSON.stringify({
        records: [
          {
            fields: {
              Message: message,
              Type: type,
              Timestamp: new Date().toISOString(),
            },
          },
        ],
      }),
    });
  } catch {
    /* optional table */
  }
}

module.exports = {
  USER_FIELDS,
  pick,
  setCors,
  cleanEnvVal,
  parseAirtableError,
  testAirtableConnection,
  hashPassword,
  verifyPassword,
  sessionFromRequest,
  setSessionCookie,
  clearSessionCookie,
  json,
  requireAdmin,
  airtableConfig,
  findUserByEmail,
  findUserByResetToken,
  createUser,
  updateUser,
  appendSystemLog,
  normalizeUser,
  hubViewFromRequest,
  setHubViewCookie,
  HUB_VIEW_COOKIE,
};
