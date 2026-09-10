/**
 * Partner programme helpers — codes, attribution, Stripe metadata.
 * Rules: docs/PARTNER-PROGRAMME.md
 */
const { getSupabaseAdmin } = require('./supabase');

const AFFILIATE_COOKIE_NAME = 'tnu_aff_ref';
const AFFILIATE_COOKIE_DAYS = 30;
const AFFILIATE_COMMISSION_RATE = 0.2;
const AFFILIATE_HOLD_DAYS = 14;

function normalizeAffiliateCode(raw) {
  const code = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
  if (code.length < 2 || code.length > 32) return '';
  if (!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(code)) return '';
  return code;
}

function affiliateCodeFromBody(body) {
  body = body || {};
  return normalizeAffiliateCode(
    body.affiliateCode || body.affiliate_code || body.ref || body.referredBy || body.referred_by || ''
  );
}

function withAffiliateMetadata(metadata, code) {
  const normalized = normalizeAffiliateCode(code);
  if (!normalized) return metadata || {};
  return Object.assign({}, metadata || {}, { affiliate_code: normalized });
}

async function getActivePartnerByCode(code) {
  const normalized = normalizeAffiliateCode(code);
  if (!normalized) return null;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('affiliate_partners')
    .select('id, code, display_name, email, active')
    .eq('code', normalized)
    .eq('active', true)
    .maybeSingle();
  if (error) {
    if (/affiliate_partners/i.test(error.message || '')) return null;
    throw new Error(error.message || 'affiliate_partner_lookup_failed');
  }
  return data || null;
}

async function recordAffiliateAttribution(opts) {
  opts = opts || {};
  const partner = opts.partner || (await getActivePartnerByCode(opts.code));
  if (!partner) return null;

  const sb = getSupabaseAdmin();
  const payload = {
    partner_id: partner.id,
    code: partner.code,
    source: String(opts.source || 'cookie').trim() || 'cookie',
    customer_email: opts.email ? String(opts.email).trim().toLowerCase() : null,
    context: opts.context ? String(opts.context).trim().slice(0, 120) : null,
    metadata: opts.metadata && typeof opts.metadata === 'object' ? opts.metadata : {},
  };

  const { data, error } = await sb.from('affiliate_attributions').insert(payload).select('id').maybeSingle();
  if (error) {
    if (/affiliate_attributions/i.test(error.message || '')) return null;
    console.error('[affiliate-attribution]', error.message || error);
    return null;
  }
  return data;
}

function mapPartnerRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    displayName: row.display_name,
    email: row.email,
    active: row.active !== false,
    notes: row.notes || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    linkAdvertising: 'https://www.thenetworkeruk.com/advertising?ref=' + encodeURIComponent(row.code),
    linkOpportunityList:
      'https://www.thenetworkeruk.com/opportunities/list?ref=' + encodeURIComponent(row.code),
    linkMediaKit: 'https://www.thenetworkeruk.com/partners/kit?ref=' + encodeURIComponent(row.code),
  };
}

module.exports = {
  AFFILIATE_COOKIE_NAME,
  AFFILIATE_COOKIE_DAYS,
  AFFILIATE_COMMISSION_RATE,
  AFFILIATE_HOLD_DAYS,
  normalizeAffiliateCode,
  affiliateCodeFromBody,
  withAffiliateMetadata,
  getActivePartnerByCode,
  recordAffiliateAttribution,
  mapPartnerRow,
};
