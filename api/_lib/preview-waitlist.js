const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeWaitlistEmail(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase();
}

function isValidWaitlistEmail(email) {
  return email.length >= 5 && email.length <= 254 && EMAIL_RE.test(email);
}

async function addPreviewWaitlistEmail(email, options) {
  if (!isSupabaseConfigured()) {
    const err = new Error('Supabase is not configured.');
    err.code = 'not_configured';
    throw err;
  }

  const normalized = normalizeWaitlistEmail(email);
  if (!isValidWaitlistEmail(normalized)) {
    const err = new Error('Enter a valid email address.');
    err.code = 'invalid_email';
    throw err;
  }

  const sb = getSupabaseAdmin();
  const row = {
    email: normalized,
    source: String(options?.source || 'site_access').trim() || 'site_access',
  };

  const insertRes = await sb.from('preview_waitlist').insert(row).select('id, email, created_at').single();

  if (insertRes.error) {
    if (insertRes.error.code === '23505') {
      return {
        ok: true,
        alreadyRegistered: true,
        email: normalized,
        createdAt: null,
      };
    }
    const err = new Error(insertRes.error.message || 'Could not save your email.');
    err.code = 'save_failed';
    throw err;
  }

  return {
    ok: true,
    alreadyRegistered: false,
    email: insertRes.data.email,
    createdAt: insertRes.data.created_at,
  };
}

module.exports = {
  normalizeWaitlistEmail,
  isValidWaitlistEmail,
  addPreviewWaitlistEmail,
};
