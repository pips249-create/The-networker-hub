/**
 * Connected booking — platform Stripe subscriptions (Starter / Growth / Scale).
 */
const { newWebhookSecret } = require('./connected-booking-util');

function getSupabaseAdmin() {
  return require('./supabase').getSupabaseAdmin();
}
const { isSelfServeConnectedPlan } = require('./connected-booking-pricing');

const CONNECTED_BOOKING_CHECKOUT_TYPE = 'connected_booking';

function supabaseErrText(err) {
  if (!err) return '';
  return [err.message, err.details, err.hint, err.code].filter(Boolean).join(' ');
}

function isMissingStripeCustomerColumn(err) {
  return /connected_booking_stripe_customer_id|stripe_customer_id/i.test(supabaseErrText(err));
}

function normalizeMeta(metadata) {
  return metadata && typeof metadata === 'object' ? metadata : {};
}

function isConnectedBookingMetadata(metadata) {
  const meta = normalizeMeta(metadata);
  return String(meta.checkout_type || '').trim() === CONNECTED_BOOKING_CHECKOUT_TYPE;
}

function subscriptionIdFromSession(session) {
  const sub = session?.subscription;
  if (typeof sub === 'string') return sub.trim();
  return String(sub?.id || '').trim();
}

function customerIdFromSubscription(subscription) {
  const c = subscription?.customer;
  if (typeof c === 'string') return c.trim();
  return String(c?.id || '').trim();
}

function planFromMetadata(metadata) {
  const meta = normalizeMeta(metadata);
  const plan = String(meta.connected_booking_plan || meta.connectedBookingPlan || '').trim().toLowerCase();
  return isSelfServeConnectedPlan(plan) ? plan : '';
}

function accountIdFromMetadata(metadata) {
  const meta = normalizeMeta(metadata);
  return String(meta.organiser_account_id || meta.organiserAccountId || '').trim();
}

function mapSubscriptionStatusToAccount(subscriptionStatus) {
  const status = String(subscriptionStatus || '').trim().toLowerCase();
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'past_due') return 'past_due';
  if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
    return 'cancelled';
  }
  if (status === 'incomplete' || status === 'paused') return 'inactive';
  return 'inactive';
}

async function isConnectedCheckoutSessionPaid(session) {
  if (!session) return false;
  if (
    session.payment_status === 'paid' ||
    session.payment_status === 'no_payment_required' ||
    session.status === 'complete'
  ) {
    return true;
  }
  if (String(session.mode || '').trim() === 'subscription' && subscriptionIdFromSession(session)) {
    return true;
  }
  return false;
}

async function syncConnectedBookingAccountFromSubscription(subscription, options) {
  options = options || {};
  const meta = normalizeMeta(subscription?.metadata);
  const subscriptionId = String(subscription?.id || '').trim();
  let accountId = accountIdFromMetadata(meta);
  let plan = planFromMetadata(meta);

  const sb = getSupabaseAdmin();

  if (!accountId && subscriptionId) {
    const { data, error } = await sb
      .from('organiser_accounts')
      .select('id, connected_booking_plan')
      .eq('connected_booking_stripe_subscription_id', subscriptionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    accountId = data?.id || '';
    if (!plan && data?.connected_booking_plan) plan = String(data.connected_booking_plan).trim().toLowerCase();
  }

  if (!accountId) return { skipped: true, reason: 'missing_organiser_account_id' };
  if (!isConnectedBookingMetadata(meta) && !options.forceBySubscriptionId) {
    return { skipped: true, reason: 'not_connected_booking' };
  }
  if (!plan) return { skipped: true, reason: 'missing_plan' };

  const accountStatus = mapSubscriptionStatusToAccount(subscription?.status);
  const customerId = customerIdFromSubscription(subscription);

  const { data: existing, error: loadErr } = await sb
    .from('organiser_accounts')
    .select('id, connected_booking_webhook_secret, connected_booking_stripe_subscription_id')
    .eq('id', accountId)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!existing) return { skipped: true, reason: 'account_not_found' };

  const patch = {
    connected_booking_plan: plan,
    connected_booking_status: accountStatus,
    connected_booking_stripe_subscription_id: subscriptionId || null,
  };
  if (customerId) patch.connected_booking_stripe_customer_id = customerId;

  if (accountStatus === 'active' && !String(existing.connected_booking_webhook_secret || '').trim()) {
    patch.connected_booking_webhook_secret = newWebhookSecret();
  }

  const oldSubId = String(existing.connected_booking_stripe_subscription_id || '').trim();
  if (
    subscriptionId &&
    oldSubId &&
    oldSubId !== subscriptionId &&
    accountStatus === 'active' &&
    options.cancelPreviousSubscription !== false
  ) {
    try {
      const { getStripeClient } = require('./stripe-checkout');
      await getStripeClient().subscriptions.cancel(oldSubId);
    } catch (e) {
      console.warn('[connected-booking] cancel previous subscription failed', e?.message || e);
    }
  }

  let updated = null;
  let updErr = null;
  ({ data: updated, error: updErr } = await sb
    .from('organiser_accounts')
    .update(patch)
    .eq('id', accountId)
    .select('id, connected_booking_plan, connected_booking_status, connected_booking_stripe_subscription_id')
    .single());
  if (updErr && patch.connected_booking_stripe_customer_id && isMissingStripeCustomerColumn(updErr)) {
    delete patch.connected_booking_stripe_customer_id;
    ({ data: updated, error: updErr } = await sb
      .from('organiser_accounts')
      .update(patch)
      .eq('id', accountId)
      .select('id, connected_booking_plan, connected_booking_status, connected_booking_stripe_subscription_id')
      .single());
  }
  if (updErr) throw new Error(updErr.message);

  return {
    ok: true,
    organiserAccountId: updated.id,
    plan: updated.connected_booking_plan,
    status: updated.connected_booking_status,
    subscriptionId: updated.connected_booking_stripe_subscription_id,
    webhookSecretCreated: Boolean(patch.connected_booking_webhook_secret),
  };
}

async function handleConnectedBookingCheckoutCompleted(session) {
  const meta = normalizeMeta(session?.metadata);
  if (!isConnectedBookingMetadata(meta)) {
    return { skipped: true, reason: 'not_connected_booking' };
  }

  const paid = await isConnectedCheckoutSessionPaid(session);
  if (!paid) return { skipped: true, reason: 'payment_not_complete' };

  const { retrieveCheckoutSession, getStripeClient } = require('./stripe-checkout');
  let subscriptionId = subscriptionIdFromSession(session);
  let subscription = null;

  if (!subscriptionId && session.id) {
    try {
      const full = await retrieveCheckoutSession(session.id);
      subscriptionId = subscriptionIdFromSession(full);
      if (!meta.organiser_account_id && full.metadata) {
        Object.assign(meta, full.metadata);
      }
    } catch {
      /* ignore */
    }
  }

  if (subscriptionId) {
    try {
      subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
    } catch {
      subscription = { id: subscriptionId, metadata: meta, status: 'active' };
    }
  } else {
    subscription = { id: '', metadata: meta, status: 'active' };
  }

  return syncConnectedBookingAccountFromSubscription(subscription, { forceBySubscriptionId: true });
}

async function handleConnectedBookingSubscriptionUpdated(subscription) {
  if (!isConnectedBookingMetadata(subscription?.metadata)) {
    const subId = String(subscription?.id || '').trim();
    if (!subId) return { skipped: true, reason: 'not_connected_booking' };
    return syncConnectedBookingAccountFromSubscription(subscription, { forceBySubscriptionId: true });
  }
  return syncConnectedBookingAccountFromSubscription(subscription);
}

async function handleConnectedBookingSubscriptionDeleted(subscription) {
  return syncConnectedBookingAccountFromSubscription(
    { ...subscription, status: 'canceled' },
    { forceBySubscriptionId: true, cancelPreviousSubscription: false }
  );
}

async function handleConnectedBookingInvoicePaymentFailed(invoice) {
  const subId =
    typeof invoice?.subscription === 'string'
      ? invoice.subscription.trim()
      : String(invoice?.subscription?.id || '').trim();
  if (!subId) return { skipped: true, reason: 'missing_subscription' };

  const sb = getSupabaseAdmin();
  const { data: account, error } = await sb
    .from('organiser_accounts')
    .select('id')
    .eq('connected_booking_stripe_subscription_id', subId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!account?.id) return { skipped: true, reason: 'account_not_found' };

  const { error: updErr } = await sb
    .from('organiser_accounts')
    .update({ connected_booking_status: 'past_due' })
    .eq('id', account.id);
  if (updErr) throw new Error(updErr.message);
  return { ok: true, organiserAccountId: account.id, status: 'past_due' };
}

module.exports = {
  CONNECTED_BOOKING_CHECKOUT_TYPE,
  isConnectedBookingMetadata,
  subscriptionIdFromSession,
  handleConnectedBookingCheckoutCompleted,
  handleConnectedBookingSubscriptionUpdated,
  handleConnectedBookingSubscriptionDeleted,
  handleConnectedBookingInvoicePaymentFailed,
  syncConnectedBookingAccountFromSubscription,
};
