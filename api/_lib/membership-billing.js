/**
 * Organiser membership dues billed through Hub Stripe Connect.
 * Same fee model as tickets: members pay price + 4.5% + 20p; organiser gets 100% of price.
 */
const { getSupabaseAdmin } = require('./supabase');
const {
  BOOKING_FEE_RATE,
  BOOKING_FEE_PER_TICKET,
  calculateBookingFee,
} = require('./booking-fees');

const MEMBERSHIP_FEE_LABEL = 'Hub fee (4.5% + 20p)';
const MEMBERSHIP_FEE_EXPLANATION =
  'The Hub fee covers platform and payment processing. Organisers receive 100% of the membership price they set.';
const MEMBERSHIP_CHECKOUT_TYPE = 'organiser_membership';

function roundMoney(amount) {
  return Math.round(Number(amount) * 100) / 100;
}

function poundsFromPence(pence) {
  return roundMoney((Number(pence) || 0) / 100);
}

function penceFromPounds(pounds) {
  return Math.max(0, Math.round((Number(pounds) || 0) * 100));
}

function normalizeInterval(raw) {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (v === 'month' || v === 'monthly') return 'month';
  if (v === 'year' || v === 'annual' || v === 'annually') return 'year';
  return '';
}

function calculateMembershipFeePounds(amountPounds) {
  const amount = Number(amountPounds) || 0;
  if (amount <= 0) return 0;
  return calculateBookingFee(amount, 1);
}

function calculateMembershipTotals(amountPounds) {
  const amount = roundMoney(Number(amountPounds) || 0);
  const fee = calculateMembershipFeePounds(amount);
  return {
    amount,
    fee,
    total: roundMoney(amount + fee),
    feeRate: BOOKING_FEE_RATE,
    feeFixed: BOOKING_FEE_PER_TICKET,
  };
}

/** Stripe application_fee_percent (2 d.p.) so Hub keeps the fee; organiser gets the membership price. */
function applicationFeePercentFromPence(membershipPence, feePence) {
  const mem = Math.max(0, Math.round(Number(membershipPence) || 0));
  const fee = Math.max(0, Math.round(Number(feePence) || 0));
  const total = mem + fee;
  if (total <= 0 || fee <= 0) return 0;
  return Math.round((fee / total) * 10000) / 100;
}

function planRowToClient(row) {
  if (!row) return null;
  const monthlyPence =
    row.monthly_amount_pence != null ? Math.round(Number(row.monthly_amount_pence)) : null;
  const annualPence =
    row.annual_amount_pence != null ? Math.round(Number(row.annual_amount_pence)) : null;
  const active = row.active !== false;
  const monthly =
    active && monthlyPence != null && monthlyPence >= 100
      ? {
          amountPence: monthlyPence,
          amountPounds: poundsFromPence(monthlyPence),
          ...calculateMembershipTotals(poundsFromPence(monthlyPence)),
          interval: 'month',
          label: 'Monthly',
        }
      : null;
  const annual =
    active && annualPence != null && annualPence >= 100
      ? {
          amountPence: annualPence,
          amountPounds: poundsFromPence(annualPence),
          ...calculateMembershipTotals(poundsFromPence(annualPence)),
          interval: 'year',
          label: 'Annually',
        }
      : null;
  return {
    id: row.id,
    organiserId: row.organiser_id,
    active,
    monthlyAmountPence: monthlyPence,
    annualAmountPence: annualPence,
    monthly,
    annual,
    offered: Boolean(monthly || annual),
    feeLabel: MEMBERSHIP_FEE_LABEL,
    feeExplanation: MEMBERSHIP_FEE_EXPLANATION,
    updatedAt: row.updated_at || null,
  };
}

async function getMembershipPlanForOrganiser(organiserId) {
  const orgId = String(organiserId || '').trim();
  if (!orgId) return null;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('organiser_membership_plans')
    .select('*')
    .eq('organiser_id', orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return planRowToClient(data);
}

async function upsertMembershipPlan(organiserId, payload) {
  const orgId = String(organiserId || '').trim();
  if (!orgId) {
    const err = new Error('missing_organiser_id');
    err.status = 400;
    throw err;
  }

  const sb = getSupabaseAdmin();
  const { data: existing, error: existingError } = await sb
    .from('organiser_membership_plans')
    .select('*')
    .eq('organiser_id', orgId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  const hasMonthlyKey =
    Object.prototype.hasOwnProperty.call(payload, 'monthlyAmountPounds') ||
    Object.prototype.hasOwnProperty.call(payload, 'monthly_amount_pounds') ||
    Object.prototype.hasOwnProperty.call(payload, 'clearMonthly');
  const hasAnnualKey =
    Object.prototype.hasOwnProperty.call(payload, 'annualAmountPounds') ||
    Object.prototype.hasOwnProperty.call(payload, 'annual_amount_pounds') ||
    Object.prototype.hasOwnProperty.call(payload, 'clearAnnual');

  const monthlyRaw = payload.monthlyAmountPounds ?? payload.monthly_amount_pounds;
  const annualRaw = payload.annualAmountPounds ?? payload.annual_amount_pounds;
  const clearMonthly =
    payload.clearMonthly === true ||
    (hasMonthlyKey && (monthlyRaw === '' || monthlyRaw === null));
  const clearAnnual =
    payload.clearAnnual === true ||
    (hasAnnualKey && (annualRaw === '' || annualRaw === null));

  let monthlyPence =
    existing?.monthly_amount_pence != null ? Math.round(Number(existing.monthly_amount_pence)) : null;
  let annualPence =
    existing?.annual_amount_pence != null ? Math.round(Number(existing.annual_amount_pence)) : null;

  if (clearMonthly) {
    monthlyPence = null;
  } else if (hasMonthlyKey && monthlyRaw != null && monthlyRaw !== '') {
    const pounds = Number(String(monthlyRaw).replace(/[£,\s]/g, ''));
    if (!Number.isFinite(pounds) || pounds < 1) {
      const err = new Error('invalid_monthly_amount');
      err.status = 400;
      throw err;
    }
    monthlyPence = penceFromPounds(pounds);
  }

  if (clearAnnual) {
    annualPence = null;
  } else if (hasAnnualKey && annualRaw != null && annualRaw !== '') {
    const pounds = Number(String(annualRaw).replace(/[£,\s]/g, ''));
    if (!Number.isFinite(pounds) || pounds < 1) {
      const err = new Error('invalid_annual_amount');
      err.status = 400;
      throw err;
    }
    annualPence = penceFromPounds(pounds);
  }

  const active =
    payload.active === false
      ? false
      : payload.active === true
        ? true
        : existing
          ? existing.active !== false
          : true;

  if (active && monthlyPence == null && annualPence == null) {
    const err = new Error('missing_membership_price');
    err.status = 400;
    throw err;
  }

  // Deactivate without wiping prices: keep last amounts so re-enabling is easy.
  if (!active && monthlyPence == null && annualPence == null && existing) {
    monthlyPence =
      existing.monthly_amount_pence != null
        ? Math.round(Number(existing.monthly_amount_pence))
        : null;
    annualPence =
      existing.annual_amount_pence != null
        ? Math.round(Number(existing.annual_amount_pence))
        : null;
  }

  if (!active && monthlyPence == null && annualPence == null) {
    // Nothing to store — treat as delete of offer.
    if (existing?.id) {
      const { error: delError } = await sb
        .from('organiser_membership_plans')
        .delete()
        .eq('id', existing.id);
      if (delError) throw new Error(delError.message);
      return null;
    }
    return null;
  }

  const now = new Date().toISOString();
  const row = {
    organiser_id: orgId,
    monthly_amount_pence: monthlyPence,
    annual_amount_pence: annualPence,
    active: active && (monthlyPence != null || annualPence != null),
    updated_at: now,
  };

  const { data, error } = await sb
    .from('organiser_membership_plans')
    .upsert(row, { onConflict: 'organiser_id' })
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return planRowToClient(data);
}

function amountPenceForInterval(plan, interval) {
  if (!plan || !plan.offered) return null;
  if (interval === 'month') return plan.monthly ? plan.monthly.amountPence : null;
  if (interval === 'year') return plan.annual ? plan.annual.amountPence : null;
  return null;
}

function periodEndDateString(subscription) {
  const ts = Number(subscription?.current_period_end);
  if (!Number.isFinite(ts) || ts <= 0) return null;
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function normalizeMeta(metadata) {
  return metadata && typeof metadata === 'object' ? metadata : {};
}

function isMembershipCheckoutMetadata(metadata) {
  const meta = normalizeMeta(metadata);
  return String(meta.checkout_type || '').trim() === MEMBERSHIP_CHECKOUT_TYPE;
}

async function applyMembershipSubscriptionToRoster({
  organiserId,
  email,
  name,
  attendeeId,
  subscriptionId,
  customerId,
  interval,
  amountPence,
  subscriptionStatus,
  expiresAt,
}) {
  const sb = getSupabaseAdmin();
  const orgId = String(organiserId || '').trim();
  const em = String(email || '')
    .trim()
    .toLowerCase();
  if (!orgId || !em) return { ok: false, reason: 'missing_identity' };

  const { data: existing, error: findError } = await sb
    .from('organiser_member_roster')
    .select('id, name, attendee_id')
    .eq('organiser_id', orgId)
    .ilike('email', em)
    .maybeSingle();
  if (findError) throw new Error(findError.message);

  const now = new Date().toISOString();
  const patch = {
    email: em,
    organiser_id: orgId,
    status: 'active',
    updated_at: now,
    stripe_subscription_id: subscriptionId || null,
    stripe_customer_id: customerId || null,
    billing_interval: interval || null,
    subscription_status: subscriptionStatus || null,
    membership_amount_pence: amountPence != null ? Math.round(Number(amountPence)) : null,
  };
  if (expiresAt) patch.expires_at = expiresAt;
  if (name) patch.name = String(name).trim();
  if (attendeeId) {
    patch.attendee_id = attendeeId;
    patch.claimed_at = now;
  } else if (existing?.attendee_id && !patch.attendee_id) {
    /* keep existing link */
  }

  if (existing?.id) {
    if (!patch.name && existing.name) delete patch.name;
    const { data, error } = await sb
      .from('organiser_member_roster')
      .update(patch)
      .eq('id', existing.id)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, created: false, row: data };
  }

  const { data, error } = await sb
    .from('organiser_member_roster')
    .insert({
      ...patch,
      name: patch.name || em.split('@')[0],
      created_at: now,
    })
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { ok: true, created: true, row: data };
}

async function syncRosterFromSubscription(subscription, options) {
  const opts = options || {};
  const meta = normalizeMeta(subscription?.metadata);
  if (!isMembershipCheckoutMetadata(meta) && !opts.force) {
    return { ok: false, skipped: true, reason: 'not_membership' };
  }

  const organiserId = String(meta.organiser_id || opts.organiserId || '').trim();
  const email = String(meta.attendee_email || meta.email || opts.email || '')
    .trim()
    .toLowerCase();
  const interval = normalizeInterval(meta.billing_interval || opts.interval);
  const amountPence =
    meta.membership_amount_pence != null
      ? Math.round(Number(meta.membership_amount_pence))
      : opts.amountPence != null
        ? Math.round(Number(opts.amountPence))
        : null;

  const status = String(subscription?.status || opts.subscriptionStatus || '').trim() || null;
  const canceled = status === 'canceled' || status === 'unpaid' || opts.deleted;
  let expiresAt = periodEndDateString(subscription);
  if (canceled && !expiresAt) {
    expiresAt = new Date().toISOString().slice(0, 10);
  }

  if (!organiserId || !email) {
    return { ok: false, skipped: true, reason: 'missing_metadata' };
  }

  const result = await applyMembershipSubscriptionToRoster({
    organiserId,
    email,
    name: meta.attendee_name || opts.name || '',
    attendeeId: meta.attendee_id || opts.attendeeId || null,
    subscriptionId: String(subscription?.id || '').trim() || null,
    customerId:
      typeof subscription?.customer === 'string'
        ? subscription.customer
        : String(subscription?.customer?.id || opts.customerId || '').trim() || null,
    interval: interval || null,
    amountPence,
    subscriptionStatus: canceled ? 'canceled' : status,
    expiresAt,
  });

  return { ok: true, ...result, canceled: Boolean(canceled) };
}

async function handleMembershipCheckoutCompleted(session) {
  const meta = normalizeMeta(session?.metadata);
  if (!isMembershipCheckoutMetadata(meta)) {
    return { ok: false, skipped: true, reason: 'not_membership' };
  }
  if (String(session?.mode || '').toLowerCase() !== 'subscription') {
    return { ok: false, skipped: true, reason: 'not_subscription' };
  }

  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : String(session.subscription?.id || '').trim();
  if (!subscriptionId) {
    return { ok: false, skipped: true, reason: 'missing_subscription' };
  }

  let subscription = session.subscription;
  if (!subscription || typeof subscription === 'string') {
    const { getStripeClient } = require('./stripe-checkout');
    const stripe = getStripeClient();
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
  }

  // Ensure metadata on the subscription for later invoice/subscription events.
  if (!isMembershipCheckoutMetadata(subscription.metadata)) {
    const { getStripeClient } = require('./stripe-checkout');
    const stripe = getStripeClient();
    subscription = await stripe.subscriptions.update(subscriptionId, {
      metadata: {
        ...normalizeMeta(subscription.metadata),
        ...meta,
      },
    });
  }

  return syncRosterFromSubscription(subscription, {
    email: meta.attendee_email || session.customer_email,
    name: meta.attendee_name,
    attendeeId: meta.attendee_id,
    interval: meta.billing_interval,
    amountPence: meta.membership_amount_pence,
  });
}

async function handleMembershipSubscriptionUpdated(subscription) {
  return syncRosterFromSubscription(subscription);
}

async function handleMembershipSubscriptionDeleted(subscription) {
  return syncRosterFromSubscription(subscription, { deleted: true });
}

async function handleMembershipInvoicePaid(invoice) {
  const subscriptionId =
    typeof invoice?.subscription === 'string'
      ? invoice.subscription
      : String(invoice?.subscription?.id || '').trim();
  if (!subscriptionId) return { ok: false, skipped: true, reason: 'no_subscription' };

  const meta = normalizeMeta(invoice?.subscription_details?.metadata || invoice?.metadata);
  if (!isMembershipCheckoutMetadata(meta)) {
    // Fall back to loading the subscription — invoice metadata may be empty.
    const { getStripeClient } = require('./stripe-checkout');
    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (!isMembershipCheckoutMetadata(subscription.metadata)) {
      return { ok: false, skipped: true, reason: 'not_membership' };
    }
    return syncRosterFromSubscription(subscription);
  }

  const { getStripeClient } = require('./stripe-checkout');
  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return syncRosterFromSubscription(subscription);
}

module.exports = {
  MEMBERSHIP_FEE_LABEL,
  MEMBERSHIP_FEE_EXPLANATION,
  MEMBERSHIP_CHECKOUT_TYPE,
  MEMBERSHIP_FEE_RATE: BOOKING_FEE_RATE,
  MEMBERSHIP_FEE_FIXED: BOOKING_FEE_PER_TICKET,
  poundsFromPence,
  penceFromPounds,
  normalizeInterval,
  calculateMembershipFeePounds,
  calculateMembershipTotals,
  applicationFeePercentFromPence,
  planRowToClient,
  getMembershipPlanForOrganiser,
  upsertMembershipPlan,
  amountPenceForInterval,
  isMembershipCheckoutMetadata,
  applyMembershipSubscriptionToRoster,
  syncRosterFromSubscription,
  handleMembershipCheckoutCompleted,
  handleMembershipSubscriptionUpdated,
  handleMembershipSubscriptionDeleted,
  handleMembershipInvoicePaid,
};
