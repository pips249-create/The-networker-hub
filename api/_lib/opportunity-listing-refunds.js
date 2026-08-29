/**
 * Opportunity listing Stripe refunds — expire the directory listing and
 * cancel leftover subscriptions so a refunded £30 checkout cannot go live again.
 */

function getSupabaseAdmin() {
  return require('./supabase').getSupabaseAdmin();
}

function isFullyRefundedCharge(charge) {
  if (!charge || typeof charge !== 'object') return false;
  if (charge.refunded === true) return true;
  const paid = Number(charge.amount || 0);
  const refunded = Number(charge.amount_refunded || 0);
  return paid > 0 && refunded >= paid;
}

function isFullyRefundedPaymentIntent(paymentIntent) {
  if (!paymentIntent || typeof paymentIntent !== 'object') return false;
  const charge =
    paymentIntent.latest_charge && typeof paymentIntent.latest_charge === 'object'
      ? paymentIntent.latest_charge
      : null;
  if (charge) return isFullyRefundedCharge(charge);
  return false;
}

function isFullyRefundedInvoice(invoice) {
  if (!invoice || typeof invoice !== 'object') return false;
  const paid = Number(invoice.amount_paid || 0);
  const credited = Number(invoice.post_payment_credit_notes_amount || 0);
  if (paid > 0 && credited >= paid) return true;
  const charge = invoice.charge && typeof invoice.charge === 'object' ? invoice.charge : null;
  if (isFullyRefundedCharge(charge)) return true;
  const paymentIntent =
    invoice.payment_intent && typeof invoice.payment_intent === 'object'
      ? invoice.payment_intent
      : null;
  return isFullyRefundedPaymentIntent(paymentIntent);
}

function listingCheckoutLooksRefunded(session) {
  if (!session || typeof session !== 'object') return false;
  if (
    session.payment_intent &&
    typeof session.payment_intent === 'object' &&
    isFullyRefundedPaymentIntent(session.payment_intent)
  ) {
    return true;
  }
  if (session.invoice && typeof session.invoice === 'object' && isFullyRefundedInvoice(session.invoice)) {
    return true;
  }
  const subscription =
    session.subscription && typeof session.subscription === 'object' ? session.subscription : null;
  if (subscription) {
    const latest = subscription.latest_invoice;
    if (latest && typeof latest === 'object' && isFullyRefundedInvoice(latest)) return true;
  }
  return false;
}

async function hydrateListingCheckoutRefundFields(session) {
  if (!session || typeof session !== 'object') return session;
  const { getStripeClient, isStripeCheckoutConfigured } = require('./stripe-checkout');
  if (!isStripeCheckoutConfigured()) return session;

  const stripe = getStripeClient();
  const hydrated = Object.assign({}, session);

  let paymentIntent = session.payment_intent;
  if (typeof paymentIntent === 'string' && paymentIntent) {
    try {
      hydrated.payment_intent = await stripe.paymentIntents.retrieve(paymentIntent, {
        expand: ['latest_charge'],
      });
    } catch {
      /* keep id */
    }
  } else if (
    paymentIntent &&
    typeof paymentIntent === 'object' &&
    typeof paymentIntent.latest_charge === 'string' &&
    paymentIntent.latest_charge
  ) {
    try {
      hydrated.payment_intent = Object.assign({}, paymentIntent, {
        latest_charge: await stripe.charges.retrieve(paymentIntent.latest_charge),
      });
    } catch {
      /* keep partial */
    }
  }

  let invoice = session.invoice;
  if (typeof invoice === 'string' && invoice) {
    try {
      hydrated.invoice = await stripe.invoices.retrieve(invoice, {
        expand: ['charge', 'payment_intent.latest_charge'],
      });
    } catch {
      /* keep id */
    }
  }

  return hydrated;
}

async function isListingCheckoutSessionRefunded(session) {
  if (listingCheckoutLooksRefunded(session)) return true;
  const hydrated = await hydrateListingCheckoutRefundFields(session);
  return listingCheckoutLooksRefunded(hydrated);
}

async function isListingSubscriptionRefunded(subscription) {
  if (!subscription || typeof subscription !== 'object') return false;
  let invoice = subscription.latest_invoice;
  if (invoice && typeof invoice === 'object') {
    return isFullyRefundedInvoice(invoice);
  }
  if (typeof invoice !== 'string' || !invoice) return false;
  const { getStripeClient, isStripeCheckoutConfigured } = require('./stripe-checkout');
  if (!isStripeCheckoutConfigured()) return false;
  try {
    invoice = await getStripeClient().invoices.retrieve(invoice, {
      expand: ['charge', 'payment_intent.latest_charge'],
    });
    return isFullyRefundedInvoice(invoice);
  } catch {
    return false;
  }
}

function listingSubscriptionShouldExpire(subscription) {
  const status = String(subscription?.status || '').toLowerCase();
  return status === 'canceled' || status === 'incomplete_expired' || status === 'unpaid';
}

async function cancelOpenListingSubscription(subscriptionId, opportunityId) {
  const subId = String(subscriptionId || '').trim();
  const oppId = String(opportunityId || '').trim();
  if (!subId) return { canceled: false, reason: 'missing_subscription' };

  const { getStripeClient, isStripeCheckoutConfigured } = require('./stripe-checkout');
  if (!isStripeCheckoutConfigured()) return { canceled: false, reason: 'stripe_not_configured' };

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subId);
  const metaOpp = String(subscription?.metadata?.opportunity_id || '').trim();
  const metaType = String(subscription?.metadata?.checkout_type || '').trim();
  if (oppId && metaOpp && metaOpp !== oppId) {
    return { canceled: false, reason: 'opportunity_mismatch' };
  }
  if (metaType && metaType !== 'opportunity_listing') {
    return { canceled: false, reason: 'not_opportunity_listing' };
  }

  const status = String(subscription?.status || '').toLowerCase();
  if (status === 'canceled' || status === 'incomplete_expired') {
    return { canceled: false, alreadyCanceled: true };
  }
  if (!['active', 'trialing', 'past_due', 'unpaid', 'incomplete'].includes(status)) {
    return { canceled: false, reason: 'not_open', status };
  }

  await stripe.subscriptions.cancel(subId);
  return { canceled: true, subscriptionId: subId };
}

async function expireOpportunityListingForRefund(opportunityId, opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const id = String(opportunityId || '').trim();
  if (!id) return { skipped: true, reason: 'missing_opportunity_id' };

  const sb = getSupabaseAdmin();
  const { data: existing, error: loadErr } = await sb
    .from('business_opportunities')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!existing) return { skipped: true, reason: 'not_found' };

  const now = new Date().toISOString();
  const status = String(existing.status || '').toLowerCase();
  const patch = {
    listing_expires_at: now,
    featured: false,
    updated_at: now,
  };
  if (status === 'published' || status === 'live') {
    patch.status = 'unpublished';
  }

  const { data, error } = await sb
    .from('business_opportunities')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  const subId = String(
    options.subscriptionId || existing.listing_stripe_subscription_id || ''
  ).trim();
  let cancelResult = null;
  if (subId) {
    try {
      cancelResult = await cancelOpenListingSubscription(subId, id);
    } catch (cancelErr) {
      console.warn(
        '[opportunity] cancel leftover listing subscription after refund failed:',
        cancelErr && cancelErr.message ? cancelErr.message : cancelErr
      );
    }
  }

  const { rowToListing } = require('./supabase-opportunities');
  return {
    ok: true,
    refunded: true,
    expired: true,
    opportunityId: id,
    opportunity: rowToListing(data),
    subscriptionCanceled: Boolean(cancelResult && cancelResult.canceled),
  };
}

async function findOpportunityIdForListingCharge(charge) {
  if (!charge || typeof charge !== 'object') return '';

  const { isOpportunityListingMetadata } = require('./opportunity-listing-subscriptions');
  const directMeta = charge.metadata || {};
  if (isOpportunityListingMetadata(directMeta)) {
    return String(directMeta.opportunity_id || '').trim();
  }

  const { getStripeClient, isStripeCheckoutConfigured } = require('./stripe-checkout');
  if (!isStripeCheckoutConfigured()) return '';
  const stripe = getStripeClient();

  const paymentIntentId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id || '';

  if (paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      const piMeta = paymentIntent.metadata || {};
      if (isOpportunityListingMetadata(piMeta)) {
        return String(piMeta.opportunity_id || '').trim();
      }
    } catch {
      /* ignore */
    }
    try {
      const sessions = await stripe.checkout.sessions.list({
        payment_intent: paymentIntentId,
        limit: 5,
      });
      for (const session of sessions.data || []) {
        const meta = session.metadata || {};
        if (isOpportunityListingMetadata(meta)) {
          return String(meta.opportunity_id || '').trim();
        }
      }
    } catch {
      /* subscription checkouts may not list by payment_intent */
    }
  }

  const invoiceId =
    typeof charge.invoice === 'string' ? charge.invoice : charge.invoice?.id || '';
  if (!invoiceId) return '';

  try {
    const invoice = await stripe.invoices.retrieve(invoiceId);
    const invoiceMeta = invoice.metadata || invoice.subscription_details?.metadata || {};
    if (isOpportunityListingMetadata(invoiceMeta)) {
      return String(invoiceMeta.opportunity_id || '').trim();
    }
    const subId =
      typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription?.id || '';
    if (!subId) return '';

    const subscription = await stripe.subscriptions.retrieve(subId);
    const subMeta = subscription.metadata || {};
    if (isOpportunityListingMetadata(subMeta)) {
      return String(subMeta.opportunity_id || '').trim();
    }

    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('business_opportunities')
      .select('id')
      .eq('listing_stripe_subscription_id', subId)
      .maybeSingle();
    if (error && !/listing_stripe_subscription_id/i.test(error.message || '')) {
      throw new Error(error.message);
    }
    return String(data?.id || '').trim();
  } catch {
    return '';
  }
}

async function handleOpportunityListingChargeRefunded(charge) {
  if (!isFullyRefundedCharge(charge)) {
    return { skipped: true, reason: 'not_fully_refunded' };
  }

  const opportunityId = await findOpportunityIdForListingCharge(charge);
  if (!opportunityId) {
    return { skipped: true, reason: 'not_opportunity_listing' };
  }

  let subscriptionId = '';
  const invoiceId =
    typeof charge.invoice === 'string' ? charge.invoice : charge.invoice?.id || '';
  if (invoiceId) {
    try {
      const { getStripeClient, isStripeCheckoutConfigured } = require('./stripe-checkout');
      if (isStripeCheckoutConfigured()) {
        const invoice = await getStripeClient().invoices.retrieve(invoiceId);
        subscriptionId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id || '';
      }
    } catch {
      /* expire without cancel if invoice lookup fails */
    }
  }

  return expireOpportunityListingForRefund(opportunityId, { subscriptionId });
}

module.exports = {
  isFullyRefundedCharge,
  isFullyRefundedPaymentIntent,
  isFullyRefundedInvoice,
  listingCheckoutLooksRefunded,
  isListingCheckoutSessionRefunded,
  isListingSubscriptionRefunded,
  listingSubscriptionShouldExpire,
  cancelOpenListingSubscription,
  expireOpportunityListingForRefund,
  findOpportunityIdForListingCharge,
  handleOpportunityListingChargeRefunded,
};
