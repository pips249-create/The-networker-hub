/**
 * Referral Partner Programme — terms version + acceptance.
 */
const { getSupabaseAdmin } = require('./supabase');
const { normalizeAffiliateCode, getActivePartnerByCode } = require('./affiliate-programme');

/** Bump when terms page changes materially; partners may need to re-accept. */
const REFERRAL_PARTNER_TERMS_VERSION = '2026-09-17';

function termsPagePath() {
  return '/partners/terms';
}

function acceptPagePath(code) {
  const c = normalizeAffiliateCode(code);
  if (!c) return '/partners/accept-terms';
  return '/partners/accept-terms?ref=' + encodeURIComponent(c);
}

function partnerTermsAccepted(row) {
  if (!row || !row.terms_accepted_at) return false;
  const version = String(row.terms_version || '').trim();
  if (!version) return true;
  return version === REFERRAL_PARTNER_TERMS_VERSION;
}

async function getPartnerByCodeAnyStatus(code) {
  const normalized = normalizeAffiliateCode(code);
  if (!normalized) return null;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('affiliate_partners')
    .select(
      'id, code, display_name, email, active, terms_accepted_at, terms_version, application_terms_agreed_at'
    )
    .eq('code', normalized)
    .maybeSingle();
  if (error) {
    if (/affiliate_partners/i.test(error.message || '')) return null;
    throw new Error(error.message || 'affiliate_partner_lookup_failed');
  }
  return data || null;
}

async function publicTermsStatus(code) {
  const row = await getPartnerByCodeAnyStatus(code);
  if (!row) {
    return { ok: false, error: 'unknown_code' };
  }
  return {
    ok: true,
    code: row.code,
    active: row.active !== false,
    termsAccepted: partnerTermsAccepted(row),
    termsVersion: REFERRAL_PARTNER_TERMS_VERSION,
    termsPage: termsPagePath(),
    acceptPage: acceptPagePath(row.code),
  };
}

async function acceptPartnerTerms(opts) {
  opts = opts || {};
  const code = normalizeAffiliateCode(opts.code);
  const email = String(opts.email || '')
    .trim()
    .toLowerCase();
  if (!code) {
    return { ok: false, error: 'invalid_code', message: 'Enter a valid partner code.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'invalid_email', message: 'Enter the email on your partner invite.' };
  }
  if (opts.agreed !== true && opts.agreed !== 'true' && opts.agreed !== 1) {
    return {
      ok: false,
      error: 'terms_required',
      message: 'Please read and accept the Referral Partner Terms.',
    };
  }

  const row = await getPartnerByCodeAnyStatus(code);
  if (!row) {
    return { ok: false, error: 'unknown_code', message: 'We could not find that partner code.' };
  }
  if (row.active === false) {
    return {
      ok: false,
      error: 'partner_inactive',
      message: 'This partner code is not active. Email partnerships@thenetworkeruk.com.',
    };
  }
  const partnerEmail = String(row.email || '')
    .trim()
    .toLowerCase();
  if (partnerEmail !== email) {
    return {
      ok: false,
      error: 'email_mismatch',
      message: 'That email does not match our records for this partner code.',
    };
  }

  const now = new Date().toISOString();
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('affiliate_partners')
    .update({
      terms_accepted_at: now,
      terms_version: REFERRAL_PARTNER_TERMS_VERSION,
      updated_at: now,
    })
    .eq('id', row.id)
    .select('id, code, terms_accepted_at, terms_version')
    .maybeSingle();

  if (error) {
    if (/terms_accepted_at|terms_version|schema cache/i.test(error.message || '')) {
      return {
        ok: false,
        error: 'terms_columns_missing',
        message: 'Terms tracking is not set up yet — run migration 296_affiliate_partner_terms.sql.',
      };
    }
    throw new Error(error.message || 'terms_accept_failed');
  }

  return {
    ok: true,
    code: data.code,
    termsAcceptedAt: data.terms_accepted_at,
    termsVersion: data.terms_version,
    hubUrl:
      'https://www.thenetworkeruk.com/partners/earnings?ref=' + encodeURIComponent(data.code),
  };
}

async function recordApplicationTermsAgreement(email) {
  const em = String(email || '')
    .trim()
    .toLowerCase();
  if (!em) return;
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await sb
    .from('affiliate_partners')
    .update({
      application_terms_agreed_at: now,
      updated_at: now,
    })
    .eq('email', em)
    .is('application_terms_agreed_at', null);
  if (error && !/application_terms_agreed_at|schema cache/i.test(error.message || '')) {
    console.warn('[partner-terms] application_terms_agreed_at', error.message || error);
  }
}

module.exports = {
  REFERRAL_PARTNER_TERMS_VERSION,
  termsPagePath,
  acceptPagePath,
  partnerTermsAccepted,
  publicTermsStatus,
  acceptPartnerTerms,
  recordApplicationTermsAgreement,
};
