#!/usr/bin/env node
/**
 * Stripe Dahlia invoice payloads keep the subscription on parent.subscription_details.
 * Sales targets and membership renewal must still see that id and metadata.
 *
 *   node scripts/test-stripe-invoice-parent.js
 */
const assert = require('assert');
const {
  invoiceSubscriptionId,
  invoiceSubscriptionMetadata,
  parseRevenueCategory,
} = require('../api/_lib/stripe-revenue');

const dahliaListingRenewal = {
  id: 'in_dahlia_listing',
  status: 'paid',
  billing_reason: 'subscription_cycle',
  amount_paid: 3000,
  metadata: {},
  parent: {
    type: 'subscription_details',
    subscription_details: {
      subscription: 'sub_listing',
      metadata: {
        checkout_type: 'opportunity_listing',
        opportunity_id: 'opp_1',
        billing_mode: 'monthly',
      },
    },
  },
};

assert.strictEqual(invoiceSubscriptionId(dahliaListingRenewal), 'sub_listing');
const listingMeta = invoiceSubscriptionMetadata(dahliaListingRenewal);
assert.strictEqual(listingMeta.checkout_type, 'opportunity_listing');
assert.strictEqual(listingMeta.opportunity_id, 'opp_1');

const legacy = {
  subscription: 'sub_legacy',
  subscription_details: { metadata: { checkout_type: 'organiser_membership' } },
  metadata: {},
};
assert.strictEqual(invoiceSubscriptionId(legacy), 'sub_legacy');
assert.strictEqual(invoiceSubscriptionMetadata(legacy).checkout_type, 'organiser_membership');

const sponsorship = {
  metadata: {},
  parent: {
    type: 'subscription_details',
    subscription_details: {
      subscription: 'sub_sponsor',
      metadata: { placement: 'city_partner', revenue_category: 'events' },
    },
  },
};
assert.strictEqual(invoiceSubscriptionId(sponsorship), 'sub_sponsor');
assert.strictEqual(parseRevenueCategory(invoiceSubscriptionMetadata(sponsorship)), 'events');

console.log('stripe invoice parent: ok');
