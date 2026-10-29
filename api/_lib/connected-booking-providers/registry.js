/** Supported Connected checkout providers (adapters in ./adapters/). */

/** Shown in organiser UI (picker, enable, link form). Webhooks for other ids still work if already configured. */
const ORGANISER_PICKER_PROVIDER_IDS = ['eventbrite', 'ticket_tailor', 'own_site'];

const CONNECTED_BOOKING_PROVIDERS = [
  {
    id: 'eventbrite',
    label: 'Eventbrite',
    /** Live = choosable in organiser UI. Non-live appear greyed and cannot be enabled. */
    status: 'live',
    webhookPath: '/api/integrations/providers/eventbrite/webhook',
    docsHint:
      'Paste the webhook URL into Eventbrite Account settings → Webhooks (action order.placed) and save your private token. The token loads every ticket holder, including someone added after payment. Link the Eventbrite event id on TNH.',
  },
  {
    id: 'ticket_tailor',
    label: 'Ticket Tailor',
    status: 'beta',
    webhookPath: '/api/integrations/providers/ticket_tailor/webhook',
    docsHint:
      'Coming soon — Ticket Tailor connect is not selectable yet. Webhooks for already-configured accounts still work.',
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

function isOrganiserPickerProvider(id) {
  return ORGANISER_PICKER_PROVIDER_IDS.includes(String(id || '').trim().toLowerCase());
}

function isLiveConnectedBookingProvider(id) {
  const p = getConnectedBookingProvider(id);
  return Boolean(p && String(p.status || '').toLowerCase() === 'live');
}

function listOrganiserPickerProviders() {
  return CONNECTED_BOOKING_PROVIDERS.filter((p) => isOrganiserPickerProvider(p.id));
}

function listOrganiserSelectableProviders() {
  return listOrganiserPickerProviders().filter((p) => isLiveConnectedBookingProvider(p.id));
}

module.exports = {
  CONNECTED_BOOKING_PROVIDERS,
  ORGANISER_PICKER_PROVIDER_IDS,
  isConnectedBookingProviderId,
  getConnectedBookingProvider,
  isOrganiserPickerProvider,
  isLiveConnectedBookingProvider,
  listOrganiserPickerProviders,
  listOrganiserSelectableProviders,
};
