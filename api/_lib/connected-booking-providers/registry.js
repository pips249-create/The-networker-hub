/** Supported Connected checkout providers (adapters in ./adapters/). */

/** Shown in organiser UI (picker tiles). Webhooks for other ids still work if already configured. */
const ORGANISER_PICKER_PROVIDER_IDS = [
  'eventbrite',
  'ticket_tailor',
  'trybooking',
  'own_site',
  'luma',
  'meetup',
];

const CONNECTED_BOOKING_PROVIDERS = [
  {
    id: 'eventbrite',
    label: 'Eventbrite',
    /** Live = choosable in organiser UI. Non-live appear greyed and cannot be enabled. */
    status: 'live',
    webhookPath: '/api/integrations/providers/eventbrite/webhook',
    docsHint:
      'Connect on My events (OAuth or private token). We import live Eventbrite events and sync ticket holders.',
    guidePath: '/guides/connect-eventbrite',
  },
  {
    id: 'ticket_tailor',
    label: 'Ticket Tailor',
    status: 'beta',
    webhookPath: '/api/integrations/providers/ticket_tailor/webhook',
    docsHint: 'Coming soon — Ticket Tailor will connect the same way as Eventbrite.',
    guidePath: '',
  },
  {
    id: 'trybooking',
    label: 'TryBooking',
    status: 'beta',
    webhookPath: '/api/integrations/providers/trybooking/webhook',
    docsHint: 'Coming soon — connect TryBooking when this tile unlocks.',
    guidePath: '',
  },
  {
    id: 'own_site',
    label: 'Your own website',
    status: 'live',
    webhookPath: '/api/integrations/providers/own_site/webhook',
    docsHint:
      'WordPress, Wix, or custom checkout — list on The Networker UK and POST bookings to your webhook URL.',
    guidePath: '/guides/connect-own-website',
  },
  {
    id: 'luma',
    label: 'Luma',
    status: 'beta',
    webhookPath: '/api/integrations/providers/luma/webhook',
    docsHint: 'Coming soon — Luma connect is not selectable yet.',
    guidePath: '',
  },
  {
    id: 'meetup',
    label: 'Meetup',
    status: 'beta',
    webhookPath: '/api/integrations/providers/meetup/webhook',
    docsHint: 'Coming soon — Meetup connect is not selectable yet.',
    guidePath: '',
  },
  {
    id: 'custom',
    label: 'Custom (HMAC webhook)',
    status: 'live',
    webhookPath: '/api/integrations/booking',
    docsHint: 'Developer POST with X-Networker-Signature — advanced integrations.',
    guidePath: '',
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
