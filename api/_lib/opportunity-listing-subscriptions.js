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
    const { data, error } = await sb
      .from('business_opportunities')
      .select('id')
      .eq('listing_stripe_subscription_id', subscriptionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    id = data?.id || '';
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

  const listing = await activateOpportunityListingPayment(id, {
    sessionId: options.sessionId || null,
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
  periodEndIso,
  syncListingFromSubscription,
  handleOpportunityListingSubscriptionUpdated,
  handleOpportunityListingSubscriptionDeleted,
  handleOpportunityListingInvoicePaid,
};
