/**
 * Organiser membership dues billed through Hub Stripe Connect.
 * Members pay: membership (+ organiser VAT if added) + Hub fee (3%, VAT inclusive).
 * Organisers receive 100% of membership (+ any membership VAT they charge).
 * Tickets keep 4.5% + 20p; memberships use a simpler 3% all-in Hub fee.
 */
const { getSupabaseAdmin } = require('./supabase');

const ORGANISER_VAT_RATE = 0.2;
const MEMBERSHIP_HUB_FEE_RATE = 0.03;
const MEMBERSHIP_FEE_LABEL = 'Hub fee (3% incl. VAT)';
const MEMBERSHIP_FEE_EXPLANATION =
  'The Hub fee is 3% of the membership price you set (VAT inclusive). Organisers receive 100% of that membership price (and membership VAT if they add it).';
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

function normalizeVatTreatment(raw) {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  return v === 'added' ? 'added' : 'included';
}

function calculateMembershipFeePounds(amountPounds) {
  const amount = Number(amountPounds) || 0;
  if (amount <= 0) return 0;
  return roundMoney(amount * MEMBERSHIP_HUB_FEE_RATE);
}

/**
 * @param {number} amountPounds membership face price organiser set
 * @param {'included'|'added'} [vatTreatment]
 */
function calculateMembershipTotals(amountPounds, vatTreatment) {
  const amount = roundMoney(Number(amountPounds) || 0);
  const treatment = normalizeVatTreatment(vatTreatment);
  const membershipVat = treatment === 'added' ? roundMoney(amount * ORGANISER_VAT_RATE) : 0;
  const membershipGross = roundMoney(amount + membershipVat);
  const fee = calculateMembershipFeePounds(amount);
  return {
    amount,
    membershipVat,
    membershipGross,
    fee,
    feeVat: 0,
    hubGross: fee,
    total: roundMoney(membershipGross + fee),
    vatTreatment: treatment,
    feeRate: MEMBERSHIP_HUB_FEE_RATE,
    feeFixed: 0,
    vatRate: ORGANISER_VAT_RATE,
  };
}

/** Stripe application_fee_percent so Hub keeps the 3% fee; organiser gets membership (+ membership VAT). */
function applicationFeePercentFromPence(organiserPence, hubPence) {
  const org = Math.max(0, Math.round(Number(organiserPence) || 0));
  const hub = Math.max(0, Math.round(Number(hubPence) || 0));
  const total = org + hub;
  if (total <= 0 || hub <= 0) return 0;
  return Math.round((hub / total) * 10000) / 100;
}

function planIntervalClient(amountPence, vatTreatment, interval, label) {
  if (amountPence == null || amountPence < 100) return null;
  const totals = calculateMembershipTotals(poundsFromPence(amountPence), vatTreatment);
  return {
    amountPence,
    amountPounds: totals.amount,
    ...totals,
    interval,
    label,
  };
}

function planRowToClient(row) {
  if (!row) return null;
  const monthlyPence =
    row.monthly_amount_pence != null ? Math.round(Number(row.monthly_amount_pence)) : null;
  const annualPence =
    row.annual_amount_pence != null ? Math.round(Number(row.annual_amount_pence)) : null;
  const active = row.active !== false;
  const vatTreatment = normalizeVatTreatment(row.vat_treatment);
  const monthly =
    active && monthlyPence != null
      ? planIntervalClient(monthlyPence, vatTreatment, 'month', 'Monthly')
      : null;
  const annual =
    active && annualPence != null
      ? planIntervalClient(annualPence, vatTreatment, 'year', 'Annually')
      : null;
  return {
    id: row.id,
    organiserId: row.organiser_id,
    active,
    vatTreatment,
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

  const hasVatKey =
    Object.prototype.hasOwnProperty.call(payload, 'vatTreatment') ||
    Object.prototype.hasOwnProperty.call(payload, 'vat_treatment');
  const vatTreatment = hasVatKey
    ? normalizeVatTreatment(payload.vatTreatment ?? payload.vat_treatment)
    : normalizeVatTreatment(existing?.vat_treatment);

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
    vat_treatment: vatTreatment,
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

function periodEndTimestamp(subscription) {
  const top = Number(subscription?.current_period_end);
  if (Number.isFinite(top) && top > 0) return top;

  // Stripe API 2025-03-31+ (Basil): period lives on subscription items, not the subscription.
  const items = subscription?.items?.data;
  if (Array.isArray(items) && items.length) {
    let max = 0;
    for (const item of items) {
      const ts = Number(item?.current_period_end);
      if (Number.isFinite(ts) && ts > max) max = ts;
    }
    if (max > 0) return max;
  }
  return null;
}

function periodEndDateString(subscription) {
  const ts = periodEndTimestamp(subscription);
  if (!ts) return null;
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
    .select('id, name, attendee_id, subscription_status')
    .eq('organiser_id', orgId)
    .ilike('email', em)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  const previousSubscriptionStatus = String(existing?.subscription_status || '').trim() || null;

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
    return {
      ok: true,
      created: false,
      row: data,
      previousSubscriptionStatus,
    };
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
  return {
    ok: true,
    created: true,
    row: data,
    previousSubscriptionStatus: null,
  };
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
  let expiresAt = periodEndDateString(subscription) || opts.expiresAt || null;
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

  const nextStatus = canceled ? 'canceled' : status;
  const becamePastDue =
    nextStatus === 'past_due' && result.previousSubscriptionStatus !== 'past_due';
  if (becamePastDue && result.row) {
    notifyMembershipPaymentFailed({
      organiserId,
      email,
      memberName: result.row.name || meta.attendee_name || opts.name || '',
      expiresAt: result.row.expires_at || expiresAt,
    }).catch((err) => {
      console.error('[membership] payment_failed notify', err?.message || err);
    });
  }

  return { ok: true, ...result, canceled: Boolean(canceled), becamePastDue };
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

async function loadMembershipOrganiser(organiserId) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('organisers')
    .select('id, name, slug, photo_url, email, contact_email')
    .eq('id', String(organiserId || '').trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

function membershipManageUrl(organiserRow, site, email) {
  const { siteBase } = require('./hub-email-urls');
  const base = site || siteBase();
  return (
    base +
    '/login?email=' +
    encodeURIComponent(email) +
    '&next=' +
    encodeURIComponent('/account/#memberships')
  );
}

async function notifyMembershipPaymentFailed({ organiserId, email, memberName, expiresAt }) {
  const { sendTemplatedEmail } = require('./send-template-email');
  const {
    siteBase,
    hubAccountUrl,
    organiserPublicUrl,
    legalPolicyUrl,
    contactUrl,
    logoNavUrl,
    logoFooterUrl,
  } = require('./hub-email-urls');
  const { emailGreetingName } = require('./email-display-name');

  const organiser = await loadMembershipOrganiser(organiserId);
  if (!organiser) return { sent: false, reason: 'organiser_not_found' };
  const site = siteBase();
  const memberEmail = String(email || '')
    .trim()
    .toLowerCase();
  if (!memberEmail) return { sent: false, reason: 'missing_email' };

  const greetingName = emailGreetingName(memberName, memberEmail);
  const organiserName = String(organiser.name || 'your networking group').trim();
  const manageUrl = membershipManageUrl(organiser, site, memberEmail);
  // Keep this as one template literal — Vercel's bytecode compiler misparses
  // a string that starts with " while" after a multi-line `+` concatenation.
  const expiresLabel = expiresAt
    ? `Your membership stays active until ${String(expiresAt).slice(0, 10)} while Stripe retries the card.`
    : 'Update your card soon so your membership continues without interruption.';

  const common = {
    organiser_name: organiserName,
    organiser_url: organiserPublicUrl(organiser, site),
    hub_account_url: hubAccountUrl(site),
    site_url: site,
    logo_url: logoNavUrl(site),
    logo_footer_url: logoFooterUrl(site),
    privacy_url: legalPolicyUrl(site, 'privacy'),
    terms_url: legalPolicyUrl(site, 'terms'),
    contact_url: contactUrl(site),
    expires_note: expiresLabel,
  };

  await sendTemplatedEmail({
    slug: 'member_roster_payment_failed',
    to: memberEmail,
    variables: {
      ...common,
      user_name: greetingName,
      user_email: memberEmail,
      cta_url: manageUrl,
      cta_label: 'Update payment details',
    },
  });

  const organiserEmail = String(organiser.contact_email || organiser.email || '')
    .trim()
    .toLowerCase();
  if (organiserEmail && organiserEmail !== memberEmail) {
    await sendTemplatedEmail({
      slug: 'member_roster_payment_failed_organiser',
      to: organiserEmail,
      variables: {
        ...common,
        user_name: greetingName,
        user_email: memberEmail,
        member_name: greetingName,
        member_email: memberEmail,
        cta_url: site + '/organiser/#memberships?membershipGroup=' + encodeURIComponent(organiser.id),
        cta_label: 'Open membership',
      },
    });
  }

  return { sent: true };
}

async function sendMembershipRenewalReceipt({ invoice, subscription, rosterRow }) {
  const { sendTemplatedEmail } = require('./send-template-email');
  const {
    siteBase,
    hubAccountUrl,
    organiserPublicUrl,
    legalPolicyUrl,
    contactUrl,
    logoNavUrl,
    logoFooterUrl,
  } = require('./hub-email-urls');
  const { emailGreetingName } = require('./email-display-name');

  const meta = normalizeMeta(subscription?.metadata);
  const organiserId = String(meta.organiser_id || rosterRow?.organiser_id || '').trim();
  const email = String(meta.attendee_email || meta.email || rosterRow?.email || '')
    .trim()
    .toLowerCase();
  if (!organiserId || !email) return { sent: false, reason: 'missing_identity' };

  const organiser = await loadMembershipOrganiser(organiserId);
  if (!organiser) return { sent: false, reason: 'organiser_not_found' };

  const site = siteBase();
  const amountPaid = Number(invoice?.amount_paid);
  const amountLabel = Number.isFinite(amountPaid)
    ? '£' + (amountPaid / 100).toFixed(2).replace(/\.00$/, '')
    : '';
  const periodEnd = periodEndDateString(subscription);
  const reason = String(invoice?.billing_reason || '');
  const isRenewal = reason === 'subscription_cycle';
  const interval = normalizeInterval(meta.billing_interval || rosterRow?.billing_interval);
  const intervalLabel = interval === 'month' ? 'monthly' : interval === 'year' ? 'annual' : '';

  await sendTemplatedEmail({
    slug: 'member_roster_renewal_receipt',
    to: email,
    variables: {
      user_name: emailGreetingName(rosterRow?.name || meta.attendee_name, email),
      user_email: email,
      organiser_name: String(organiser.name || 'your networking group').trim(),
      organiser_url: organiserPublicUrl(organiser, site),
      amount_paid: amountLabel,
      billing_interval: intervalLabel,
      next_billing_date: periodEnd || '',
      receipt_intro: isRenewal
        ? 'Thanks — your membership renewal went through.'
        : 'Thanks — your membership payment went through.',
      period_note: periodEnd
        ? 'Your membership is current until ' + periodEnd + '.'
        : 'You can manage or cancel anytime from My Hub → Memberships.',
      cta_url: site + '/login?email=' + encodeURIComponent(email) + '&next=' + encodeURIComponent('/account/#memberships'),
      cta_label: 'Manage membership',
      hub_account_url: hubAccountUrl(site),
      site_url: site,
      logo_url: logoNavUrl(site),
      logo_footer_url: logoFooterUrl(site),
      privacy_url: legalPolicyUrl(site, 'privacy'),
      terms_url: legalPolicyUrl(site, 'terms'),
      contact_url: contactUrl(site),
    },
  });
  return { sent: true };
}

async function retrieveMembershipSubscription(subscriptionId) {
  const { getStripeClient } = require('./stripe-checkout');
  const stripe = getStripeClient();
  return stripe.subscriptions.retrieve(String(subscriptionId || '').trim());
}

async function handleMembershipInvoicePaid(invoice) {
  const subscriptionId =
    typeof invoice?.subscription === 'string'
      ? invoice.subscription
      : String(invoice?.subscription?.id || '').trim();
  if (!subscriptionId) return { ok: false, skipped: true, reason: 'no_subscription' };

  const meta = normalizeMeta(invoice?.subscription_details?.metadata || invoice?.metadata);
  let subscription;
  if (!isMembershipCheckoutMetadata(meta)) {
    subscription = await retrieveMembershipSubscription(subscriptionId);
    if (!isMembershipCheckoutMetadata(subscription.metadata)) {
      return { ok: false, skipped: true, reason: 'not_membership' };
    }
  } else {
    subscription = await retrieveMembershipSubscription(subscriptionId);
  }

  let invoicePeriodEnd = null;
  const lines = Array.isArray(invoice?.lines?.data) ? invoice.lines.data : [];
  let maxPeriod = 0;
  for (const line of lines) {
    const ts = Number(line?.period?.end);
    if (Number.isFinite(ts) && ts > maxPeriod) maxPeriod = ts;
  }
  if (maxPeriod > 0) {
    invoicePeriodEnd = new Date(maxPeriod * 1000).toISOString().slice(0, 10);
  }

  const result = await syncRosterFromSubscription(subscription, {
    expiresAt: invoicePeriodEnd,
  });
  const reason = String(invoice?.billing_reason || '');
  if (
    result.ok &&
    !result.skipped &&
    (reason === 'subscription_cycle' || reason === 'subscription_create')
  ) {
    sendMembershipRenewalReceipt({
      invoice,
      subscription,
      rosterRow: result.row,
    }).catch((err) => {
      console.error('[membership] renewal receipt', err?.message || err);
    });
  }
  return result;
}

async function handleMembershipInvoicePaymentFailed(invoice) {
  const subscriptionId =
    typeof invoice?.subscription === 'string'
      ? invoice.subscription
      : String(invoice?.subscription?.id || '').trim();
  if (!subscriptionId) return { ok: false, skipped: true, reason: 'no_subscription' };

  const subscription = await retrieveMembershipSubscription(subscriptionId);
  if (!isMembershipCheckoutMetadata(subscription.metadata)) {
    return { ok: false, skipped: true, reason: 'not_membership' };
  }
  // Force past_due sync even if Stripe still reports another status briefly.
  return syncRosterFromSubscription(subscription, {
    subscriptionStatus: String(subscription.status || 'past_due'),
  });
}

async function repairMembershipRosterExpiry(row, options) {
  const opts = options || {};
  const subId = String(row?.stripe_subscription_id || '').trim();
  if (!subId) return null;
  if (row.expires_at && !opts.force) return null;
  const subscription = await retrieveMembershipSubscription(subId);
  return syncRosterFromSubscription(subscription, {
    force: true,
    organiserId: row.organiser_id,
    email: row.email,
  });
}

module.exports = {
  ORGANISER_VAT_RATE,
  MEMBERSHIP_HUB_FEE_RATE,
  MEMBERSHIP_FEE_LABEL,
  MEMBERSHIP_FEE_EXPLANATION,
  MEMBERSHIP_CHECKOUT_TYPE,
  MEMBERSHIP_FEE_RATE: MEMBERSHIP_HUB_FEE_RATE,
  MEMBERSHIP_FEE_FIXED: 0,
  poundsFromPence,
  penceFromPounds,
  normalizeInterval,
  normalizeVatTreatment,
  calculateMembershipFeePounds,
  calculateMembershipTotals,
  applicationFeePercentFromPence,
  planRowToClient,
  getMembershipPlanForOrganiser,
  upsertMembershipPlan,
  amountPenceForInterval,
  periodEndDateString,
  isMembershipCheckoutMetadata,
  applyMembershipSubscriptionToRoster,
  syncRosterFromSubscription,
  repairMembershipRosterExpiry,
  handleMembershipCheckoutCompleted,
  handleMembershipSubscriptionUpdated,
  handleMembershipSubscriptionDeleted,
  handleMembershipInvoicePaid,
  handleMembershipInvoicePaymentFailed,
  notifyMembershipPaymentFailed,
  sendMembershipRenewalReceipt,
};
