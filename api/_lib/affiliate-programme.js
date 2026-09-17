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

async function recordAffiliateClick(opts) {
  opts = opts || {};
  const code = normalizeAffiliateCode(opts.code);
  if (!code) return { ok: false, reason: 'invalid_code' };

  const partner = await getActivePartnerByCode(code);
  if (!partner) return { ok: false, reason: 'unknown_partner' };

  let path = String(opts.path || '').trim().slice(0, 240);
  if (!path && opts.landingUrl) {
    try {
      path = new URL(String(opts.landingUrl)).pathname.slice(0, 240);
    } catch {
      path = '';
    }
  }
  const landingUrl = String(opts.landingUrl || opts.url || '')
    .trim()
    .slice(0, 500);

  const sb = getSupabaseAdmin();
  const { error } = await sb.from('affiliate_clicks').insert({
    partner_id: partner.id,
    code: partner.code,
    path: path || null,
    landing_url: landingUrl || null,
  });
  if (error) {
    if (/affiliate_clicks|Could not find the table|schema cache/i.test(error.message || '')) {
      return { ok: false, reason: 'table_missing' };
    }
    console.error('[affiliate-click]', error.message || error);
    return { ok: false, reason: 'insert_failed' };
  }
  return { ok: true, partnerId: partner.id, code: partner.code };
}

async function clickCountsByPartnerIds(partnerIds) {
  const ids = Array.isArray(partnerIds) ? partnerIds.filter(Boolean) : [];
  const empty = { total: {}, last7: {}, last30: {}, tableMissing: false };
  if (!ids.length) return empty;

  const sb = getSupabaseAdmin();
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const total = {};
  const last7 = {};
  const last30 = {};
  ids.forEach((id) => {
    total[id] = 0;
    last7[id] = 0;
    last30[id] = 0;
  });

  const { data, error } = await sb
    .from('affiliate_clicks')
    .select('partner_id, created_at')
    .in('partner_id', ids)
    .order('created_at', { ascending: false })
    .limit(100000);

  if (error) {
    if (/affiliate_clicks|Could not find the table|schema cache/i.test(error.message || '')) {
      return { total, last7, last30, tableMissing: true };
    }
    throw new Error(error.message || 'affiliate_clicks_load_failed');
  }

  (data || []).forEach((row) => {
    const id = row.partner_id;
    if (!id) return;
    total[id] = (total[id] || 0) + 1;
    const at = row.created_at || '';
    if (at >= since30) last30[id] = (last30[id] || 0) + 1;
    if (at >= since7) last7[id] = (last7[id] || 0) + 1;
  });

  return { total, last7, last30, tableMissing: false };
}

async function referralActivityForPartner(partnerId, opts) {
  opts = opts || {};
  const id = String(partnerId || '').trim();
  const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 100);
  if (!id) {
    return { clicks: [], attributions: [], clicksTableMissing: false, attributionsTableMissing: false };
  }

  const sb = getSupabaseAdmin();
  let clicks = [];
  let attributions = [];
  let clicksTableMissing = false;
  let attributionsTableMissing = false;

  const { data: clickRows, error: clickErr } = await sb
    .from('affiliate_clicks')
    .select('id, path, landing_url, created_at')
    .eq('partner_id', id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (clickErr) {
    if (/affiliate_clicks|Could not find the table|schema cache/i.test(clickErr.message || '')) {
      clicksTableMissing = true;
    } else {
      throw new Error(clickErr.message || 'affiliate_clicks_activity_failed');
    }
  } else {
    clicks = (clickRows || []).map(function (row) {
      return {
        id: row.id,
        path: row.path || null,
        landingUrl: row.landing_url || null,
        createdAt: row.created_at,
      };
    });
  }

  const { data: attrRows, error: attrErr } = await sb
    .from('affiliate_attributions')
    .select('id, customer_email, source, context, created_at')
    .eq('partner_id', id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (attrErr) {
    if (/affiliate_attributions|Could not find the table|schema cache/i.test(attrErr.message || '')) {
      attributionsTableMissing = true;
    } else {
      throw new Error(attrErr.message || 'affiliate_attributions_activity_failed');
    }
  } else {
    attributions = (attrRows || []).map(function (row) {
      return {
        id: row.id,
        customerEmail: row.customer_email || null,
        source: row.source || null,
        context: row.context || null,
        createdAt: row.created_at,
      };
    });
  }

  return { clicks, attributions, clicksTableMissing, attributionsTableMissing };
}

function mapPartnerRow(row, clickStats) {
  if (!row) return null;
  const stats = clickStats || {};
  const id = row.id;
  return {
    id: row.id,
    code: row.code,
    displayName: row.display_name,
    email: row.email,
    active: row.active !== false,
    notes: row.notes || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    clicksTotal: Number(stats.total && stats.total[id]) || 0,
    clicks7d: Number(stats.last7 && stats.last7[id]) || 0,
    clicks30d: Number(stats.last30 && stats.last30[id]) || 0,
    linkHome: 'https://www.thenetworkeruk.com/?ref=' + encodeURIComponent(row.code),
    linkAdvertising: 'https://www.thenetworkeruk.com/advertising?ref=' + encodeURIComponent(row.code),
    linkOpportunityList:
      'https://www.thenetworkeruk.com/opportunities/list?ref=' + encodeURIComponent(row.code),
    linkMediaKit:
      'https://www.thenetworkeruk.com/partners/earnings?ref=' + encodeURIComponent(row.code),
    linkPartnerHub:
      'https://www.thenetworkeruk.com/partners/earnings?ref=' + encodeURIComponent(row.code),
    termsAcceptedAt: row.terms_accepted_at || null,
    termsVersion: row.terms_version || null,
    termsAccepted: require('./partner-terms').partnerTermsAccepted(row),
    applicationTermsAgreedAt: row.application_terms_agreed_at || null,
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
  recordAffiliateClick,
  clickCountsByPartnerIds,
  referralActivityForPartner,
  mapPartnerRow,
};
