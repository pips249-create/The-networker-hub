/**
 * Turn off optional mail for an address.
 * Hub accounts get emails_enabled and the optional preference flags cleared.
 * Addresses with no account are recorded in email_suppressions so later sends stop.
 */
const { getSupabaseAdmin } = require('./supabase');

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim().toLowerCase());
}

function isMissingTable(error) {
  const msg = String(error?.message || error || '');
  return /email_suppressions/i.test(msg) || /does not exist|schema cache|could not find the table/i.test(msg);
}

async function isEmailSuppressed(email) {
  const em = String(email || '').trim().toLowerCase();
  if (!isEmail(em)) return false;
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('email_suppressions')
      .select('email')
      .eq('email', em)
      .maybeSingle();
    if (error) {
      if (isMissingTable(error)) return false;
      return false;
    }
    return Boolean(data && data.email);
  } catch {
    return false;
  }
}

async function clearSuppression(email) {
  const em = String(email || '').trim().toLowerCase();
  if (!isEmail(em)) return false;
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('email_suppressions').delete().eq('email', em);
  if (error) {
    if (isMissingTable(error)) return false;
    throw new Error(error.message);
  }
  return true;
}

async function setEmailSuppressed(email, suppressed) {
  try {
    if (suppressed) return await recordSuppression(email);
    return await clearSuppression(email);
  } catch (err) {
    if (isMissingTable(err)) return false;
    throw err;
  }
}

async function recordSuppression(email) {
  const em = String(email || '').trim().toLowerCase();
  if (!isEmail(em)) return false;
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('email_suppressions').upsert(
    {
      email: em,
      unsubscribed_at: new Date().toISOString(),
      source: 'unsubscribe',
    },
    { onConflict: 'email' }
  );
  if (error) {
    if (isMissingTable(error)) return false;
    throw new Error(error.message);
  }
  return true;
}

async function clearHubOptionalEmail(userId, role) {
  const uid = String(userId || '').trim();
  if (!uid) return false;
  const sb = getSupabaseAdmin();
  const patch = {
    user_id: uid,
    emails_enabled: false,
    email_pref_event_reminders: false,
    email_pref_organiser_alerts: false,
    email_pref_organiser_roundups: false,
  };
  if (role === 'admin') patch.role = 'admin';

  let result = await sb.from('hub_accounts').upsert(patch, { onConflict: 'user_id' });
  if (result.error && /email_pref_/i.test(String(result.error.message || ''))) {
    const fallback = {
      user_id: uid,
      emails_enabled: false,
    };
    if (role === 'admin') fallback.role = 'admin';
    result = await sb.from('hub_accounts').upsert(fallback, { onConflict: 'user_id' });
  }
  if (result.error && /emails_enabled/i.test(String(result.error.message || ''))) {
    return false;
  }
  if (result.error) throw new Error(result.error.message);
  return true;
}

/**
 * Stop optional emails for this address.
 * Always resolves for a valid address so the public page can confirm without
 * revealing whether an account exists.
 */
async function applyEmailUnsubscribe(email) {
  const em = String(email || '').trim().toLowerCase();
  if (!isEmail(em)) {
    const err = new Error('Enter a valid email address.');
    err.status = 400;
    err.code = 'invalid_email';
    throw err;
  }

  const sbAuth = require('./supabase-auth');
  const user = await sbAuth.findUserByEmail(em);
  let hubUpdated = false;
  if (user && user.id) {
    hubUpdated = await clearHubOptionalEmail(user.id, user.role);
  }
  const suppressed = await recordSuppression(em);
  return {
    email: em,
    updated: hubUpdated || suppressed || !user,
  };
}

module.exports = {
  isEmail,
  isEmailSuppressed,
  setEmailSuppressed,
  applyEmailUnsubscribe,
};
