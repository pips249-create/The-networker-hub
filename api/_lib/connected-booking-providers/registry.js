/** Supported Connected checkout providers (adapters in ./adapters/). */

const CONNECTED_BOOKING_PROVIDERS = [
  {
    id: 'eventbrite',
    label: 'Eventbrite',
    status: 'beta',
    webhookPath: '/api/integrations/providers/eventbrite/webhook',
    docsHint:
      'Paste the webhook URL into Eventbrite Account settings → Webhooks (Payload URL, action order.placed). Link the Eventbrite event id on TNH.',
  },
  {
    id: 'ticket_tailor',
    label: 'Ticket Tailor',
    status: 'beta',
    webhookPath: '/api/integrations/providers/ticket_tailor/webhook',
    docsHint: 'Use the Ticket Tailor box office event id when linking.',
  },
  {
    id: 'luma',
    label: 'Luma',
    status: 'beta',
    webhookPath: '/api/integrations/providers/luma/webhook',
    docsHint: 'Use the Luma event api id (from lu.ma admin / API).',
  },
  {
    id: 'trybooking',
    label: 'TryBooking',
    status: 'beta',
    webhookPath: '/api/integrations/providers/trybooking/webhook',
    docsHint: 'Use the TryBooking event id from your booking admin.',
  },
  {
    id: 'own_site',
    label: 'Your own website',
    status: 'live',
    webhookPath: '/api/integrations/providers/own_site/webhook',
    docsHint:
      'Use your own booking/checkout URL on the listing. After each sale, POST JSON with TNH eventId, orderId, and email to your webhook URL (no Zapier).',
  },
  {
    id: 'custom',
    label: 'Custom (HMAC webhook)',
    status: 'live',
    webhookPath: '/api/integrations/booking',
    docsHint: 'Developer POST with X-Networker-Signature — advanced integrations.',
  },
];

const PROVIDER_IDS = new Set(CONNECTED_BOOKING_PROVIDERS.map((p) => p.id));

function isConnectedBookingProviderId(id) {
  return PROVIDER_IDS.has(String(id || '').trim().toLowerCase());
}

function getConnectedBookingProvider(id) {
  const key = String(id || '').trim().toLowerCase();
  return CONNECTED_BOOKING_PROVIDERS.find((p) => p.id === key) || null;
}

module.exports = {
  CONNECTED_BOOKING_PROVIDERS,
  isConnectedBookingProviderId,
  getConnectedBookingProvider,
};
