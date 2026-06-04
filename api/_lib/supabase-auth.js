/**
 * Auth via Supabase (hub_accounts + auth.users). No Airtable.
 */
const { getSupabaseAdmin, getSupabaseAnon, isSupabaseConfigured } = require('./supabase');

const USER_ROLES = { ADMIN: 'admin', CLIENT: 'client' };

/** When false (default), the app never triggers Supabase/Resend auth emails. */
function authEmailsEnabled() {
  const v = String(process.env.AUTH_SEND_EMAILS || '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function normalizeRole(raw) {
  const r = String(raw || '').toLowerCase().trim();
  return r === USER_ROLES.ADMIN ? USER_ROLES.ADMIN : USER_ROLES.CLIENT;
}

async function getHubAccount(userId) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('hub_accounts').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function findUserByEmail(email) {
  const em = String(email || '').trim().toLowerCase();
  if (!em) return null;

  const sb = getSupabaseAdmin();
  const { data: list, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(error.message);

  const authUser = (list.users || []).find((u) => u.email?.toLowerCase() === em);
  if (!authUser) return null;

  const hub = await getHubAccount(authUser.id);
  const { data: attendee } = await sb
    .from('attendees')
    .select('name')
    .eq('email', em)
    .maybeSingle();

  return {
    id: authUser.id,
    email: authUser.email,
    role: hub?.role || USER_ROLES.CLIENT,
    name: hub?.display_name || attendee?.name || authUser.user_metadata?.full_name || '',
    passwordHash: 'supabase',
  };
}

async function verifyLogin(email, password) {
  const { url, anonKey } = require('./supabase').supabaseConfig();
  if (!url || !anonKey) throw new Error('SUPABASE_ANON_KEY required for login');

  const anon = getSupabaseAnon();
  const { data, error } = await anon.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, user: data.user };
}

/**
 * Create/update Auth user without confirmation or invite emails.
 * Requires email_confirm: true (marks verified; does not send signup mail).
 */
async function createUserSilent({ email, password, name, metadata }) {
  const sb = getSupabaseAdmin();
  const em = email.trim().toLowerCase();

  const existing = await findUserByEmail(em);
  if (existing) {
    if (password) {
      const { error } = await sb.auth.admin.updateUserById(existing.id, { password });
      if (error) throw new Error(error.message);
    }
    return { id: existing.id, email: em, existed: true };
  }

  const { data: created, error } = await sb.auth.admin.createUser({
    email: em,
    password: password || cryptoRandomPassword(),
    email_confirm: true,
    user_metadata: { full_name: name || '', ...(metadata || {}) },
  });
  if (error) throw new Error(error.message);
  return { id: created.user.id, email: em, existed: false };
}

function cryptoRandomPassword() {
  const crypto = require('crypto');
  return crypto.randomBytes(24).toString('base64url');
}

async function registerUser({ email, password, name }) {
  const sb = getSupabaseAdmin();
  const em = email.trim().toLowerCase();

  const { id: userId, existed } = await createUserSilent({
    email: em,
    password,
    name,
    metadata: { full_name: name || '' },
  });
  if (existed) {
    throw new Error('An account with this email already exists. Sign in instead.');
  }

  await sb.from('hub_accounts').upsert(
    {
      user_id: userId,
      role: USER_ROLES.CLIENT,
      hub_view: 'attendee',
      display_name: name || null,
    },
    { onConflict: 'user_id' }
  );

  await sb.from('attendees').upsert(
    {
      email: em,
      name: name || null,
      supabase_user_id: userId,
    },
    { onConflict: 'email' }
  );

  return {
    id: userId,
    email: em,
    role: USER_ROLES.CLIENT,
    name: name || '',
  };
}

async function ensureAdminUser({ email, password, name }) {
  const sb = getSupabaseAdmin();
  const em = email.trim().toLowerCase();
  let userId;

  const result = await createUserSilent({
    email: em,
    password,
    name: name || 'Platform Admin',
    metadata: { full_name: name || 'Platform Admin' },
  });
  userId = result.id;

  await sb.from('hub_accounts').upsert(
    {
      user_id: userId,
      role: USER_ROLES.ADMIN,
      hub_view: 'organiser',
      display_name: name || 'Platform Admin',
    },
    { onConflict: 'user_id' }
  );

  return { id: userId, email: em, role: USER_ROLES.ADMIN, name: name || '' };
}

async function countOrganiserProfiles(userId, email) {
  const sb = getSupabaseAdmin();
  const em = String(email || '').toLowerCase();
  const { count, error } = await sb
    .from('organisers')
    .select('id', { count: 'exact', head: true })
    .or(`supabase_user_id.eq.${userId},email.eq.${em}`);
  if (error) return 0;
  return count || 0;
}

function useSupabaseAuth() {
  return isSupabaseConfigured() && process.env.DATA_PROVIDER !== 'airtable';
}

/**
 * Import spreadsheet users as attendees only — no Auth user, no emails.
 */
async function importAttendeeRow({ email, name }) {
  const sb = getSupabaseAdmin();
  const em = String(email || '')
    .trim()
    .toLowerCase();
  if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    throw new Error('Invalid email');
  }
  const { data, error } = await sb
    .from('attendees')
    .upsert(
      { email: em, name: String(name || '').trim() || null },
      { onConflict: 'email' }
    )
    .select('id, email')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Optional: create login without sending mail (same as migrate.js).
 * Set IMPORT_DEFAULT_PASSWORD in env for a shared temp password.
 */
async function importAuthUserSilent({ email, name, role }) {
  const password = process.env.IMPORT_DEFAULT_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error('Set IMPORT_DEFAULT_PASSWORD (min 8 chars) to create logins from imports');
  }
  const em = email.trim().toLowerCase();
  const { id: userId } = await createUserSilent({
    email: em,
    password,
    name,
    metadata: { imported: true, role: role || 'attendee' },
  });
  const sb = getSupabaseAdmin();
  await sb.from('hub_accounts').upsert(
    {
      user_id: userId,
      role: 'client',
      hub_view: role === 'organiser' ? 'organiser' : 'attendee',
      display_name: name || null,
    },
    { onConflict: 'user_id' }
  );
  await sb.from('attendees').upsert(
    { email: em, name: name || null, supabase_user_id: userId },
    { onConflict: 'email' }
  );
  return { userId, email: em };
}

module.exports = {
  USER_ROLES,
  normalizeRole,
  authEmailsEnabled,
  useSupabaseAuth,
  findUserByEmail,
  verifyLogin,
  createUserSilent,
  registerUser,
  ensureAdminUser,
  countOrganiserProfiles,
  importAttendeeRow,
  importAuthUserSilent,
};
