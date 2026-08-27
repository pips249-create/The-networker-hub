/**
 * Auth via Supabase (hub_accounts + auth.users). No Airtable.
 */
const { getSupabaseAdmin, getSupabaseAnon, isSupabaseConfigured } = require('./supabase');

const USER_ROLES = { ADMIN: 'admin', CLIENT: 'client' };
const CURRENT_ORGANISER_TERMS_VERSION = 'v2';

/** Auth emails (password reset). Explicit false stays off; otherwise on when Resend is configured. */
function authEmailsEnabled() {
  const v = String(process.env.AUTH_SEND_EMAILS || '')
    .trim()
    .toLowerCase();
  if (v === '0' || v === 'false' || v === 'no') return false;
  if (v === '1' || v === 'true' || v === 'yes') return true;
  return Boolean(String(process.env.RESEND_API_KEY || '').trim());
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

function organiserTermsAcceptedFromHub(hub, version = CURRENT_ORGANISER_TERMS_VERSION) {
  if (!hub?.organiser_terms_accepted_at) return false;
  const acceptedVersion = String(hub.organiser_terms_version || '').trim();
  return !acceptedVersion || acceptedVersion === version;
}

function isOrganiserEmailVerified(hub) {
  return Boolean(hub?.organiser_email_verified_at);
}

function hasOrganiserAccessFromHub(hub) {
  return Boolean(hub?.organiser_access_at);
}

async function hasOrganiserAccess(userId, email) {
  const hub = await getHubAccount(userId);
  if (hasOrganiserAccessFromHub(hub)) return true;
  const profiles = await countOrganiserProfiles(userId, email);
  return profiles > 0;
}

function isOrganiserUiHidden(hub) {
  return Boolean(hub?.organiser_ui_hidden_at);
}

async function enableOrganiserAccess(userId) {
  const sb = getSupabaseAdmin();
  const uid = String(userId || '').trim();
  if (!uid) throw new Error('missing_user');

  const hub = await getHubAccount(uid);
  const now = new Date().toISOString();
  const patch = {
    user_id: uid,
    organiser_access_at: hub?.organiser_access_at || now,
    organiser_ui_hidden_at: null,
    hub_view: 'organiser',
  };

  const { data, error } = await sb
    .from('hub_accounts')
    .upsert(patch, { onConflict: 'user_id' })
    .select(
      'user_id, organiser_access_at, organiser_email_verified_at, organiser_ui_hidden_at, hub_view'
    )
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function countPendingClaimsForUser(session) {
  try {
    const { listPendingClaimGroupsForSession } = require('./supabase-organiser-claims');
    const rows = await listPendingClaimGroupsForSession(session);
    return rows.length;
  } catch {
    return 0;
  }
}

async function hideOrganiserWorkspace(userId, email) {
  const sb = getSupabaseAdmin();
  const uid = String(userId || '').trim();
  const em = String(email || '').trim().toLowerCase();
  if (!uid) throw new Error('missing_user');

  const profiles = await countOrganiserProfiles(uid, em);
  const pendingClaims = await countPendingClaimsForUser({ sub: uid, email: em });
  if (profiles > 0 || pendingClaims > 0) {
    const err = new Error('organiser_page_linked');
    err.status = 400;
    err.message =
      'You have an organiser page or pending claim on this account. Manage it from the organiser workspace, or contact hi@thenetworkeruk.com for help.';
    throw err;
  }

  const hub = await getHubAccount(uid);
  if (!hub?.organiser_access_at) {
    const err = new Error('organiser_access_not_enabled');
    err.status = 400;
    throw err;
  }

  const now = new Date().toISOString();
  const { data, error } = await sb
    .from('hub_accounts')
    .update({
      organiser_ui_hidden_at: now,
      hub_view: 'attendee',
    })
    .eq('user_id', uid)
    .select('user_id, organiser_ui_hidden_at, hub_view')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('hub_account_not_found');
  return data;
}

async function showOrganiserWorkspace(userId) {
  const sb = getSupabaseAdmin();
  const uid = String(userId || '').trim();
  if (!uid) throw new Error('missing_user');

  const { data, error } = await sb
    .from('hub_accounts')
    .update({
      organiser_ui_hidden_at: null,
      hub_view: 'organiser',
    })
    .eq('user_id', uid)
    .select('user_id, organiser_access_at, organiser_ui_hidden_at, hub_view')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('hub_account_not_found');
  return data;
}

async function hasOrganiserTermsAccepted(userId, version = CURRENT_ORGANISER_TERMS_VERSION) {
  const hub = await getHubAccount(userId);
  return organiserTermsAcceptedFromHub(hub, version);
}

async function acceptOrganiserTerms(userId, version = CURRENT_ORGANISER_TERMS_VERSION) {
  const sb = getSupabaseAdmin();
  const uid = String(userId || '').trim();
  if (!uid) throw new Error('missing_user');

  const { data, error } = await sb
    .from('hub_accounts')
    .update({
      organiser_terms_accepted_at: new Date().toISOString(),
      organiser_terms_version: version,
    })
    .eq('user_id', uid)
    .select('user_id, organiser_terms_accepted_at, organiser_terms_version')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('hub_account_not_found');
  return data;
}

function hubPrefEnabled(hub, column) {
  if (!hub) return true;
  if (hub.emails_enabled === false) return false;
  if (column && hub[column] === false) return false;
  return true;
}

async function getHubAccountForEmail(email) {
  const em = String(email || '').trim().toLowerCase();
  if (!em) return null;
  const user = await findUserByEmail(em);
  if (!user) return null;
  return getHubAccount(user.id);
}

async function getEmailsEnabledForEmail(email) {
  const hub = await getHubAccountForEmail(email);
  if (!hub) return true;
  return hub.emails_enabled !== false;
}

/** @param {'event_reminders'|'organiser_alerts'|'marketing'|'organiser_roundups'} category */
async function canSendEmailCategory(email, category) {
  const hub = await getHubAccountForEmail(email);
  if (!hub) return true;
  if (category === 'event_reminders') {
    return hubPrefEnabled(hub, 'email_pref_event_reminders');
  }
  if (category === 'organiser_alerts') {
    return hubPrefEnabled(hub, 'email_pref_organiser_alerts');
  }
  if (category === 'organiser_roundups') {
    // Independent of Marketing emails. Pre-migration DBs fall back to marketing opt-in.
    if (!Object.prototype.hasOwnProperty.call(hub, 'email_pref_organiser_roundups')) {
      return hub.emails_enabled === true;
    }
    return hub.email_pref_organiser_roundups !== false;
  }
  if (category === 'marketing') {
    return hub.emails_enabled === true;
  }
  return hub.emails_enabled !== false;
}

async function setEmailsEnabled(userId, enabled) {
  const sb = getSupabaseAdmin();
  const uid = String(userId || '').trim();
  if (!uid) {
    const err = new Error('missing_user');
    err.status = 400;
    throw err;
  }

  const { data, error } = await sb
    .from('hub_accounts')
    .update({ emails_enabled: Boolean(enabled) })
    .eq('user_id', uid)
    .select('user_id, emails_enabled')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    const err = new Error('hub_account_not_found');
    err.status = 404;
    throw err;
  }
  return data;
}

async function authUserRecordToAppUser(authUser, em) {
  if (!authUser) return null;
  const hub = await getHubAccount(authUser.id);
  const sb = getSupabaseAdmin();
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
    lastSignInAt: authUser.last_sign_in_at || null,
  };
}

async function findUserByEmail(email) {
  const em = String(email || '').trim().toLowerCase();
  if (!em) return null;

  const sb = getSupabaseAdmin();

  if (typeof sb.auth.admin.getUserByEmail === 'function') {
    try {
      const { data, error } = await sb.auth.admin.getUserByEmail(em);
      if (!error && data?.user) {
        return authUserRecordToAppUser(data.user, em);
      }
    } catch {
      /* fall through to listUsers */
    }
  }

  let page = 1;
  const perPage = 1000;
  while (page <= 20) {
    const { data: list, error } = await sb.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const authUser = (list.users || []).find((u) => u.email?.toLowerCase() === em);
    if (authUser) return authUserRecordToAppUser(authUser, em);
    if (!list.users?.length || list.users.length < perPage) break;
    page += 1;
  }

  return null;
}

async function upsertHubAccount(patch) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('hub_accounts').upsert(patch, { onConflict: 'user_id' });
  if (error && /emails_enabled/i.test(error.message || '')) {
    const fallback = { ...patch };
    delete fallback.emails_enabled;
    const retry = await sb.from('hub_accounts').upsert(fallback, { onConflict: 'user_id' });
    if (retry.error) throw new Error(retry.error.message);
    return;
  }
  if (error) throw new Error(error.message);
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

async function registerUser({ email, password, name, marketingOptIn }) {
  const sb = getSupabaseAdmin();
  const em = email.trim().toLowerCase();
  const optedInToMarketing = Boolean(marketingOptIn);

  // Silent imports create Auth users with unknown passwords and never sign in.
  // Allow those people to set a password via /register (organiser claim wave).
  // Anyone who has already signed in must use Sign in / Forgot password.
  const existing = await findUserByEmail(em);
  if (existing && existing.lastSignInAt) {
    throw new Error('An account with this email already exists. Sign in instead.');
  }

  const { id: userId } = await createUserSilent({
    email: em,
    password,
    name,
    metadata: { full_name: name || '' },
  });

  const existingHub = existing ? await getHubAccount(existing.id) : null;
  const accountPayload = {
    user_id: userId,
    // Preserve admin if this email was already promoted (e.g. silent import reclaim)
    role: existingHub?.role === USER_ROLES.ADMIN ? USER_ROLES.ADMIN : USER_ROLES.CLIENT,
    hub_view: existingHub?.role === USER_ROLES.ADMIN ? existingHub.hub_view || 'organiser' : 'attendee',
    display_name: name || null,
    emails_enabled: optedInToMarketing,
    email_pref_event_reminders: true,
    email_pref_organiser_alerts: true,
    email_pref_organiser_roundups: true,
  };
  let accountResult = await sb.from('hub_accounts').upsert(accountPayload, { onConflict: 'user_id' });
  if (
    accountResult.error &&
    /email_pref_organiser_roundups/i.test(String(accountResult.error.message || ''))
  ) {
    delete accountPayload.email_pref_organiser_roundups;
    accountResult = await sb.from('hub_accounts').upsert(accountPayload, { onConflict: 'user_id' });
  }
  if (accountResult.error) throw new Error(accountResult.error.message);

  const attendeeUpsert = await sb.from('attendees').upsert(
    {
      email: em,
      name: name || null,
      supabase_user_id: userId,
    },
    { onConflict: 'email' }
  );
  if (attendeeUpsert.error) throw new Error(attendeeUpsert.error.message);

  const attendeeRes = await sb.from('attendees').select('id').eq('email', em).maybeSingle();
  if (attendeeRes.error) throw new Error(attendeeRes.error.message);
  if (attendeeRes.data?.id) {
    const { claimRosterEntriesForAttendee } = require('./organiser-member-roster');
    try {
      await claimRosterEntriesForAttendee(sb, {
        email: em,
        attendeeId: attendeeRes.data.id,
      });
    } catch (claimError) {
      console.error('[auth] roster claim after registration failed', claimError);
    }
  }

  return {
    id: userId,
    email: em,
    role: accountPayload.role,
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
      organiser_access_at: new Date().toISOString(),
      organiser_email_verified_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  return { id: userId, email: em, role: USER_ROLES.ADMIN, name: name || '' };
}

/**
 * Grant Command Centre admin to an existing auth user (no password reset).
 * Creates hub_account if missing. Does not create auth user when absent.
 */
async function promoteUserToAdmin({ email, name }) {
  const sb = getSupabaseAdmin();
  const em = email.trim().toLowerCase();
  if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    throw new Error('invalid_email');
  }

  const existing = await findUserByEmail(em);
  if (!existing) {
    const err = new Error('user_not_found');
    err.status = 404;
    err.message = `No login found for ${em}. Ask them to register first, then run grant again.`;
    throw err;
  }

  const now = new Date().toISOString();
  const displayName = String(name || existing.name || '').trim() || null;

  const { data, error } = await sb
    .from('hub_accounts')
    .upsert(
      {
        user_id: existing.id,
        role: USER_ROLES.ADMIN,
        hub_view: 'organiser',
        display_name: displayName,
        organiser_access_at: now,
        organiser_email_verified_at: now,
        organiser_ui_hidden_at: null,
      },
      { onConflict: 'user_id' }
    )
    .select('user_id, role, display_name')
    .single();
  if (error) throw new Error(error.message);

  return {
    id: existing.id,
    email: em,
    role: USER_ROLES.ADMIN,
    name: data.display_name || displayName || existing.name || '',
    promoted: true,
  };
}

async function countOrganiserProfiles(userId, email) {
  const sb = getSupabaseAdmin();
  const em = String(email || '').toLowerCase();
  const { count, error } = await sb
    .from('organisers')
    .select('id', { count: 'exact', head: true })
    .or(`supabase_user_id.eq.${userId},email.eq.${em},contact_email.eq.${em}`);
  if (error) return 0;
  return count || 0;
}

/** Link imported attendee rows to the auth user on sign-in (mirrors organiser backfill). */
async function backfillAttendeeUserId(userId, email) {
  const sb = getSupabaseAdmin();
  const em = String(email || '').toLowerCase();
  const uid = String(userId || '').trim();
  if (!uid || !em) return;

  const { data, error } = await sb
    .from('attendees')
    .select('id, supabase_user_id')
    .eq('email', em)
    .maybeSingle();
  if (error || !data || data.supabase_user_id) return;

  try {
    await sb.from('attendees').update({ supabase_user_id: uid }).eq('id', data.id);
  } catch {
    /* non-fatal */
  }
}

function useSupabaseAuth() {
  return isSupabaseConfigured();
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
/**
 * Create a site login for an organiser group profile (no emails sent).
 * Links auth user, hub account (emails off), attendee row, and organiser profile.
 */
async function provisionOrganiserLogin(organiserId) {
  const sb = getSupabaseAdmin();
  const oid = String(organiserId || '').trim();
  if (!oid) {
    const err = new Error('missing_organiser_id');
    err.status = 400;
    throw err;
  }

  const { data: organiser, error: orgErr } = await sb
    .from('organisers')
    .select('*')
    .eq('id', oid)
    .maybeSingle();
  if (orgErr) throw new Error(orgErr.message);
  if (!organiser) {
    const err = new Error('organiser_not_found');
    err.status = 404;
    throw err;
  }

  const em = String(organiser.contact_email || organiser.email || '')
    .trim()
    .toLowerCase();
  if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    const err = new Error('organiser_missing_email');
    err.status = 400;
    throw err;
  }

  const name = String(organiser.name || '').trim();
  let userId = organiser.supabase_user_id || null;
  let createdAuth = false;

  if (!userId) {
    const existing = await findUserByEmail(em);
    if (existing) {
      userId = existing.id;
    } else {
      const created = await createUserSilent({
        email: em,
        name,
        metadata: { full_name: name, provisioned_organiser_id: oid },
      });
      userId = created.id;
      createdAuth = !created.existed;
    }
  }

  const existingHub = createdAuth ? null : await getHubAccount(userId);
  const hubPatch = {
    user_id: userId,
    // Never demote an existing platform admin when linking organiser pages
    role: existingHub?.role === USER_ROLES.ADMIN ? USER_ROLES.ADMIN : USER_ROLES.CLIENT,
    hub_view: 'organiser',
    display_name: name || null,
  };
  const now = new Date().toISOString();
  if (createdAuth) {
    hubPatch.emails_enabled = false;
    hubPatch.organiser_access_at = now;
    hubPatch.organiser_email_verified_at = now;
  } else {
    if (!existingHub) hubPatch.emails_enabled = false;
    if (!existingHub?.organiser_access_at) hubPatch.organiser_access_at = now;
    if (!existingHub?.organiser_email_verified_at) hubPatch.organiser_email_verified_at = now;
  }

  await upsertHubAccount(hubPatch);

  await sb.from('attendees').upsert(
    { email: em, name: name || null, supabase_user_id: userId },
    { onConflict: 'email' }
  );

  const claimStatus = String(organiser.ownership_claim_status || '').toLowerCase();
  const organiserPatch = {
    supabase_user_id: userId,
  };
  // Provisioning a login must not mark the page claimed, and must not demote
  // an organiser who already completed the claim flow.
  if (claimStatus !== 'claimed' && claimStatus !== 'disputed') {
    organiserPatch.ownership_claim_status = 'pending';
    organiserPatch.ownership_claimed_at = null;
  }
  if (!organiser.organiser_account_id) {
    let account = null;
    const { data: byUser } = await sb
      .from('organiser_accounts')
      .select('*')
      .eq('supabase_user_id', userId)
      .maybeSingle();
    account = byUser;
    if (!account) {
      const { data: byEmail } = await sb.from('organiser_accounts').select('*').eq('email', em).maybeSingle();
      account = byEmail;
    }
    if (!account) {
      const { data: createdAccount, error: accErr } = await sb
        .from('organiser_accounts')
        .insert({ email: em, supabase_user_id: userId })
        .select('*')
        .single();
      if (accErr) throw new Error(accErr.message);
      account = createdAccount;
    } else if (!account.supabase_user_id) {
      await sb.from('organiser_accounts').update({ supabase_user_id: userId }).eq('id', account.id);
    }
    organiserPatch.organiser_account_id = account.id;
  }

  const { error: linkErr } = await sb.from('organisers').update(organiserPatch).eq('id', oid);
  if (linkErr) throw new Error(linkErr.message);

  const hub = await getHubAccount(userId);

  return {
    userId,
    email: em,
    name,
    organiserId: oid,
    createdAuth,
    emailsEnabled: hub?.emails_enabled !== false,
  };
}

async function findOrganiserIdsByEmail(email) {
  const em = String(email || '').trim().toLowerCase();
  if (!em) return [];

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('organisers')
    .select('id')
    .or(`email.eq.${em},contact_email.eq.${em}`)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((r) => r.id);
}

/** Create/link a login from a group profile email (no mail sent). */
async function provisionOrganiserLoginByEmail(email) {
  const ids = await findOrganiserIdsByEmail(email);
  if (!ids.length) return null;

  const result = await provisionOrganiserLogin(ids[0]);
  if (ids.length > 1) {
    const sb = getSupabaseAdmin();
    await sb
      .from('organisers')
      .update({ supabase_user_id: result.userId })
      .in('id', ids.slice(1));
  }
  return result;
}

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
  const existingHub = await getHubAccount(userId).catch(() => null);
  await sb.from('hub_accounts').upsert(
    {
      user_id: userId,
      role: existingHub?.role === USER_ROLES.ADMIN ? USER_ROLES.ADMIN : 'client',
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
  CURRENT_ORGANISER_TERMS_VERSION,
  findUserByEmail,
  getHubAccount,
  hasOrganiserTermsAccepted,
  isOrganiserEmailVerified,
  hasOrganiserAccessFromHub,
  isOrganiserUiHidden,
  hasOrganiserAccess,
  enableOrganiserAccess,
  hideOrganiserWorkspace,
  showOrganiserWorkspace,
  acceptOrganiserTerms,
  getEmailsEnabledForEmail,
  getHubAccountForEmail,
  hubPrefEnabled,
  canSendEmailCategory,
  setEmailsEnabled,
  verifyLogin,
  createUserSilent,
  registerUser,
  ensureAdminUser,
  promoteUserToAdmin,
  provisionOrganiserLogin,
  provisionOrganiserLoginByEmail,
  findOrganiserIdsByEmail,
  countOrganiserProfiles,
  backfillAttendeeUserId,
  importAttendeeRow,
  importAuthUserSilent,
};
