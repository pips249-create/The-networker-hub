/**
 * Business opportunity listing — monthly Stripe subscription lifecycle.
 */
const { getSupabaseAdmin } = require('./supabase');

function normalizeMeta(metadata) {
  return metadata && typeof metadata === 'object' ? metadata : {};
}

function isOpportunityListingMetadata(metadata) {
  const meta = normalizeMeta(metadata);
  return String(meta.checkout_type || '').trim() === 'opportunity_listing';
}

function subscriptionIdFromSession(session) {
  const sub = session?.subscription;
  if (typeof sub === 'string') return sub.trim();
  return String(sub?.id || '').trim();
}

async function resolveListingCheckoutSessionId(stripe, subscriptionId, opportunityId) {
  const subId = String(subscriptionId || '').trim();
  const oppId = String(opportunityId || '').trim();
  if (!stripe || !subId) return '';

  try {
    const bySub = await stripe.checkout.sessions.list({ subscription: subId, limit: 5 });
    for (const session of bySub.data || []) {
      if (!oppId || String(session.metadata?.opportunity_id || '').trim() === oppId) {
        return String(session.id || '').trim();
      }
    }
  } catch {
    /* fall through */
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subId);
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id || '';
    if (!customerId) return '';

    const byCustomer = await stripe.checkout.sessions.list({ customer: customerId, limit: 10 });
    for (const session of byCustomer.data || []) {
      if (String(session.metadata?.checkout_type || '').trim() !== 'opportunity_listing') continue;
      if (oppId && String(session.metadata?.opportunity_id || '').trim() !== oppId) continue;
      const sessionSub = subscriptionIdFromSession(session);
      if (!sessionSub || sessionSub === subId) return String(session.id || '').trim();
    }
  } catch {
    /* ignore */
  }

  return '';
}

function periodEndIso(subscription) {
  const top = Number(subscription?.current_period_end);
  let ts = Number.isFinite(top) && top > 0 ? top : 0;
  if (!ts) {
    const items = subscription?.items?.data;
    if (Array.isArray(items)) {
      for (const item of items) {
        const itemTs = Number(item?.current_period_end);
        if (Number.isFinite(itemTs) && itemTs > ts) ts = itemTs;
      }
    }
  }
  if (!ts) return null;
  return new Date(ts * 1000).toISOString();
}

async function syncListingFromSubscription(subscription, options) {
  options = options || {};
  const { activateOpportunityListingPayment, rowToListing } = require('./supabase-opportunities');
  const meta = normalizeMeta(subscription?.metadata);
  if (!isOpportunityListingMetadata(meta) && !options.forceBySubscriptionId) {
    return { skipped: true, reason: 'not_opportunity_listing' };
  }

  const subscriptionId = String(subscription?.id || '').trim();
  const opportunityId = String(meta.opportunity_id || options.opportunityId || '').trim();
  const sb = getSupabaseAdmin();

  let id = opportunityId;
  if (!id && subscriptionId) {
    try {
      const { data, error } = await sb
        .from('business_opportunities')
        .select('id')
        .eq('listing_stripe_subscription_id', subscriptionId)
        .maybeSingle();
      if (error && !/listing_stripe_subscription_id/i.test(error.message || '')) {
        throw new Error(error.message);
      }
      id = data?.id || '';
    } catch (lookupErr) {
      if (!/listing_stripe_subscription_id/i.test(lookupErr.message || '')) {
        throw lookupErr;
      }
    }
  }
  if (!id) return { skipped: true, reason: 'missing_opportunity_id' };

  const status = String(subscription?.status || '').toLowerCase();
  const periodEnd = periodEndIso(subscription);

  if (status === 'canceled' || status === 'incomplete_expired' || status === 'unpaid') {
    const now = new Date().toISOString();
    const { data, error } = await sb
      .from('business_opportunities')
      .update({
        listing_expires_at: now,
        updated_at: now,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, opportunityId: id, expired: true, listing: rowToListing(data) };
  }

  let sessionId = options.sessionId ? String(options.sessionId).trim() : '';
  if (!sessionId && subscriptionId) {
    const { getStripeClient } = require('./stripe-checkout');
    try {
      sessionId = await resolveListingCheckoutSessionId(getStripeClient(), subscriptionId, id);
    } catch {
      /* ignore */
    }
  }

  const listing = await activateOpportunityListingPayment(id, {
    sessionId: sessionId || null,
    subscriptionId,
    periodEndIso: periodEnd,
  });

  return {
    ok: true,
    opportunityId: id,
    listingExpiresAt: listing.listingExpiresAt,
    subscriptionId,
  };
}

async function handleOpportunityListingSubscriptionUpdated(subscription) {
  if (!isOpportunityListingMetadata(subscription?.metadata)) {
    const subId = String(subscription?.id || '').trim();
    if (!subId) return { skipped: true, reason: 'not_opportunity_listing' };
    return syncListingFromSubscription(subscription, { forceBySubscriptionId: true });
  }
  return syncListingFromSubscription(subscription);
}

async function handleOpportunityListingSubscriptionDeleted(subscription) {
  return syncListingFromSubscription(
    { ...subscription, status: 'canceled' },
    { forceBySubscriptionId: true }
  );
}

/**
 * Find the Stripe customer for a listing even when listing_stripe_subscription_id
 * was never persisted (schema-cache miss after the £30 checkout).
 */
async function resolveListingBillingCustomer(opportunity) {
  const { getStripeClient, retrieveCheckoutSession, isStripeCheckoutConfigured } = require('./stripe-checkout');
  if (!isStripeCheckoutConfigured() || !opportunity) return null;
  const stripe = getStripeClient();
  const oppId = String(opportunity.id || '').trim();

  const subId = String(
    opportunity.listingStripeSubscriptionId || opportunity.listing_stripe_subscription_id || ''
  ).trim();
  if (subId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subId);
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : String(subscription.customer?.id || '').trim();
      if (customerId) return { customerId, subscription, source: 'subscription' };
    } catch {
      /* fall through */
    }
  }

  const sessionId = String(
    opportunity.listingStripeSessionId || opportunity.listing_stripe_session_id || ''
  ).trim();
  if (sessionId) {
    try {
      const session = await retrieveCheckoutSession(sessionId);
      const customerId =
        typeof session.customer === 'string'
          ? session.customer
          : String(session.customer?.id || '').trim();
      let subscription = session.subscription;
      if (typeof subscription === 'string' && subscription) {
        try {
          subscription = await stripe.subscriptions.retrieve(subscription);
        } catch {
          subscription = null;
        }
      }
      if (customerId) return { customerId, subscription: subscription || null, source: 'session' };
    } catch {
      /* fall through */
    }
  }

  if (oppId) {
    try {
      const found = await stripe.subscriptions.search({
        query: "metadata['opportunity_id']:'" + oppId.replace(/'/g, '') + "' AND status:'active'",
        limit: 1,
      });
      const subscription = (found.data || [])[0];
      if (subscription) {
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : String(subscription.customer?.id || '').trim();
        if (customerId) return { customerId, subscription, source: 'metadata_search' };
      }
    } catch {
      /* Search API may be unavailable — sync path still searches by customer email */
    }
  }

  return null;
}

async function handleOpportunityListingInvoicePaid(invoice) {
  const meta = normalizeMeta(invoice?.subscription_details?.metadata || invoice?.metadata);
  const subId =
    typeof invoice?.subscription === 'string'
      ? invoice.subscription.trim()
      : String(invoice?.subscription?.id || '').trim();

  if (!isOpportunityListingMetadata(meta) && !subId) {
    return { skipped: true, reason: 'not_opportunity_listing' };
  }

  if (!subId) return { skipped: true, reason: 'missing_subscription' };

  const { getStripeClient } = require('./stripe-checkout');
  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subId);
  return syncListingFromSubscription(subscription, { forceBySubscriptionId: true });
}

module.exports = {
  isOpportunityListingMetadata,
  subscriptionIdFromSession,
  resolveListingCheckoutSessionId,
  periodEndIso,
  syncListingFromSubscription,
  handleOpportunityListingSubscriptionUpdated,
  handleOpportunityListingSubscriptionDeleted,
  handleOpportunityListingInvoicePaid,
  resolveListingBillingCustomer,
};
