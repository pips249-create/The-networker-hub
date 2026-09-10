/**
 * Partner programme — commission ledger (earn on paid sale).
 * Rules: docs/PARTNER-PROGRAMME.md
 */
const { getSupabaseAdmin } = require('./supabase');
const {
  AFFILIATE_COMMISSION_RATE,
  AFFILIATE_HOLD_DAYS,
  normalizeAffiliateCode,
  getActivePartnerByCode,
  mapPartnerRow,
} = require('./affiliate-programme');
const { sendViaResend } = require('./send-template-email');

const AFFILIATE_MAX_SUBSCRIPTION_PAYMENTS = 3;

const AFFILIATE_PRODUCT_TYPES = new Set([
  'opportunity_listing',
  'opportunity_premium',
  'hub_sponsorship',
]);

function normalizeMeta(meta) {
  return meta && typeof meta === 'object' ? meta : {};
}

function addDaysIso(isoOrDate, days) {
  const d = isoOrDate instanceof Date ? new Date(isoOrDate.getTime()) : new Date(isoOrDate);
  d.setUTCDate(d.getUTCDate() + Number(days) || 0);
  return d.toISOString();
}

function productTypeFromMetadata(metadata) {
  const meta = normalizeMeta(metadata);
  const checkoutType = String(meta.checkout_type || meta.checkoutType || '')
    .trim()
    .toLowerCase();
  if (checkoutType === 'opportunity_listing') return 'opportunity_listing';
  if (checkoutType === 'opportunity_premium') return 'opportunity_premium';
  if (checkoutType === 'hub_sponsorship' || checkoutType === 'sponsorship') return 'hub_sponsorship';
  return '';
}

function isAffiliateEligibleProduct(productType) {
  return AFFILIATE_PRODUCT_TYPES.has(String(productType || '').trim());
}

function saleNetExVatPenceFromMetadata(metadata, fallbackGrossPence) {
  const meta = normalizeMeta(metadata);
  const fromMeta = parseInt(meta.amount_ex_vat_pence || meta.amountExVatPence || '', 10);
  if (Number.isFinite(fromMeta) && fromMeta > 0) return fromMeta;

  const featured = parseInt(meta.featured_amount_pence || '', 10);
  if (Number.isFinite(featured) && featured > 0) return featured;

  const gross = parseInt(fallbackGrossPence, 10);
  if (Number.isFinite(gross) && gross > 0) {
    // Prefer explicit ex-VAT; if only gross known, treat as ex-VAT for commission base
    // when product is already priced ex-VAT (listings). For VAT-inclusive totals this is
    // slightly generous — Phase 4 statements can refine.
    return gross;
  }
  return 0;
}

function commissionPenceFromSale(saleNetExVatPence, rate) {
  const sale = Math.round(Number(saleNetExVatPence) || 0);
  const r = Number(rate);
  const useRate = Number.isFinite(r) && r > 0 ? r : AFFILIATE_COMMISSION_RATE;
  return Math.round(sale * useRate);
}

function formatPounds(pence) {
  const n = Number(pence) || 0;
  return '£' + (n / 100).toFixed(2);
}

function productLabel(productType) {
  if (productType === 'opportunity_listing') return 'Opportunity listing';
  if (productType === 'opportunity_premium') return 'Featured Opportunity Boost';
  if (productType === 'hub_sponsorship') return 'Advertising / sponsorship';
  return productType || 'Sale';
}

async function countSubscriptionCommissions(sb, subscriptionId) {
  const subId = String(subscriptionId || '').trim();
  if (!subId) return 0;
  const { data, error } = await sb
    .from('affiliate_commissions')
    .select('id')
    .eq('stripe_subscription_id', subId)
    .gt('commission_net_pence', 0)
    .neq('status', 'void');
  if (error) {
    if (/affiliate_commissions/i.test(error.message || '')) return 0;
    throw new Error(error.message);
  }
  return (data || []).length;
}

async function findPartnerForSale(opts) {
  opts = opts || {};
  const code = normalizeAffiliateCode(opts.code || opts.affiliateCode);
  if (code) {
    const partner = await getActivePartnerByCode(code);
    if (partner) return { partner, source: 'metadata' };
  }

  const email = String(opts.email || '').trim().toLowerCase();
  if (!email) return null;

  const sb = getSupabaseAdmin();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const { data, error } = await sb
    .from('affiliate_attributions')
    .select('partner_id, code, created_at')
    .eq('customer_email', email)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    if (/affiliate_/i.test(error.message || '')) return null;
    console.error('[affiliate-find-partner]', error.message || error);
    return null;
  }

  for (const row of data || []) {
    const partner = await getActivePartnerByCode(row.code);
    if (partner) return { partner, source: 'attribution' };
  }
  return null;
}

async function sendAffiliateAttributedEmail(partner, commission) {
  const to = String(partner.email || '').trim().toLowerCase();
  if (!to) return { skipped: true, reason: 'no_partner_email' };

  const eligibleDate = new Date(commission.eligible_from);
  const eligibleLabel = eligibleDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const html =
    '<div style="font-family:DM Sans,Arial,sans-serif;line-height:1.55;color:#2d2636;max-width:560px;">' +
    '<p style="margin:0 0 12px;">Hi ' +
    String(partner.display_name || partner.code || 'there').replace(/</g, '') +
    ',</p>' +
    '<p style="margin:0 0 12px;">A referral just converted on The Networker UK.</p>' +
    '<table style="border-collapse:collapse;width:100%;max-width:480px;">' +
    '<tr><td style="padding:4px 12px 4px 0;color:#666;">Product</td><td><strong>' +
    productLabel(commission.product_type) +
    '</strong></td></tr>' +
    '<tr><td style="padding:4px 12px 4px 0;color:#666;">Sale (ex-VAT)</td><td>' +
    formatPounds(commission.sale_net_ex_vat_pence) +
    '</td></tr>' +
    '<tr><td style="padding:4px 12px 4px 0;color:#666;">Your commission (20%)</td><td><strong>' +
    formatPounds(commission.commission_net_pence) +
    '</strong></td></tr>' +
    '<tr><td style="padding:4px 12px 4px 0;color:#666;">Status</td><td>In hold until ' +
    eligibleLabel +
    ' (14-day refund window)</td></tr>' +
    '</table>' +
    '<p style="margin:16px 0 0;">Questions? Email <a href="mailto:partnerships@thenetworkeruk.com">partnerships@thenetworkeruk.com</a>.</p>' +
    '<p style="margin:12px 0 0;">The Networker UK</p>' +
    '</div>';

  try {
    await sendViaResend({
      to,
      subject:
        'Referral attributed — ' +
        formatPounds(commission.commission_net_pence) +
        ' in hold · The Networker UK',
      html,
      replyTo: 'partnerships@thenetworkeruk.com',
      skipAllowlist: true,
    });
    return { ok: true };
  } catch (e) {
    console.error('[affiliate-attributed-email]', e.message || e);
    return { ok: false, error: e.message || String(e) };
  }
}

/**
 * Insert one positive commission row (idempotent on Stripe payment / invoice ids).
 */
async function createAffiliateCommission(opts) {
  opts = opts || {};
  const productType = String(opts.productType || '').trim();
  if (!isAffiliateEligibleProduct(productType)) {
    return { skipped: true, reason: 'product_not_eligible' };
  }

  const saleNetExVatPence = Math.round(Number(opts.saleNetExVatPence) || 0);
  if (saleNetExVatPence <= 0) {
    return { skipped: true, reason: 'missing_sale_amount' };
  }

  const partner =
    opts.partner ||
    (opts.code || opts.affiliateCode
      ? await getActivePartnerByCode(opts.code || opts.affiliateCode)
      : null);
  if (!partner) {
    return { skipped: true, reason: 'partner_not_found' };
  }

  const commissionNetPence = commissionPenceFromSale(saleNetExVatPence, opts.rate);
  if (commissionNetPence <= 0) {
    return { skipped: true, reason: 'zero_commission' };
  }

  const sb = getSupabaseAdmin();
  const subscriptionId = String(opts.stripeSubscriptionId || '').trim() || null;

  if (subscriptionId) {
    const prior = await countSubscriptionCommissions(sb, subscriptionId);
    if (prior >= AFFILIATE_MAX_SUBSCRIPTION_PAYMENTS) {
      return {
        skipped: true,
        reason: 'subscription_cap_reached',
        priorCount: prior,
        max: AFFILIATE_MAX_SUBSCRIPTION_PAYMENTS,
      };
    }
  }

  const paymentAt = opts.paymentAt
    ? new Date(opts.paymentAt).toISOString()
    : new Date().toISOString();
  const eligibleFrom = addDaysIso(paymentAt, AFFILIATE_HOLD_DAYS);

  const row = {
    partner_id: partner.id,
    code: partner.code,
    product_type: productType,
    sale_net_ex_vat_pence: saleNetExVatPence,
    commission_rate: AFFILIATE_COMMISSION_RATE,
    commission_net_pence: commissionNetPence,
    stripe_payment_id: String(opts.stripePaymentId || '').trim() || null,
    stripe_invoice_id: String(opts.stripeInvoiceId || '').trim() || null,
    stripe_subscription_id: subscriptionId,
    checkout_session_id: String(opts.checkoutSessionId || '').trim() || null,
    customer_email: opts.customerEmail
      ? String(opts.customerEmail).trim().toLowerCase()
      : null,
    payment_at: paymentAt,
    eligible_from: eligibleFrom,
    status: 'hold',
    notes: opts.notes ? String(opts.notes).trim().slice(0, 500) : null,
  };

  const { data, error } = await sb
    .from('affiliate_commissions')
    .insert(row)
    .select('*')
    .maybeSingle();

  if (error) {
    if (/duplicate|unique/i.test(error.message || '')) {
      return { skipped: true, reason: 'already_recorded', duplicate: true };
    }
    if (/affiliate_commissions/i.test(error.message || '')) {
      return { skipped: true, reason: 'commissions_table_missing' };
    }
    throw new Error(error.message);
  }

  let emailResult = null;
  if (opts.sendEmail !== false) {
    emailResult = await sendAffiliateAttributedEmail(partner, data);
  }

  return {
    ok: true,
    commission: data,
    partner: mapPartnerRow(partner),
    emailResult,
  };
}

async function maybeCreateCommissionFromCheckoutSession(session) {
  session = session || {};
  const mode = String(session.mode || '').trim().toLowerCase();
  // Subscription first payment also fires invoice.paid — record there only.
  if (mode === 'subscription' || session.subscription) {
    return { skipped: true, reason: 'defer_to_invoice_paid' };
  }

  const meta = normalizeMeta(session.metadata);
  const productType = productTypeFromMetadata(meta);
  if (!productType) return { skipped: true, reason: 'not_affiliate_product' };

  const email = String(
    session.customer_email || session.customer_details?.email || meta.owner_email || ''
  )
    .trim()
    .toLowerCase();

  const resolved = await findPartnerForSale({
    code: meta.affiliate_code,
    email,
  });
  if (!resolved) return { skipped: true, reason: 'no_affiliate' };

  const amountTotal = Number(session.amount_total) || 0;
  const saleNetExVatPence = saleNetExVatPenceFromMetadata(meta, amountTotal);

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id || null;

  return createAffiliateCommission({
    partner: resolved.partner,
    productType,
    saleNetExVatPence,
    paymentAt: session.created ? new Date(session.created * 1000) : new Date(),
    stripePaymentId: paymentIntentId,
    checkoutSessionId: session.id,
    customerEmail: email,
    notes: 'checkout.session.completed · source=' + resolved.source,
  });
}

async function maybeCreateCommissionFromInvoice(invoice) {
  invoice = invoice || {};
  const meta = normalizeMeta(
    invoice.subscription_details?.metadata || invoice.metadata || {}
  );

  let productType = productTypeFromMetadata(meta);
  const subId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription.trim()
      : String(invoice.subscription?.id || '').trim();

  // Pull subscription metadata when invoice meta is thin
  if ((!productType || !meta.affiliate_code) && subId) {
    try {
      const { getStripeClient } = require('./stripe-checkout');
      const subscription = await getStripeClient().subscriptions.retrieve(subId);
      const subMeta = normalizeMeta(subscription.metadata);
      if (!productType) productType = productTypeFromMetadata(subMeta);
      if (!meta.affiliate_code && subMeta.affiliate_code) {
        meta.affiliate_code = subMeta.affiliate_code;
      }
      if (!meta.amount_ex_vat_pence && subMeta.amount_ex_vat_pence) {
        meta.amount_ex_vat_pence = subMeta.amount_ex_vat_pence;
      }
      if (!meta.checkout_type && subMeta.checkout_type) {
        meta.checkout_type = subMeta.checkout_type;
        if (!productType) productType = productTypeFromMetadata(meta);
      }
    } catch (e) {
      console.error('[affiliate-invoice-sub-meta]', e.message || e);
    }
  }

  if (!productType) return { skipped: true, reason: 'not_affiliate_product' };

  const email = String(
    invoice.customer_email || invoice.customer_details?.email || meta.owner_email || ''
  )
    .trim()
    .toLowerCase();

  const resolved = await findPartnerForSale({
    code: meta.affiliate_code,
    email,
  });
  if (!resolved) return { skipped: true, reason: 'no_affiliate' };

  const saleNetExVatPence = saleNetExVatPenceFromMetadata(
    meta,
    Number(invoice.total) || Number(invoice.amount_paid) || 0
  );

  const paymentIntentId =
    typeof invoice.payment_intent === 'string'
      ? invoice.payment_intent
      : invoice.payment_intent?.id || null;

  return createAffiliateCommission({
    partner: resolved.partner,
    productType,
    saleNetExVatPence,
    paymentAt: invoice.status_transitions?.paid_at
      ? new Date(invoice.status_transitions.paid_at * 1000)
      : invoice.created
        ? new Date(invoice.created * 1000)
        : new Date(),
    stripePaymentId: paymentIntentId,
    stripeInvoiceId: invoice.id,
    stripeSubscriptionId: subId || null,
    customerEmail: email,
    notes: 'invoice.paid · source=' + resolved.source,
  });
}

async function clawbackAffiliateCommissionFromCharge(charge) {
  charge = charge || {};
  const paymentIntentId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id || null;
  if (!paymentIntentId) {
    return { skipped: true, reason: 'missing_payment_intent' };
  }

  const sb = getSupabaseAdmin();
  const { data: originals, error } = await sb
    .from('affiliate_commissions')
    .select('*')
    .eq('stripe_payment_id', paymentIntentId)
    .gt('commission_net_pence', 0)
    .neq('status', 'void');

  if (error) {
    if (/affiliate_commissions/i.test(error.message || '')) {
      return { skipped: true, reason: 'commissions_table_missing' };
    }
    throw new Error(error.message);
  }
  if (!originals || !originals.length) {
    return { skipped: true, reason: 'no_commission' };
  }

  const results = [];
  for (const original of originals) {
    const { data: existingClawback } = await sb
      .from('affiliate_commissions')
      .select('id')
      .eq('stripe_payment_id', paymentIntentId)
      .lt('commission_net_pence', 0)
      .eq('partner_id', original.partner_id)
      .maybeSingle();

    if (existingClawback) {
      results.push({ skipped: true, reason: 'clawback_exists', originalId: original.id });
      continue;
    }

    // If still in hold / eligible / statemented unpaid — void original instead of negative pair when possible
    if (original.status === 'hold' || original.status === 'eligible') {
      const { data: voided, error: voidErr } = await sb
        .from('affiliate_commissions')
        .update({ status: 'void', notes: (original.notes || '') + ' · voided on refund' })
        .eq('id', original.id)
        .select('*')
        .maybeSingle();
      if (voidErr) throw new Error(voidErr.message);
      results.push({ ok: true, voided: voided });
      continue;
    }

    const paymentAt = new Date().toISOString();
    const clawback = {
      partner_id: original.partner_id,
      code: original.code,
      product_type: original.product_type,
      sale_net_ex_vat_pence: -Math.abs(original.sale_net_ex_vat_pence),
      commission_rate: original.commission_rate,
      commission_net_pence: -Math.abs(original.commission_net_pence),
      stripe_payment_id: paymentIntentId,
      stripe_invoice_id: original.stripe_invoice_id,
      stripe_subscription_id: original.stripe_subscription_id,
      checkout_session_id: original.checkout_session_id,
      customer_email: original.customer_email,
      payment_at: paymentAt,
      eligible_from: paymentAt,
      status: 'eligible',
      notes: 'clawback for commission ' + original.id,
    };

    const { data: inserted, error: insertErr } = await sb
      .from('affiliate_commissions')
      .insert(clawback)
      .select('*')
      .maybeSingle();
    if (insertErr) throw new Error(insertErr.message);
    results.push({ ok: true, clawback: inserted, originalId: original.id });
  }

  return { ok: true, results };
}

async function promoteEligibleAffiliateCommissions() {
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from('affiliate_commissions')
    .update({ status: 'eligible' })
    .eq('status', 'hold')
    .lte('eligible_from', now)
    .select('id, partner_id, commission_net_pence');

  if (error) {
    if (/affiliate_commissions/i.test(error.message || '')) {
      return { skipped: true, reason: 'commissions_table_missing', promoted: 0 };
    }
    throw new Error(error.message);
  }

  return { ok: true, promoted: (data || []).length, rows: data || [] };
}

function mapCommissionRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    partnerId: row.partner_id,
    code: row.code,
    productType: row.product_type,
    productLabel: productLabel(row.product_type),
    saleNetExVatPence: row.sale_net_ex_vat_pence,
    commissionNetPence: row.commission_net_pence,
    commissionRate: row.commission_rate,
    status: row.status,
    paymentAt: row.payment_at,
    eligibleFrom: row.eligible_from,
    customerEmail: row.customer_email,
    stripePaymentId: row.stripe_payment_id,
    stripeInvoiceId: row.stripe_invoice_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    checkoutSessionId: row.checkout_session_id,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

module.exports = {
  AFFILIATE_MAX_SUBSCRIPTION_PAYMENTS,
  AFFILIATE_PRODUCT_TYPES,
  productTypeFromMetadata,
  isAffiliateEligibleProduct,
  saleNetExVatPenceFromMetadata,
  commissionPenceFromSale,
  createAffiliateCommission,
  maybeCreateCommissionFromCheckoutSession,
  maybeCreateCommissionFromInvoice,
  clawbackAffiliateCommissionFromCharge,
  promoteEligibleAffiliateCommissions,
  findPartnerForSale,
  mapCommissionRow,
  productLabel,
  formatPounds,
};
