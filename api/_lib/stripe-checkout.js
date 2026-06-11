const Stripe = require('stripe');
const { BOOKING_FEE_NON_REFUNDABLE_NOTE } = require('./booking-fees');

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
      attendee_email: opts.email || '',
      attendee_name: opts.name || '',
      guest_names: JSON.stringify(opts.guestNames || []).slice(0, 500),
      quantity: String(opts.qty || 1),
    },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    line_items: lineItems,
  };

  if (opts.paymentIntentData && typeof opts.paymentIntentData === 'object') {
    sessionParams.payment_intent_data = opts.paymentIntentData;
  }

  return stripe.checkout.sessions.create(sessionParams);
}

function siteBaseUrl() {
  return String(process.env.SITE_URL || 'https://the-networker-hub.vercel.app').replace(/\/$/, '');
}

/**
 * Monthly premium business opportunity listing (£50/month subscription).
 */
async function createOpportunityPremiumCheckoutSession(opts) {
  const stripe = getStripeClient();
  const opportunityId = String(opts.opportunityId || '').trim();
  if (!opportunityId) throw new Error('missing_opportunity_id');

  const priceId = String(process.env.STRIPE_OPPORTUNITY_PREMIUM_PRICE_ID || '').trim();
  const lineItems = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: 'Premium business opportunity listing',
              description: 'Featured placement in the opportunities directory',
            },
            unit_amount: 5000,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
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

async function retrieveCheckoutSession(sessionId) {
  const stripe = getStripeClient();
  return stripe.checkout.sessions.retrieve(String(sessionId || '').trim(), {
    expand: ['subscription'],
  });
}

module.exports = {
  getStripeSecretKey,
  isStripeCheckoutConfigured,
  getStripeClient,
  createPaidCheckoutSession,
  createOpportunityPremiumCheckoutSession,
  retrieveCheckoutSession,
  siteBaseUrl,
};
