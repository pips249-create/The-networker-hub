/**
 * Admin — invite-only partner programme partners + commissions.
 */
const { requireAdmin, json, setCors, sessionFromRequest } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const {
  normalizeAffiliateCode,
  mapPartnerRow,
  getActivePartnerByCode,
  recordAffiliateAttribution,
  clickCountsByPartnerIds,
  referralActivityForPartner,
} = require('../affiliate-programme');
const {
  createAffiliateCommission,
  promoteEligibleAffiliateCommissions,
  mapCommissionRow,
  isAffiliateEligibleProduct,
} = require('../affiliate-commissions');
const { sendPartnerInviteEmail } = require('../partner-invite-email');
const { REFERRAL_PARTNER_TERMS_VERSION } = require('../partner-terms');

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body || {};
}

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function poundsToPence(raw) {
  const n = Number(String(raw || '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

const AFFILIATE_PARTNER_BASE_SELECT =
  'id, code, display_name, email, active, notes, created_at, updated_at';
const AFFILIATE_PARTNER_TERMS_SELECT =
  ', terms_accepted_at, terms_version, application_terms_agreed_at';

function supabaseErrorMessage(error) {
  return String((error && error.message) || error || '');
}

function isMissingTableError(error, tableName) {
  const msg = supabaseErrorMessage(error).toLowerCase();
  const table = String(tableName || '').toLowerCase();
  if (!table || !msg.includes(table)) return false;
  return /could not find the table|relation .* does not exist|table .* not found/i.test(msg);
}

function isMissingTermsColumnsError(error) {
  const msg = supabaseErrorMessage(error).toLowerCase();
  return (
    /terms_accepted_at|terms_version|application_terms_agreed_at/i.test(msg) &&
    (/column/i.test(msg) || /schema cache/i.test(msg))
  );
}

function withNullTermsFields(row) {
  return Object.assign({}, row || {}, {
    terms_accepted_at: null,
    terms_version: null,
    application_terms_agreed_at: null,
  });
}

async function queryAffiliatePartnersList(sb) {
  const fullSelect = AFFILIATE_PARTNER_BASE_SELECT + AFFILIATE_PARTNER_TERMS_SELECT;
  let termsColumnsMissing = false;
  let { data, error } = await sb
    .from('affiliate_partners')
    .select(fullSelect)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error && isMissingTermsColumnsError(error)) {
    termsColumnsMissing = true;
    const retry = await sb
      .from('affiliate_partners')
      .select(AFFILIATE_PARTNER_BASE_SELECT)
      .order('created_at', { ascending: false })
      .limit(200);
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    if (isMissingTableError(error, 'affiliate_partners')) {
      const err = new Error('affiliate_partners_table_missing');
      err.code = 'affiliate_partners_table_missing';
      throw err;
    }
    throw new Error(supabaseErrorMessage(error));
  }

  const rows = (data || []).map(function (row) {
    return termsColumnsMissing ? withNullTermsFields(row) : row;
  });
  return { rows, termsColumnsMissing };
}

async function queryAffiliatePartnerSingle(sb, buildQuery) {
  const fullSelect = AFFILIATE_PARTNER_BASE_SELECT + AFFILIATE_PARTNER_TERMS_SELECT;
  let termsColumnsMissing = false;
  let { data, error } = await buildQuery(sb.from('affiliate_partners').select(fullSelect));

  if (error && isMissingTermsColumnsError(error)) {
    termsColumnsMissing = true;
    const retry = await buildQuery(sb.from('affiliate_partners').select(AFFILIATE_PARTNER_BASE_SELECT));
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    if (isMissingTableError(error, 'affiliate_partners')) {
      const err = new Error('affiliate_partners_table_missing');
      err.code = 'affiliate_partners_table_missing';
      throw err;
    }
    throw new Error(supabaseErrorMessage(error));
  }

  if (!data) return { row: null, termsColumnsMissing };
  return {
    row: termsColumnsMissing ? withNullTermsFields(data) : data,
    termsColumnsMissing,
  };
}

function partnerPersistenceErrorResponse(error) {
  if (isMissingTableError(error, 'affiliate_partners')) {
    return {
      status: 503,
      body: {
        ok: false,
        error: 'affiliate_partners_table_missing',
        message: 'Run migration 289_affiliate_partners.sql in Supabase.',
      },
    };
  }
  if (isMissingTermsColumnsError(error)) {
    return {
      status: 503,
      body: {
        ok: false,
        error: 'affiliate_partner_terms_columns_missing',
        message: 'Run migration 296_affiliate_partner_terms.sql in Supabase (289 is already OK).',
      },
    };
  }
  return null;
}

async function listPartners(sb) {
  const listed = await queryAffiliatePartnersList(sb);
  const rows = listed.rows || [];
  let clickStats = { total: {}, last7: {}, last30: {}, tableMissing: false };
  try {
    clickStats = await clickCountsByPartnerIds(rows.map((r) => r.id));
  } catch (e) {
    console.error('[affiliate-partners] click counts', e.message || e);
  }
  return {
    partners: rows.map((row) => mapPartnerRow(row, clickStats)),
    clicksTableMissing: !!clickStats.tableMissing,
    termsColumnsMissing: !!listed.termsColumnsMissing,
  };
}

async function listCommissions(sb, limit) {
  const max = Math.min(Math.max(Number(limit) || 100, 1), 300);
  const { data, error } = await sb
    .from('affiliate_commissions')
    .select('*')
    .order('payment_at', { ascending: false })
    .limit(max);
  if (error) {
    if (/affiliate_commissions/i.test(error.message || '')) {
      const err = new Error('affiliate_commissions_table_missing');
      err.code = 'affiliate_commissions_table_missing';
      throw err;
    }
    throw new Error(error.message);
  }
  const rows = (data || []).map(mapCommissionRow);
  const hold = rows.filter((r) => r.status === 'hold').length;
  const eligible = rows.filter((r) => r.status === 'eligible').length;
  const paid = rows.filter((r) => r.status === 'paid').length;
  return { commissions: rows, hold, eligible, paid, total: rows.length };
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  const sb = getSupabaseAdmin();

  if (req.method === 'GET') {
    try {
      const view = String((req.query && req.query.view) || '').trim().toLowerCase();
      if (view === 'commissions') {
        const overview = await listCommissions(sb, req.query && req.query.limit);
        return json(res, 200, { ok: true, configured: true, ...overview });
      }

      if (view === 'referral_activity' || view === 'activity') {
        const partnerId = String((req.query && req.query.partnerId) || '').trim();
        const code = normalizeAffiliateCode(req.query && req.query.code);
        let resolvedId = partnerId;
        if (!resolvedId && code) {
          const { data: partnerRow } = await sb
            .from('affiliate_partners')
            .select('id')
            .eq('code', code)
            .maybeSingle();
          resolvedId = (partnerRow && partnerRow.id) || '';
        }
        if (!resolvedId) {
          return json(res, 400, {
            ok: false,
            error: 'missing_partner',
            message: 'Pass partnerId or code.',
          });
        }
        const activity = await referralActivityForPartner(resolvedId, {
          limit: req.query && req.query.limit,
        });
        return json(res, 200, { ok: true, configured: true, partnerId: resolvedId, code: code || null, ...activity });
      }

      const listed = await listPartners(sb);
      const partners = listed.partners || [];
      return json(res, 200, {
        ok: true,
        configured: true,
        partners,
        clicksTableMissing: !!listed.clicksTableMissing,
        termsColumnsMissing: !!listed.termsColumnsMissing,
        total: partners.length,
        activeCount: partners.filter(function (p) {
          return p.active;
        }).length,
      });
    } catch (e) {
      if (
        e.code === 'affiliate_partners_table_missing' ||
        e.code === 'affiliate_commissions_table_missing'
      ) {
        return json(res, 503, {
          ok: false,
          error: e.code,
          message: 'Run migration 289_affiliate_partners.sql in Supabase.',
        });
      }
      return json(res, 500, { ok: false, error: 'partners_load_failed', message: e.message });
    }
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  try {
    const body = parseBody(req);
    const action = String(body.action || 'create').trim().toLowerCase();

    if (action === 'create') {
      const code = normalizeAffiliateCode(body.code);
      const displayName = String(body.displayName || body.display_name || body.name || '').trim();
      const email = normalizeEmail(body.email);
      const notes = String(body.notes || '').trim() || null;

      if (!code) {
        return json(res, 400, {
          ok: false,
          error: 'invalid_code',
          message: 'Use 2–32 letters, numbers, _ or -.',
        });
      }
      if (!displayName) {
        return json(res, 400, { ok: false, error: 'missing_name', message: 'Enter a display name.' });
      }
      if (!isValidEmail(email)) {
        return json(res, 400, { ok: false, error: 'invalid_email', message: 'Enter a valid email.' });
      }

      const now = new Date().toISOString();
      const { data: inserted, error: insertError } = await sb
        .from('affiliate_partners')
        .insert({
          code,
          display_name: displayName,
          email,
          notes,
          active: body.active === false ? false : true,
          created_at: now,
          updated_at: now,
        })
        .select('id')
        .single();

      if (insertError) {
        if (/duplicate|unique/i.test(insertError.message || '')) {
          return json(res, 409, {
            ok: false,
            error: 'code_taken',
            message: 'That partner code is already in use.',
          });
        }
        const persistence = partnerPersistenceErrorResponse(insertError);
        if (persistence) return json(res, persistence.status, persistence.body);
        throw new Error(supabaseErrorMessage(insertError));
      }

      const loaded = await queryAffiliatePartnerSingle(sb, function (q) {
        return q.eq('id', inserted.id).single();
      });

      return json(res, 200, { ok: true, partner: mapPartnerRow(loaded.row) });
    }

    if (action === 'set_active') {
      const id = String(body.id || '').trim();
      const active = body.active !== false;
      if (!id) return json(res, 400, { ok: false, error: 'missing_id' });

      const { error: updateError } = await sb
        .from('affiliate_partners')
        .update({ active, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (updateError) throw new Error(supabaseErrorMessage(updateError));

      const loaded = await queryAffiliatePartnerSingle(sb, function (q) {
        return q.eq('id', id).maybeSingle();
      });
      if (!loaded.row) return json(res, 404, { ok: false, error: 'not_found' });
      return json(res, 200, { ok: true, partner: mapPartnerRow(loaded.row) });
    }

    if (action === 'send_invite') {
      const id = String(body.id || '').trim();
      const code = normalizeAffiliateCode(body.code);
      if (!id && !code) {
        return json(res, 400, { ok: false, error: 'missing_partner', message: 'Choose a partner.' });
      }

      const loaded = await queryAffiliatePartnerSingle(sb, function (q) {
        if (id) return q.eq('id', id).maybeSingle();
        return q.eq('code', code).maybeSingle();
      });
      const data = loaded.row;
      if (!data) return json(res, 404, { ok: false, error: 'not_found' });
      if (data.active === false) {
        return json(res, 400, {
          ok: false,
          error: 'partner_inactive',
          message: 'Activate the partner before sending an invite.',
        });
      }

      const sent = await sendPartnerInviteEmail(data);
      return json(res, 200, { ok: true, sent, partner: mapPartnerRow(data) });
    }

    if (action === 'create_commission' || action === 'manual_attribute') {
      const code = normalizeAffiliateCode(body.code || body.affiliateCode);
      const productType = String(body.productType || body.product_type || 'hub_sponsorship').trim();
      const saleNetExVatPence =
        body.saleNetExVatPence != null
          ? Math.round(Number(body.saleNetExVatPence) || 0)
          : poundsToPence(body.saleExVat || body.amountExVat || body.amount);
      const customerEmail = normalizeEmail(body.customerEmail || body.email);
      const notes = String(body.notes || '').trim() || 'Manual attribute (admin)';

      if (!code) {
        return json(res, 400, { ok: false, error: 'invalid_code', message: 'Enter a partner code.' });
      }
      if (!isAffiliateEligibleProduct(productType)) {
        return json(res, 400, {
          ok: false,
          error: 'invalid_product',
          message: 'Use opportunity_listing, opportunity_premium, or hub_sponsorship.',
        });
      }
      if (saleNetExVatPence <= 0) {
        return json(res, 400, {
          ok: false,
          error: 'invalid_amount',
          message: 'Enter the sale amount ex-VAT in pounds (e.g. 25 or 2000).',
        });
      }

      const partner = await getActivePartnerByCode(code);
      if (!partner) {
        return json(res, 404, {
          ok: false,
          error: 'partner_not_found',
          message: 'No active partner with that code.',
        });
      }

      if (customerEmail) {
        await recordAffiliateAttribution({
          partner,
          email: customerEmail,
          source: 'manual',
          context: 'admin_manual_attribute',
          metadata: { productType, saleNetExVatPence },
        });
      }

      const result = await createAffiliateCommission({
        partner,
        productType,
        saleNetExVatPence,
        paymentAt: body.paymentAt || new Date().toISOString(),
        stripePaymentId: String(body.stripePaymentId || '').trim() || null,
        stripeInvoiceId: String(body.stripeInvoiceId || '').trim() || null,
        customerEmail: customerEmail || null,
        notes,
        sendEmail: body.sendEmail !== false,
      });

      if (result.skipped) {
        return json(res, 409, {
          ok: false,
          error: result.reason || 'skipped',
          message: result.reason || 'Commission was not created',
          detail: result,
        });
      }

      return json(res, 200, {
        ok: true,
        commission: mapCommissionRow(result.commission),
        emailResult: result.emailResult || null,
      });
    }

    if (action === 'promote_eligible') {
      const result = await promoteEligibleAffiliateCommissions();
      return json(res, 200, { ok: true, ...result });
    }

    if (action === 'mark_terms_accepted') {
      const id = String(body.id || '').trim();
      if (!id) return json(res, 400, { ok: false, error: 'missing_id' });
      const now = new Date().toISOString();
      const { data, error } = await sb
        .from('affiliate_partners')
        .update({
          terms_accepted_at: now,
          terms_version: REFERRAL_PARTNER_TERMS_VERSION,
          updated_at: now,
        })
        .eq('id', id)
        .select(
          'id, code, display_name, email, active, notes, created_at, updated_at, terms_accepted_at, terms_version, application_terms_agreed_at'
        )
        .maybeSingle();
      if (error) {
        if (/terms_accepted_at|schema cache/i.test(error.message || '')) {
          return json(res, 503, {
            ok: false,
            error: 'terms_columns_missing',
            message: 'Run migration 296_affiliate_partner_terms.sql in Supabase.',
          });
        }
        throw new Error(error.message);
      }
      if (!data) return json(res, 404, { ok: false, error: 'not_found' });
      return json(res, 200, { ok: true, partner: mapPartnerRow(data) });
    }

    return json(res, 400, { ok: false, error: 'unknown_action' });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'partners_save_failed', message: e.message });
  }
};
