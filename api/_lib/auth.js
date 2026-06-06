const crypto = require('crypto');

/** Airtable Users.Role values: `admin` (platform) | `client` (attendee ↔ organiser toggle). */
const USER_ROLES = {
  ADMIN: 'admin',
  CLIENT: 'client',
};

const USER_FIELDS = {
  email: ['Email', 'email'],
  passwordHash: ['Password Hash', 'Password', 'password_hash'],
  role: ['Role', 'role'],
  name: ['Name', 'Full Name', 'name'],
  resetToken: ['Reset Token', 'reset_token'],
  resetExpires: ['Reset Token Expires', 'Reset Expires', 'reset_expires'],
};

const USER_PROFILE_FIELDS = {
  location: ['Location', 'City', 'Region', 'Area', 'Town', 'Postcode'],
  marketPreferences: [
    'Market Preferences',
    'Marketing Preferences',
    'Preferences',
    'Interests',
    'Marketing',
  ],
  businessSector: ['Business Sector', 'Sector', 'Industry', 'Business Industry'],
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
const HUB_ORGANISER_SCOPE_COOKIE = 'hub_organiser_scope';

/** When `my`, platform admins see only their own organiser groups/events (not all data). */
function organiserPersonalScopeFromRequest(req) {
  const cookies = parseCookies(req);
  return String(cookies[HUB_ORGANISER_SCOPE_COOKIE] || '').toLowerCase() === 'my';
}

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
  if (session.impersonator) {
    return {
      ok: false,
      status: 403,
      error: 'impersonating',
      message: 'Stop impersonating to use the Command Center.',
    };
  }
  if (!isAdminRole(session.role)) return { ok: false, status: 403, error: 'admin_only' };
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

function fieldNameOnRecord(recordFields, candidates, fallback) {
  return resolveProfileFieldName(recordFields, candidates, null) ?? fallback;
}

/** First matching candidate on the record, or in the Users table schema when known. */
function resolveProfileFieldName(recordFields, candidates, tableFieldNames) {
  const f = recordFields || {};
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(f, key)) return key;
  }
  if (tableFieldNames) {
    for (const key of candidates) {
      if (tableFieldNames.has(key)) return key;
    }
  }
  return null;
}

let usersTableMetaCache = null;

const ROLE_AIRTABLE_CANDIDATES = {
  admin: ['admin', 'Admin', 'Administrator'],
  client: ['client', 'Client', 'member', 'Member', 'attendee', 'Attendee', 'user', 'User', 'organiser', 'Organiser'],
};

function usersProfileFieldAllowlist() {
  const raw = cleanEnvVal(process.env.AIRTABLE_USERS_PROFILE_COLUMNS);
  if (!raw) return null;
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

async function getUsersTableFieldsMeta() {
  if (usersTableMetaCache) return usersTableMetaCache;

  const allow = usersProfileFieldAllowlist();
  if (allow) {
    usersTableMetaCache = [...allow].map((name) => ({ name, type: 'unknown', options: [] }));
    return usersTableMetaCache;
  }

  const { apiKey, baseId, usersTable } = airtableConfig();
  if (!apiKey || !baseId) {
    usersTableMetaCache = [];
    return usersTableMetaCache;
  }

  try {
    const url = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (resp.ok) {
      const data = await resp.json();
      const table = (data.tables || []).find((t) => t.name === usersTable);
      if (table) {
        usersTableMetaCache = (table.fields || []).map((fld) => ({
          name: fld.name,
          type: fld.type,
          options:
            fld.type === 'singleSelect'
              ? (fld.options?.choices || []).map((c) => c.name).filter(Boolean)
              : [],
        }));
        return usersTableMetaCache;
      }
    }
  } catch {
    /* meta API may be unavailable on this token */
  }

  try {
    const q = new URLSearchParams({ maxRecords: '25' });
    const resp = await airtableFetch(`${encodeURIComponent(usersTable)}?${q}`);
    if (resp.ok) {
      const data = await resp.json();
      const names = new Set();
      (data.records || []).forEach((rec) => {
        Object.keys(rec.fields || {}).forEach((k) => names.add(k));
      });
      if (names.size) {
        usersTableMetaCache = [...names].map((name) => ({ name, type: 'unknown', options: [] }));
        return usersTableMetaCache;
      }
    }
  } catch {
    /* ignore */
  }

  usersTableMetaCache = [];
  return usersTableMetaCache;
}

async function getUsersTableFieldNames() {
  const meta = await getUsersTableFieldsMeta();
  if (!meta.length) return null;
  return new Set(meta.map((fld) => fld.name));
}

function roleFieldOptionsFromMeta(fieldsMeta, roleFieldName) {
  if (!roleFieldName || !fieldsMeta.length) return [];
  const field = fieldsMeta.find((f) => f.name === roleFieldName);
  return field?.options || [];
}

function pickRoleAirtableValue(normalizedRole, options) {
  const key = normalizedRole === USER_ROLES.ADMIN ? 'admin' : 'client';
  const envVar = key === 'admin' ? 'AIRTABLE_USER_ROLE_ADMIN' : 'AIRTABLE_USER_ROLE_CLIENT';
  const envVal = cleanEnvVal(process.env[envVar]);
  const opts = Array.isArray(options) ? options.filter(Boolean) : [];

  if (envVal) {
    if (!opts.length) return envVal;
    const envHit = opts.find((o) => String(o).toLowerCase() === envVal.toLowerCase());
    if (envHit) return envHit;
  }

  const candidates = ROLE_AIRTABLE_CANDIDATES[key] || ROLE_AIRTABLE_CANDIDATES.client;
  for (const candidate of candidates) {
    const hit = opts.find((o) => String(o).toLowerCase() === candidate.toLowerCase());
    if (hit) return hit;
  }
  for (const candidate of candidates) {
    const hit = opts.find((o) => {
      const ol = String(o).toLowerCase();
      const cl = candidate.toLowerCase();
      return ol.includes(cl) || cl.includes(ol);
    });
    if (hit) return hit;
  }

  if (opts.length) {
    if (key === 'admin') {
      const adminOpt = opts.find((o) => /admin/i.test(String(o)));
      if (adminOpt) return adminOpt;
    } else {
      const clientOpt = opts.find((o) => !/admin/i.test(String(o)));
      if (clientOpt) return clientOpt;
    }
  }

  return null;
}

function profileWritableFlags(user, tableFieldNames) {
  const f = user.fields || {};
  return {
    name: !!resolveProfileFieldName(f, USER_FIELDS.name, tableFieldNames),
    location: !!resolveProfileFieldName(f, USER_PROFILE_FIELDS.location, tableFieldNames),
    marketPreferences: !!resolveProfileFieldName(
      f,
      USER_PROFILE_FIELDS.marketPreferences,
      tableFieldNames
    ),
    businessSector: !!resolveProfileFieldName(f, USER_PROFILE_FIELDS.businessSector, tableFieldNames),
  };
}

function profileFromFields(f) {
  const prefs = pick(f, USER_PROFILE_FIELDS.marketPreferences);
  return {
    location: String(pick(f, USER_PROFILE_FIELDS.location) || '').trim(),
    marketPreferences: String(prefs || '').trim(),
    businessSector: String(pick(f, USER_PROFILE_FIELDS.businessSector) || '').trim(),
  };
}

function normalizeUser(record) {
  const f = record.fields || {};
  const profile = profileFromFields(f);
  return {
    id: record.id,
    email: String(pick(f, USER_FIELDS.email) || '').toLowerCase(),
    passwordHash: pick(f, USER_FIELDS.passwordHash),
    role: normalizeRole(pick(f, USER_FIELDS.role)),
    name: pick(f, USER_FIELDS.name) || '',
    resetToken: pick(f, USER_FIELDS.resetToken),
    resetExpires: pick(f, USER_FIELDS.resetExpires),
    location: profile.location,
    marketPreferences: profile.marketPreferences,
    businessSector: profile.businessSector,
    fields: f,
  };
}

async function buildUserRecordFields({ email, passwordHash, role, name }) {
  const fieldsMeta = await getUsersTableFieldsMeta();
  const tableFields = fieldsMeta.length ? new Set(fieldsMeta.map((f) => f.name)) : null;
  const empty = {};
  const fields = {};
  const emailKey = resolveProfileFieldName(empty, USER_FIELDS.email, tableFields) || 'Email';
  const pwKey =
    resolveProfileFieldName(empty, USER_FIELDS.passwordHash, tableFields) || 'Password Hash';
  const roleKey = resolveProfileFieldName(empty, USER_FIELDS.role, tableFields);
  const nameKey = resolveProfileFieldName(empty, USER_FIELDS.name, tableFields);

  fields[emailKey] = String(email).trim().toLowerCase();
  fields[pwKey] = passwordHash;
  const normalizedRole = normalizeRole(role);
  if (roleKey) {
    const roleOptions = roleFieldOptionsFromMeta(fieldsMeta, roleKey);
    const roleValue = pickRoleAirtableValue(normalizedRole, roleOptions);
    if (roleValue) {
      fields[roleKey] = roleValue;
    }
  }
  if (nameKey && name) fields[nameKey] = String(name).trim();
  return fields;
}

async function createUser({ email, passwordHash, role, name }) {
  const { usersTable } = airtableConfig();
  const fields = await buildUserRecordFields({ email, passwordHash, role, name });
  const resp = await airtableFetch(encodeURIComponent(usersTable), {
    method: 'POST',
    body: JSON.stringify({
      records: [{ fields }],
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    const parsed = parseAirtableError(err);
    if (parsed?.type === 'INVALID_MULTIPLE_CHOICE_OPTIONS') {
      throw new Error(
        'The Role value in Airtable does not match your table options. Add a Role option such as Client or Member in the Users table, or set AIRTABLE_USER_ROLE_CLIENT in Vercel to match an existing option exactly.'
      );
    }
    throw new Error(parsed?.message || err || 'create_failed');
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
        ? ' That column may be missing from your Airtable Users table. Core fields: Email, Password Hash, Role, Reset Token, Reset Token Expires. Optional profile fields: Name, Location (or City), Market Preferences, Business Sector.'
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
  USER_ROLES,
  USER_FIELDS,
  USER_PROFILE_FIELDS,
  fieldNameOnRecord,
  resolveProfileFieldName,
  getUsersTableFieldNames,
  profileWritableFlags,
  profileFromFields,
  normalizeRole,
  isAdminRole,
  isClientRole,
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
  airtableFetch,
  escapeFormulaValue,
  findUserByEmail,
  findUserByResetToken,
  createUser,
  updateUser,
  appendSystemLog,
  normalizeUser,
  hubViewFromRequest,
  setHubViewCookie,
  HUB_VIEW_COOKIE,
  organiserPersonalScopeFromRequest,
  HUB_ORGANISER_SCOPE_COOKIE,
};
