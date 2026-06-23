const { getStripeSecretKey } = require('./stripe-checkout');

function stripeConfigStatus() {
  const secretKey = getStripeSecretKey();
  const hasStripeSecretKey = Boolean(secretKey);
  const hasStripeWebhookSecret = Boolean(String(process.env.STRIPE_WEBHOOK_SECRET || '').trim());
  const connectFlag = String(process.env.STRIPE_CONNECT_ENABLED || '').trim().toLowerCase();
  const stripeConnectEnabled =
    hasStripeSecretKey &&
    (connectFlag === '1' || connectFlag === 'true' || connectFlag === 'yes');

  let stripeMode = null;
  if (secretKey.startsWith('sk_test_')) stripeMode = 'test';
  else if (secretKey.startsWith('sk_live_')) stripeMode = 'live';

  return {
    hasStripeSecretKey,
    hasStripeWebhookSecret,
    stripeConnectEnabled,
    stripeMode,
    checkoutReady: hasStripeSecretKey && hasStripeWebhookSecret,
  };
}

module.exports = {
  stripeConfigStatus,
};
