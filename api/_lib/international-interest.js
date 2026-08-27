/**
 * International country interest — waitlist for expansion markets.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_INTENTS = new Set(['attend', 'list']);

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

function normalizeCountryCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .slice(0, 2);
}

function normalizeIntent(raw) {
  const intent = String(raw || '').trim().toLowerCase();
  return VALID_INTENTS.has(intent) ? intent : '';
}

async function submitInternationalInterest(payload) {
  if (!isSupabaseConfigured()) {
    const err = new Error('Interest capture is not configured yet — email hi@thenetworkeruk.com.');
    err.code = 'not_configured';
    throw err;
  }

  const email = normalizeEmail(payload?.email);
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return { ok: false, error: 'invalid_email', message: 'Enter a valid email address.' };
  }

  const countryCode = normalizeCountryCode(payload?.countryCode);
  if (!countryCode || countryCode.length !== 2) {
    return { ok: false, error: 'invalid_country', message: 'Choose a country.' };
  }

  const countryName = String(payload?.countryName || '').trim().slice(0, 120);
  if (!countryName) {
    return { ok: false, error: 'invalid_country', message: 'Choose a country.' };
  }

  const intent = normalizeIntent(payload?.intent);
  if (!intent) {
    return { ok: false, error: 'invalid_intent', message: 'Choose whether you want to attend or list.' };
  }

  const allowedSources = new Set([
    'international_map',
    'market_preview_ie',
    'market_preview_us',
  ]);
  const sourceRaw = String(payload?.source || '')
    .trim()
    .toLowerCase()
    .slice(0, 64);
  const source = allowedSources.has(sourceRaw) ? sourceRaw : 'international_map';

  const sb = getSupabaseAdmin();
  const insertRes = await sb
    .from('international_country_interest')
    .insert({
      email,
      country_code: countryCode,
      country_name: countryName,
      intent,
      source,
    })
    .select('id, email, country_code, intent, created_at')
    .single();

  if (insertRes.error) {
    if (insertRes.error.code === '23505') {
      return {
        ok: true,
        alreadyRegistered: true,
        email,
        countryCode,
        intent,
      };
    }
    const err = new Error(insertRes.error.message || 'Could not save your interest.');
    err.code = 'save_failed';
    throw err;
  }

  return {
    ok: true,
    alreadyRegistered: false,
    email: insertRes.data.email,
    countryCode: insertRes.data.country_code,
    intent: insertRes.data.intent,
    createdAt: insertRes.data.created_at,
  };
}

module.exports = {
  submitInternationalInterest,
};
