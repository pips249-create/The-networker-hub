/**
 * Stripe → Revenue targets — sponsorship & advertising invoices.
 *
 * Tag Stripe invoices (or sponsorship checkout sessions) with metadata so paid
 * amounts flow into Command Centre → Revenue targets automatically.
 *
 * Required on invoice or checkout metadata (pick one):
 *   revenue_category: events | opportunities | browse_organisers | awards
 * OR placement: e.g. events_main_sponsor (see PLACEMENT_CATEGORIES)
 * OR cms_slot: e.g. events_sponsor_hub (see CMS_SLOT_CATEGORIES)
 *
 * Optional:
 *   source_label — display name (defaults to customer + line description)
 *   hub_revenue: sponsorship — alias when using checkout_type hub_sponsorship
 */
const { getSupabaseAdmin } = require('./supabase');

const VALID_CATEGORIES = new Set([
  'events',
  'opportunities',
  'ticket_sales',
  'browse_organisers',
  'awards',
]);

/** Organiser self-serve checkout — already tracked via domain tables, not hub_revenue_deals. */
const SELF_SERVE_CHECKOUT_TYPES = new Set([
  'opportunity_listing',
  'opportunity_premium',
  'event_featured',
  'group_update_credits',
]);

const PLACEMENT_CATEGORIES = {
  events_main_sponsor: 'events',
  events_directory_sponsor: 'events',
  events_mini_sponsor: 'events',
  events_sidebar: 'events',
  opportunities_main_sponsor: 'opportunities',
  opportunities_directory_sponsor: 'opportunities',
  opportunities_mini_sponsor: 'opportunities',
  opportunities_sidebar: 'opportunities',
  organisers_main_sponsor: 'browse_organisers',
  organisers_directory_sponsor: 'browse_organisers',
  organisers_mini_sponsor: 'browse_organisers',
  organisers_featured: 'browse_organisers',
  browse_organisers_main_sponsor: 'browse_organisers',
  city_partner: 'events',
  city_partner_single: 'events',
  city_partner_bundle_3: 'events',
  county_partner: 'events',
  awards_sponsor: 'awards',
  awards: 'awards',
};

const CMS_SLOT_CATEGORIES = {
  events_sponsor_hub: 'events',
  event_page_carousel_ads: 'events',
  booking_email_sponsor: 'events',
  opportunities_sponsor_hub: 'opportunities',
  opportunity_page_sidebar_ad: 'opportunities',
  opportunity_page_carousel_ads: 'opportunities',
  organisers_sponsor_hub: 'browse_organisers',
  organiser_page_carousel_ads: 'browse_organisers',
  organiser_page_sidebar_ad: 'browse_organisers',
};

function cmsSlotCategory(slot) {
  const key = String(slot || '').trim();
  if (CMS_SLOT_CATEGORIES[key]) return CMS_SLOT_CATEGORIES[key];
  if (/^networking_city_partner_/i.test(key)) return 'events';
  if (/^networking_county_partner_/i.test(key)) return 'events';
  return null;
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function normalizeMeta(meta) {
  return meta && typeof meta === 'object' ? meta : {};
}

function parseRevenueCategory(metadata) {
  const meta = normalizeMeta(metadata);
  const direct = String(meta.revenue_category || meta.revenueCategory || '').trim().toLowerCase();
  if (VALID_CATEGORIES.has(direct)) return direct;

  const placement = String(meta.placement || meta.sponsor_placement || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (placement && PLACEMENT_CATEGORIES[placement]) return PLACEMENT_CATEGORIES[placement];

  const slot = String(meta.cms_slot || meta.cmsSlot || '').trim();
  const slotCategory = cmsSlotCategory(slot);
  if (slotCategory) return slotCategory;

  const checkoutType = String(meta.checkout_type || meta.checkoutType || '').trim().toLowerCase();
  if (checkoutType === 'hub_sponsorship' || checkoutType === 'sponsorship') {
    return parseRevenueCategory({ ...meta, checkout_type: '' }) || 'events';
  }

  if (String(meta.hub_revenue || meta.hubRevenue || '').trim().toLowerCase() === 'sponsorship') {
    const hinted = String(meta.revenue_category || meta.placement || '').trim();
    if (hinted) return parseRevenueCategory(meta);
    return null;
  }

  return null;
}

function isHubSponsorshipMetadata(metadata) {
  const meta = normalizeMeta(metadata);
  if (parseRevenueCategory(meta)) return true;
  const checkoutType = String(meta.checkout_type || '').trim().toLowerCase();
  if (checkoutType === 'hub_sponsorship' || checkoutType === 'sponsorship') return true;
  return String(meta.hub_revenue || '').trim().toLowerCase() === 'sponsorship';
}

function shouldSkipSelfServeMetadata(metadata) {
  const checkoutType = String(metadata.checkout_type || metadata.checkoutType || '')
    .trim()
    .toLowerCase();
  return SELF_SERVE_CHECKOUT_TYPES.has(checkoutType);
}

function buildSourceLabel(metadata, fallbacks) {
  const meta = normalizeMeta(metadata);
  const explicit = String(meta.source_label || meta.sourceLabel || '').trim();
  if (explicit) return explicit.slice(0, 240);

  const parts = [];
  if (fallbacks.customerName) parts.push(String(fallbacks.customerName).trim());
  if (fallbacks.description) parts.push(String(fallbacks.description).trim());
  if (fallbacks.invoiceNumber) parts.push('Invoice ' + fallbacks.invoiceNumber);
  const joined = parts.filter(Boolean).join(' — ');
  return joined.slice(0, 240) || 'Stripe sponsorship';
}

async function insertRevenueDeal(row) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('hub_revenue_deals').insert(row).select('id').maybeSingle();

  if (error) {
    if (/duplicate key|unique/i.test(error.message)) {
      return { ok: true, duplicate: true };
    }
    throw new Error(error.message);
  }
  return { ok: true, id: data?.id || null };
}

async function recordStripeRevenueDeal(input) {
  const category = input.category;
  if (!VALID_CATEGORIES.has(category)) {
    return { skipped: true, reason: 'invalid_category' };
  }

  const amount = round2(input.amountGbp);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { skipped: true, reason: 'invalid_amount' };
  }

  const row = {
    category,
    source_label: buildSourceLabel(input.metadata, input.fallbacks || {}),
    amount_gbp: amount,
    recorded_at: input.recordedAt || new Date().toISOString(),
    notes: String(input.notes || '').trim(),
    cms_slot: String(input.metadata?.cms_slot || input.metadata?.cmsSlot || '').trim() || null,
    source_type: input.sourceType || 'stripe_invoice',
    stripe_invoice_id: input.stripeInvoiceId || null,
    stripe_checkout_session_id: input.stripeCheckoutSessionId || null,
    stripe_customer_id: input.stripeCustomerId || null,
    created_by: 'stripe_webhook',
    updated_at: new Date().toISOString(),
  };

  const result = await insertRevenueDeal(row);
  return { ok: true, ...result, category, amountGbp: amount };
}

function invoicePaidAmountGbp(invoice) {
  const paid = invoice.amount_paid != null ? Number(invoice.amount_paid) : 0;
  if (paid > 0) return round2(paid / 100);
  const total = invoice.total != null ? Number(invoice.total) : 0;
  return total > 0 ? round2(total / 100) : 0;
}

function invoiceRecordedAt(invoice) {
  const paidAt =
    invoice.status_transitions?.paid_at ||
    invoice.effective_at ||
    invoice.created;
  if (paidAt) {
    const d = new Date(typeof paidAt === 'number' ? paidAt * 1000 : paidAt);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

function invoiceDescription(invoice) {
  const lines = invoice.lines?.data || [];
  const first = lines.find((l) => String(l.description || '').trim());
  return first ? String(first.description).trim() : String(invoice.description || '').trim();
}

/**
 * Handle invoice.paid — sponsorship & advertising invoices created in Stripe.
 */
async function handleInvoicePaid(invoice) {
  if (!invoice || String(invoice.status || '').toLowerCase() !== 'paid') {
    return { skipped: true, reason: 'not_paid' };
  }

  const metadata = normalizeMeta(invoice.metadata);

  if (shouldSkipSelfServeMetadata(metadata)) {
    return { skipped: true, reason: 'self_serve_checkout' };
  }

  // Subscription renewals for organiser premium/listings — tracked elsewhere unless tagged.
  if (invoice.subscription && !isHubSponsorshipMetadata(metadata)) {
    return { skipped: true, reason: 'subscription_without_sponsorship_metadata' };
  }

  const category = parseRevenueCategory(metadata);
  if (!category) {
    return { skipped: true, reason: 'missing_revenue_metadata' };
  }

  const amountGbp = invoicePaidAmountGbp(invoice);
  if (amountGbp <= 0) {
    return { skipped: true, reason: 'zero_amount' };
  }

  const customerName =
    invoice.customer_name ||
    invoice.customer_email ||
    (typeof invoice.customer === 'object' ? invoice.customer?.name || invoice.customer?.email : '');

  return recordStripeRevenueDeal({
    category,
    amountGbp,
    recordedAt: invoiceRecordedAt(invoice),
    metadata,
    fallbacks: {
      customerName,
      description: invoiceDescription(invoice),
      invoiceNumber: invoice.number || invoice.id,
    },
    notes: ['Stripe invoice', invoice.number || invoice.id].filter(Boolean).join(' · '),
    sourceType: 'stripe_invoice',
    stripeInvoiceId: String(invoice.id || '').trim() || null,
    stripeCustomerId:
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id || null,
  });
}

/**
 * Handle checkout.session.completed for sponsorship payment links / checkout.
 */
async function handleSponsorshipCheckoutCompleted(session) {
  const metadata = normalizeMeta(session.metadata);

  if (shouldSkipSelfServeMetadata(metadata)) {
    return { skipped: true, reason: 'self_serve_checkout' };
  }

  if (!isHubSponsorshipMetadata(metadata)) {
    return { skipped: true, reason: 'not_sponsorship_checkout' };
  }

  const category = parseRevenueCategory(metadata);
  if (!category) {
    return { skipped: true, reason: 'missing_revenue_category' };
  }

  const paid =
    session.payment_status === 'paid' ||
    session.payment_status === 'no_payment_required' ||
    session.status === 'complete';
  if (!paid) {
    return { skipped: true, reason: 'payment_not_complete' };
  }

  const amountGbp =
    session.amount_total != null ? round2(Number(session.amount_total) / 100) : 0;
  if (amountGbp <= 0) {
    return { skipped: true, reason: 'zero_amount' };
  }

  const customerName =
    session.customer_details?.name ||
    session.customer_details?.email ||
    session.customer_email ||
    '';

  return recordStripeRevenueDeal({
    category,
    amountGbp,
    recordedAt: new Date().toISOString(),
    metadata,
    fallbacks: {
      customerName,
      description: metadata.package_name || metadata.packageName || '',
    },
    notes: 'Stripe checkout · ' + String(session.id || ''),
    sourceType: 'stripe_checkout',
    stripeCheckoutSessionId: String(session.id || '').trim() || null,
    stripeCustomerId:
      typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
  });
}

/**
 * booking fee on organiser membership invoices → ticket_sales target.
 * Idempotent on stripe_invoice_id (same unique index as sponsorship invoices).
 */
async function recordMembershipBookingFeeFromInvoice(invoice, subscription) {
  if (!invoice || String(invoice.status || '').toLowerCase() !== 'paid') {
    return { skipped: true, reason: 'not_paid' };
  }

  const invoiceId = String(invoice.id || '').trim();
  if (!invoiceId) return { skipped: true, reason: 'missing_invoice_id' };

  const meta = {
    ...normalizeMeta(subscription?.metadata),
    ...normalizeMeta(invoice?.subscription_details?.metadata),
    ...normalizeMeta(invoice?.metadata),
  };

  const checkoutType = String(meta.checkout_type || '').trim().toLowerCase();
  if (checkoutType !== 'organiser_membership') {
    return { skipped: true, reason: 'not_membership' };
  }

  // Record Hub platform cut only (3% of membership) — not the full booking fee that includes Stripe.
  const { calculateHubPlatformFee } = require('./booking-fees');
  let feeGbp = 0;
  const membershipPence = Number(meta.membership_amount_pence);
  if (Number.isFinite(membershipPence) && membershipPence > 0) {
    feeGbp = calculateHubPlatformFee(membershipPence / 100);
  } else {
    // Fall back: reverse membership from full booking fee (m×4.5% + 20p), then take 3%.
    let fullFeeGbp = 0;
    const hubFeePence = Number(meta.hub_fee_pence);
    if (Number.isFinite(hubFeePence) && hubFeePence > 0) {
      fullFeeGbp = hubFeePence / 100;
    } else {
      const lines = Array.isArray(invoice?.lines?.data) ? invoice.lines.data : [];
      for (const line of lines) {
        const desc = String(line.description || '').toLowerCase();
        if (!desc.includes('booking fee')) continue;
        const amount = Number(line.amount);
        if (Number.isFinite(amount) && amount > 0) {
          fullFeeGbp = amount / 100;
          break;
        }
      }
    }
    if (fullFeeGbp > 0) {
      const inferredMembership = Math.max(0, (fullFeeGbp - 0.2) / 0.045);
      feeGbp = calculateHubPlatformFee(inferredMembership);
    }
  }

  if (!(feeGbp > 0)) return { skipped: true, reason: 'zero_fee' };

  const email = String(meta.attendee_email || meta.email || invoice.customer_email || '')
    .trim()
    .toLowerCase();
  const interval = String(meta.billing_interval || '').trim().toLowerCase();
  const intervalLabel = interval === 'year' ? 'annual' : interval === 'month' ? 'monthly' : '';
  const sourceLabel = [
    'Membership platform fee',
    intervalLabel,
    email,
  ]
    .filter(Boolean)
    .join(' — ')
    .slice(0, 240);

  return recordStripeRevenueDeal({
    category: 'ticket_sales',
    amountGbp: feeGbp,
    recordedAt: invoiceRecordedAt(invoice),
    metadata: {
      ...meta,
      source_label: sourceLabel,
      revenue_category: 'ticket_sales',
    },
    fallbacks: {
      customerName: email,
      description: 'Membership platform fee',
      invoiceNumber: invoice.number || invoice.id,
    },
    notes: ['Membership platform fee (Stripe excluded)', invoice.number || invoice.id]
      .filter(Boolean)
      .join(' · '),
    sourceType: 'stripe_invoice',
    stripeInvoiceId: invoiceId,
    stripeCustomerId:
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id ||
          (typeof subscription?.customer === 'string'
            ? subscription.customer
            : subscription?.customer?.id) ||
          null,
  });
}

module.exports = {
  VALID_CATEGORIES,
  PLACEMENT_CATEGORIES,
  CMS_SLOT_CATEGORIES,
  parseRevenueCategory,
  handleInvoicePaid,
  handleSponsorshipCheckoutCompleted,
  recordMembershipBookingFeeFromInvoice,
  recordStripeRevenueDeal,
};
