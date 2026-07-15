const Stripe = require('stripe');
const { BOOKING_FEE_NON_REFUNDABLE_NOTE } = require('./booking-fees');
const {
  calculateOpportunityListingTotals,
  normalizeListingMonths,
} = require('./opportunity-listing-pricing');
const { getCatalogPriceId } = require('./hub-stripe-catalog');

function getStripeSecretKey() {
  return String(process.env.STRIPE_SECRET_KEY || '').trim();
}

function isStripeCheckoutConfigured() {
  return Boolean(getStripeSecretKey());
}

let client = null;

function getStripeClient() {
  const key = getStripeSecretKey();
  if (!key) throw new Error('stripe_not_configured');
  if (!client) client = new Stripe(key);
  return client;
}

/**
 * Checkout with ticket line item(s) plus a separate booking-fee line item.
 */
async function createPaidCheckoutSession(opts) {
  const stripe = getStripeClient();
  const qty = opts.qty || 1;
  const unitAmount = Math.round((Number(opts.unitPricePounds) || 0) * 100);
  if (unitAmount <= 0) throw new Error('invalid_ticket_price');

  const lineItems = [
    {
      price_data: {
        currency: 'gbp',
        product_data: {
          name: `${opts.eventTitle || 'Event'} — ${opts.ticketName || 'Ticket'}`,
        },
        unit_amount: unitAmount,
      },
      quantity: qty,
    },
  ];

  const feePence = Math.round((Number(opts.bookingFeePounds) || 0) * 100);
  if (feePence > 0) {
    lineItems.push({
      price_data: {
        currency: 'gbp',
        product_data: {
          name: 'Booking fee',
          description: BOOKING_FEE_NON_REFUNDABLE_NOTE,
        },
        unit_amount: feePence,
      },
      quantity: 1,
    });
  }

  const sessionParams = {
    mode: 'payment',
    customer_email: opts.email,
    client_reference_id: opts.clientReferenceId,
    metadata: {
      event_id: opts.eventId,
      ticket_id: opts.ticketId || '',
      registration_id: opts.registrationId || '',
      attendee_email: opts.email || '',
      attendee_name: opts.name || '',
      guest_names: JSON.stringify(opts.guestNames || []).slice(0, 500),
      dietary_requirements: String(opts.dietaryRequirements || '').trim().slice(0, 500),
      accessibility_requirements: String(opts.accessibilityRequirements || '').trim().slice(0, 500),
      alumni_invite_token: String(opts.alumniInviteToken || '').trim().slice(0, 120),
      quantity: String(opts.qty || 1),
    },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    line_items: lineItems,
  };

  if (opts.paymentIntentData && typeof opts.paymentIntentData === 'object') {
    sessionParams.payment_intent_data = opts.paymentIntentData;
  }

  const stripeAccountId = String(opts.stripeAccountId || '').trim();
  if (stripeAccountId) {
    return stripe.checkout.sessions.create(sessionParams, { stripeAccount: stripeAccountId });
  }

  return stripe.checkout.sessions.create(sessionParams);
}

function siteBaseUrl() {
  return String(process.env.SITE_URL || 'https://the-networker-hub.vercel.app').replace(/\/$/, '');
}

function lineItemFromCatalog(catalogKey, fallbackPriceData) {
  const priceId = getCatalogPriceId(catalogKey);
  if (priceId) return { price: priceId, quantity: 1 };
  return { price_data: fallbackPriceData, quantity: 1 };
}

/**
 * Prepaid business opportunity listing (£25/month ex VAT, minimum 3 months).
 */
async function createOpportunityListingCheckoutSession(opts) {
  const stripe = getStripeClient();
  const opportunityId = String(opts.opportunityId || '').trim();
  const months = normalizeListingMonths(opts.months);
  if (!opportunityId) throw new Error('missing_opportunity_id');

  const totals = calculateOpportunityListingTotals(months);
  const title = String(opts.opportunityTitle || 'Business opportunity').trim();

  return stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: opts.email,
    client_reference_id: 'opp-listing-' + opportunityId + '-' + months + 'm',
    metadata: {
      opportunity_id: opportunityId,
      checkout_type: 'opportunity_listing',
      listing_months: String(months),
      owner_email: String(opts.email || '').toLowerCase(),
    },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    line_items: [
      {
        price_data: {
          currency: 'gbp',
          product_data: {
            name: 'Business opportunity listing — ' + months + ' months',
            description:
              'Directory listing for "' +
              title +
              '" on The Networker Hub (£25/month ex VAT)',
          },
          unit_amount: totals.subtotalExVatPence,
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: 'gbp',
          product_data: {
            name: 'VAT (20%)',
            description: months + ' months listing VAT',
          },
          unit_amount: totals.vatPence,
        },
        quantity: 1,
      },
    ],
  });
}

/**
 * Monthly premium business opportunity listing (£55/month subscription).
 */
async function createOpportunityPremiumCheckoutSession(opts) {
  const stripe = getStripeClient();
  const opportunityId = String(opts.opportunityId || '').trim();
  if (!opportunityId) throw new Error('missing_opportunity_id');

  const priceId = getCatalogPriceId('opportunity_premium');
  const lineItems = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [
        lineItemFromCatalog('opportunity_premium', {
          currency: 'gbp',
          product_data: {
            name: 'Premium business opportunity listing',
            description: 'Featured placement in the opportunities directory',
          },
          unit_amount: 5500,
          recurring: { interval: 'month' },
        }),
      ];

  return stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: opts.email,
    client_reference_id: 'opp-premium-' + opportunityId,
    metadata: {
      opportunity_id: opportunityId,
      checkout_type: 'opportunity_premium',
      owner_email: String(opts.email || '').toLowerCase(),
    },
    subscription_data: {
      metadata: {
        opportunity_id: opportunityId,
        checkout_type: 'opportunity_premium',
      },
    },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    line_items: lineItems,
  });
}

async function retrieveCheckoutSession(sessionId, options = {}) {
  const stripe = getStripeClient();
  const id = String(sessionId || '').trim();
  const params = { expand: ['subscription'] };
  const stripeAccountId = String(options.stripeAccountId || '').trim();
  if (stripeAccountId) {
    return stripe.checkout.sessions.retrieve(id, params, { stripeAccount: stripeAccountId });
  }
  return stripe.checkout.sessions.retrieve(id, params);
}

const { FEATURED_PLANS, normalizePlanId } = require('./event-featured-plans');
const {
  calculateCityPartnerQuote,
  listCityPartnerRegions,
} = require('./networking-city-partners');

/**
 * One-off featured event listing (£55/month).
 */
async function createEventFeaturedCheckoutSession(opts) {
  const stripe = getStripeClient();
  const eventId = String(opts.eventId || '').trim();
  const planId = normalizePlanId(opts.planId);
  if (!eventId) throw new Error('missing_event_id');
  if (!planId) throw new Error('invalid_plan');

  const plan = FEATURED_PLANS[planId];
  const eventTitle = String(opts.eventTitle || 'Event').trim();

  return stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: opts.email,
    client_reference_id: 'event-featured-' + eventId + '-' + planId,
    metadata: {
      event_id: eventId,
      featured_plan: planId,
      checkout_type: 'event_featured',
      owner_email: String(opts.email || '').toLowerCase(),
    },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    line_items: [
      planId === '1month'
        ? lineItemFromCatalog('event_featured_1month', {
            currency: 'gbp',
            product_data: {
              name: 'Featured event listing — ' + plan.label,
              description: 'Premium spotlight placement for "' + eventTitle + '"',
            },
            unit_amount: plan.amountPence,
          })
        : {
            price_data: {
              currency: 'gbp',
              product_data: {
                name: 'Featured event listing — ' + plan.label,
                description: 'Premium spotlight placement for "' + eventTitle + '"',
              },
              unit_amount: plan.amountPence,
            },
            quantity: 1,
          },
    ],
  });
}

/**
 * City Partner subscription — auto-bundles every 3 cities at the pack rate.
 */
async function createCityPartnerCheckoutSession(opts) {
  const stripe = getStripeClient();
  const cities = Array.isArray(opts.cities) ? opts.cities : [];
  if (!cities.length) throw new Error('missing_cities');

  const quote = calculateCityPartnerQuote(cities.length);
  const cityNames = cities
    .map((slug) => {
      const match = listCityPartnerRegions().find((r) => r.slug === slug);
      return match ? match.name : slug;
    })
    .join(', ');

  const lineItems = [];
  const pricing = quote.pricing;
  const launchNote = quote.isLaunch ? ' Launch rate until 1 Dec 2026.' : '';

  if (quote.bundles > 0) {
    lineItems.push({
      price_data: {
        currency: 'gbp',
        product_data: {
          name: 'City Partner — 3-city pack',
          description:
            'Logo + CTA on three regional networking pages. Website only — not in hub emails.' +
            launchNote,
        },
        unit_amount: pricing.bundle3MonthlyPence,
        recurring: { interval: 'month' },
      },
      quantity: quote.bundles,
    });
  }

  if (quote.singles > 0) {
    lineItems.push({
      price_data: {
        currency: 'gbp',
        product_data: {
          name: 'City Partner — single city',
          description:
            'Logo + CTA on one regional networking page. Website only — not in hub emails.' +
            launchNote,
        },
        unit_amount: pricing.singleMonthlyPence,
        recurring: { interval: 'month' },
      },
      quantity: quote.singles,
    });
  }

  const metadata = {
    checkout_type: 'hub_sponsorship',
    revenue_category: 'events',
    placement: 'city_partner',
    networking_cities: cities.join(','),
    package_name: 'City Partner — ' + cityNames,
    city_partner_bundles: String(quote.bundles),
    city_partner_singles: String(quote.singles),
  };

  return stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: opts.email,
    client_reference_id: 'city-partner-' + cities.join('-').slice(0, 120),
    metadata,
    subscription_data: { metadata },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    line_items: lineItems,
  });
}

module.exports = {
  getStripeSecretKey,
  isStripeCheckoutConfigured,
  getStripeClient,
  createPaidCheckoutSession,
  createOpportunityListingCheckoutSession,
  createOpportunityPremiumCheckoutSession,
  createEventFeaturedCheckoutSession,
  createCityPartnerCheckoutSession,
  retrieveCheckoutSession,
  siteBaseUrl,
};
