const Stripe = require('stripe');

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
        product_data: { name: 'Booking fee' },
        unit_amount: feePence,
      },
      quantity: 1,
    });
  }

  return stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: opts.email,
    client_reference_id: opts.clientReferenceId,
    metadata: {
      event_id: opts.eventId,
      ticket_id: opts.ticketId || '',
      attendee_email: opts.email || '',
      quantity: String(opts.qty || 1),
    },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    line_items: lineItems,
  });
}

module.exports = {
  getStripeSecretKey,
  isStripeCheckoutConfigured,
  createPaidCheckoutSession,
};
