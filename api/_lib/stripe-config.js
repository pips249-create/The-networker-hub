const { getStripeSecretKey } = require('./stripe-checkout');
const { DEFAULT_PUBLIC_SITE } = require('./hub-brand');

function stripeWebhookEndpointUrl() {
  const site = String(process.env.SITE_URL || DEFAULT_PUBLIC_SITE).replace(/\/$/, '');
  return `${site}/api/stripe-webhook`;
}

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
    webhookEndpointUrl: stripeWebhookEndpointUrl(),
    siteUrlUsesVercelPreviewHost: String(process.env.SITE_URL || '').includes(
      'the-networker-hub.vercel.app'
    ),
  };
}

module.exports = {
  stripeConfigStatus,
  stripeWebhookEndpointUrl,
};
