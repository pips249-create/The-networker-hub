/**
 * Browse / city-page signup for weekly networking picks (Friday).
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { findUserByEmail, setEmailsEnabled } = require('./supabase-auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeSignupEmail(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase();
}

function isValidSignupEmail(email) {
  return email.length >= 5 && email.length <= 254 && EMAIL_RE.test(email);
}

async function enableMarketingIfHubUser(email) {
  try {
    const user = await findUserByEmail(email);
    if (!user || !user.id) return false;
    await setEmailsEnabled(user.id, true);
    return true;
  } catch {
    return false;
  }
}

/**
 * @returns {Promise<{ ok: true, alreadyRegistered: boolean, email: string, hubUserUpdated: boolean }>}
 */
async function addWeeklyPicksSignup(input) {
  if (!isSupabaseConfigured()) {
    const err = new Error('Supabase is not configured.');
    err.code = 'not_configured';
    throw err;
  }

  const email = normalizeSignupEmail(input && input.email);
  if (!isValidSignupEmail(email)) {
    const err = new Error('Enter a valid email address.');
    err.code = 'invalid_email';
    throw err;
  }

  const location = String((input && input.location) || '')
    .trim()
    .slice(0, 120);
  const regionSlug = String((input && input.regionSlug) || (input && input.region_slug) || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 64);
  const source = String((input && input.source) || 'browse_rail')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 40) || 'browse_rail';

  const sb = getSupabaseAdmin();
  const row = {
    email,
    location,
    region_slug: regionSlug,
    source,
  };

  const insertRes = await sb
    .from('weekly_picks_signups')
    .insert(row)
    .select('id, email, created_at')
    .single();

  let alreadyRegistered = false;
  if (insertRes.error) {
    if (insertRes.error.code === '23505') {
      alreadyRegistered = true;
      const patch = { source };
      if (location) patch.location = location;
      if (regionSlug) patch.region_slug = regionSlug;
      await sb.from('weekly_picks_signups').update(patch).eq('email', email);
    } else {
      const err = new Error(insertRes.error.message || 'Could not save your email.');
      err.code = 'save_failed';
      throw err;
    }
  }

  const hubUserUpdated = await enableMarketingIfHubUser(email);

  return {
    ok: true,
    alreadyRegistered,
    email,
    hubUserUpdated,
  };
}

module.exports = {
  normalizeSignupEmail,
  isValidSignupEmail,
  addWeeklyPicksSignup,
};
