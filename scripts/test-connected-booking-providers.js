#!/usr/bin/env node
const assert = require('assert');
const { normalizeEventbriteWebhook } = require('../api/_lib/connected-booking-providers/adapters/eventbrite');
const { normalizeTicketTailorWebhook } = require('../api/_lib/connected-booking-providers/adapters/ticket-tailor');
const { normalizeLumaWebhook } = require('../api/_lib/connected-booking-providers/adapters/luma');
const { normalizeTryBookingWebhook } = require('../api/_lib/connected-booking-providers/adapters/trybooking');
const { normalizeOwnSiteWebhook } = require('../api/_lib/connected-booking-providers/adapters/own-site');
const { isConnectedBookingProviderId, CONNECTED_BOOKING_PROVIDERS } = require('../api/_lib/connected-booking-providers');
const {
  normalizeExternalBookingUrl,
  preferEventbriteCheckoutUrl,
  parseEventbriteEventIdFromUrl,
  guessProviderExternalEventId,
  validateProviderExternalEventId,
  publicListingUsesExternalBooking,
} = require('../api/_lib/connected-booking-util');
const {
  buildProviderWebhookPublicUrl,
  eventbriteSafeUrlLength,
  parseShortWebhookRoute,
  webhookPublicSite,
  WEBHOOK_TOKEN_HEX_LEN,
} = require('../api/_lib/provider-webhook-url');

const ebUrl = buildProviderWebhookPublicUrl(
  'https://www.thenetworkeruk.com',
  'eventbrite',
  'a'.repeat(WEBHOOK_TOKEN_HEX_LEN)
);
assert.strictEqual(webhookPublicSite('https://thenetworkeruk.com'), 'https://www.thenetworkeruk.com');
assert.strictEqual(webhookPublicSite('https://www.thenetworkeruk.com'), 'https://www.thenetworkeruk.com');
assert.ok(ebUrl.includes('/w/eb/'), ebUrl);
assert.ok(ebUrl.startsWith('https://www.thenetworkeruk.com/'), ebUrl);
assert.ok(eventbriteSafeUrlLength(ebUrl), 'Eventbrite URL length ' + ebUrl.length);

assert.deepStrictEqual(
  parseShortWebhookRoute({ url: '/w/eb/' + 'b'.repeat(WEBHOOK_TOKEN_HEX_LEN) }),
  { provider: 'eventbrite', token: 'b'.repeat(WEBHOOK_TOKEN_HEX_LEN) }
);
assert.deepStrictEqual(
  parseShortWebhookRoute({ url: '/api/w/eb/' + 'c'.repeat(WEBHOOK_TOKEN_HEX_LEN) }),
  { provider: 'eventbrite', token: 'c'.repeat(WEBHOOK_TOKEN_HEX_LEN) }
);

assert.strictEqual(publicListingUsesExternalBooking({ checkout_mode: 'external_connected' }), true);
assert.strictEqual(
  publicListingUsesExternalBooking({
    checkout_mode: 'hub',
    external_booking_url: 'https://www.eventbrite.co.uk/e/foo-1234567890123',
    external_price_label: 'Free',
  }),
  true
);
assert.strictEqual(publicListingUsesExternalBooking({ checkout_mode: 'hub' }), false);

const { webhookTokenPreviousFromConfig } = require('../api/_lib/connected-booking-provider-store');
assert.strictEqual(
  webhookTokenPreviousFromConfig({ webhookTokenPrevious: 'abc' }),
  'abc'
);

assert.strictEqual(isConnectedBookingProviderId('eventbrite'), true);
assert.strictEqual(isConnectedBookingProviderId('nope'), false);
assert.ok(CONNECTED_BOOKING_PROVIDERS.length >= 5);

const eb = normalizeEventbriteWebhook({
  api_url: 'https://www.eventbrite.com/api/v3/events/123456789/',
  config: { action: 'order.placed' },
  resource: {
    id: '987654321',
    email: 'buyer@example.com',
    name: 'Alex',
    event_id: '123456789',
    costs: { gross: { value: 1500 } },
  },
});
assert.strictEqual(eb.externalEventId, '123456789');
assert.strictEqual(eb.email, 'buyer@example.com');
assert.ok(eb.orderId.startsWith('eventbrite-'));

const ebPing = normalizeEventbriteWebhook({
  api_url: 'https://www.eventbriteapi.com/v3/orders/12826552624/',
  config: { action: 'order.placed', endpoint_url: 'https://thenetworkeruk.com/w/eb/test' },
});
assert.ok(ebPing && ebPing.partial, 'Eventbrite order.placed payload is partial without API fetch');

const {
  isEventbriteOrderNotification,
  isEventbriteConnectivityPing,
} = require('../api/_lib/eventbrite-webhook-resolve');
const orderHook = {
  api_url: 'https://www.eventbriteapi.com/v3/orders/12826552624/',
  config: { action: 'order.placed' },
};
assert.ok(isEventbriteOrderNotification(orderHook));
assert.ok(!isEventbriteConnectivityPing(orderHook, ebPing));

const orderHookNoAction = {
  api_url: 'https://www.eventbriteapi.com/v3/orders/12826552624/',
  config: { endpoint_url: 'https://www.thenetworkeruk.com/w/eb/test' },
};
const orderHookNoActionNorm = normalizeEventbriteWebhook(orderHookNoAction);
assert.ok(isEventbriteOrderNotification(orderHookNoAction), 'order api_url without config.action');
assert.ok(
  !isEventbriteConnectivityPing(orderHookNoAction, orderHookNoActionNorm),
  'order webhook must not be treated as connectivity ping'
);

const {
  normalizeEventbriteOrderApiResponse,
  eventbriteAttendeesFromOrder,
} = require('../api/_lib/connected-booking-providers/adapters/eventbrite-api');
const orderRows = normalizeEventbriteOrderApiResponse({
  id: '12826552624',
  event_id: '2001520723363',
  attendees: [{ id: 'att-1', profile: { email: 'buyer@example.com', name: 'Alex Buyer' } }],
  costs: { gross: { value: 0 } },
});
assert.strictEqual(orderRows.length, 1);
assert.strictEqual(orderRows[0].email, 'buyer@example.com');
assert.strictEqual(orderRows[0].externalEventId, '2001520723363');

const paginatedAttendees = normalizeEventbriteOrderApiResponse({
  id: '99',
  event_id: '2002045983430',
  email: 'fallback@example.com',
  attendees: {
    pagination: { object_count: 1, has_more_items: false },
    attendees: [{ id: 'a1', profile: { email: 'nested@example.com' } }],
  },
});
assert.strictEqual(paginatedAttendees.length, 1);
assert.strictEqual(paginatedAttendees[0].email, 'nested@example.com');
assert.deepStrictEqual(
  eventbriteAttendeesFromOrder({
    attendees: { attendees: [{ id: 'x' }] },
  }).map(function (a) {
    return a.id;
  }),
  ['x']
);

assert.strictEqual(
  parseEventbriteEventIdFromUrl('https://www.eventbrite.co.uk/e/networking-night-1234567890123'),
  '1234567890123'
);
assert.strictEqual(
  preferEventbriteCheckoutUrl('https://www.eventbrite.co.uk/e/networking-night-1234567890123'),
  'https://www.eventbrite.co.uk/checkout-external?eid=1234567890123'
);
assert.strictEqual(
  normalizeExternalBookingUrl('https://www.eventbrite.com/e/foo-9998887776665'),
  'https://www.eventbrite.com/checkout-external?eid=9998887776665'
);
assert.strictEqual(
  normalizeExternalBookingUrl('https://www.eventbrite.co.uk/checkout-external?eid=123'),
  'https://www.eventbrite.co.uk/checkout-external?eid=123'
);
assert.strictEqual(
  guessProviderExternalEventId('eventbrite', 'https://www.eventbrite.co.uk/e/foo-1234567890123'),
  '1234567890123'
);
assert.strictEqual(
  parseEventbriteEventIdFromUrl('https://www.eventbrite.co.uk/e/2001520723363?aff=oddtdtcreator'),
  '2001520723363'
);
assert.strictEqual(
  guessProviderExternalEventId('eventbrite', 'https://www.eventbrite.co.uk/e/2001520723363'),
  '2001520723363'
);
assert.strictEqual(
  guessProviderExternalEventId('luma', 'https://lu.ma/my-networking-night'),
  'my-networking-night'
);
assert.strictEqual(
  guessProviderExternalEventId('ticket_tailor', 'https://www.tickettailor.com/events/my-show/'),
  'my-show'
);
assert.strictEqual(validateProviderExternalEventId('ticket_tailor', 'ev_40980').ok, true);
assert.strictEqual(validateProviderExternalEventId('ticket_tailor', 'my-show').ok, false);
assert.strictEqual(validateProviderExternalEventId('eventbrite', '2001520723363').ok, true);

const tt = normalizeTicketTailorWebhook({
  payload: {
    event_id: 'ev-1',
    id: 'ord-9',
    email: 't@example.com',
    total: 12.5,
  },
});
assert.strictEqual(tt.externalEventId, 'ev-1');
assert.strictEqual(tt.email, 't@example.com');

const ttOfficial = normalizeTicketTailorWebhook({
  id: 'wh_15',
  event: 'ORDER.CREATED',
  resource_url: 'https://api.tickettailor.com/v1/orders/or_737352',
  payload: {
    object: 'order',
    id: 'or_737352',
    status: 'completed',
    buyer_details: {
      email: 'john@example.com',
      name: 'John Doe',
    },
    currency: { base_multiplier: 100, code: 'gbp' },
    total_paid: 2500,
    event_summary: { event_id: 'ev_40980', name: 'Festival' },
    line_items: [{ type: 'ticket', quantity: 2, total: 2500 }],
  },
});
assert.strictEqual(ttOfficial.externalEventId, 'ev_40980');
assert.strictEqual(ttOfficial.email, 'john@example.com');
assert.strictEqual(ttOfficial.orderId, 'ticket-tailor-or_737352');
assert.strictEqual(ttOfficial.quantity, 2);
assert.strictEqual(ttOfficial.amountPaid, 25);

const luma = normalizeLumaWebhook({
  data: { event: { id: 'lu-1' }, registration_id: 'reg-1', email: 'l@example.com' },
});
assert.strictEqual(luma.externalEventId, 'lu-1');

const tb = normalizeTryBookingWebhook({
  data: { event_id: 'tb-1', booking_id: 'b-1', email: 'try@example.com' },
});
assert.strictEqual(tb.externalEventId, 'tb-1');

const own = normalizeOwnSiteWebhook({
  eventId: '00000000-0000-4000-8000-000000000001',
  orderId: 'site-42',
  email: 'own@example.com',
  name: 'Sam',
  amountPaid: 10,
});
assert.strictEqual(own.tnhEventId, '00000000-0000-4000-8000-000000000001');
assert.ok(own.orderId.startsWith('own-site-'));

const {
  mapEventbriteEventToListingPatch,
  eventbriteIsOnline,
} = require('../api/_lib/connected-booking-providers/adapters/eventbrite-api');
assert.strictEqual(eventbriteIsOnline({ online_event: true }), true);
const inPersonPatch = mapEventbriteEventToListingPatch({
  id: '2001520723363',
  name: { text: 'Networking Night' },
  description: { text: 'Meet founders.' },
  start: { utc: '2026-10-01T18:00:00Z' },
  end: { utc: '2026-10-01T21:00:00Z' },
  url: 'https://www.eventbrite.co.uk/e/networking-night-2001520723363',
  venue: {
    name: 'The Hub',
    address: { address_1: '1 High Street', city: 'London', postal_code: 'SW1A 1AA' },
  },
});
assert.strictEqual(inPersonPatch.title, 'Networking Night');
assert.strictEqual(inPersonPatch.description, 'Meet founders.');
assert.strictEqual(inPersonPatch.eventFormat, 'In person');
assert.strictEqual(inPersonPatch.venue, 'The Hub');
assert.strictEqual(inPersonPatch.city, 'London');
assert.ok(inPersonPatch.externalBookingUrl.includes('checkout-external'));

const onlinePatch = mapEventbriteEventToListingPatch({
  online_event: true,
  name: { text: 'Zoom social' },
  start: { utc: '2026-11-02T12:00:00Z' },
  url: 'https://www.eventbrite.com/e/zoom-social-1234567890123',
});
assert.strictEqual(onlinePatch.eventFormat, 'Online');
assert.ok(!onlinePatch.venue);

const {
  mapTicketTailorEventToListingPatch,
  ticketTailorIsOnline,
  ticketTailorUrlSlugHint,
  ticketTailorEventMatchesBookingUrl,
  ticketTailorApiKeyFromConfig,
  ticketTailorBasicAuthHeader,
} = require('../api/_lib/connected-booking-providers/adapters/ticket-tailor-api');
assert.strictEqual(ticketTailorIsOnline({ online_event: 'true' }), true);
assert.strictEqual(ticketTailorUrlSlugHint('https://www.tickettailor.com/events/flowerfestival/40980'), 'flowerfestival');
assert.strictEqual(
  ticketTailorApiKeyFromConfig({ ticketTailorApiKey: 'sk_test' }),
  'sk_test'
);
assert.ok(ticketTailorBasicAuthHeader('sk_test').startsWith('Basic '));
assert.strictEqual(
  ticketTailorEventMatchesBookingUrl(
    {
      url: 'https://www.tickettailor.com/events/flowerfestival/40980',
      checkout_url: 'https://www.tickettailor.com/checkout/view-event/id/40980/chk/da99/',
    },
    'https://www.tickettailor.com/events/flowerfestival/40980',
    'flowerfestival'
  ),
  true
);
const ttPatch = mapTicketTailorEventToListingPatch({
  id: 'ev_40980',
  name: 'Flower festival',
  description: 'Outdoor networking.',
  start: { iso: '2026-10-01T18:00:00+01:00' },
  end: { iso: '2026-10-01T21:00:00+01:00' },
  online_event: 'false',
  checkout_url: 'https://www.tickettailor.com/checkout/view-event/id/40980/chk/da99/',
  venue: { name: 'The Gardens', postal_code: 'SW1 3BR', country: 'GB' },
});
assert.strictEqual(ttPatch.title, 'Flower festival');
assert.strictEqual(ttPatch.eventFormat, 'In person');
assert.strictEqual(ttPatch.venue, 'The Gardens');
assert.ok(ttPatch.externalBookingUrl.includes('checkout'));

const ttOnlinePatch = mapTicketTailorEventToListingPatch({
  online_event: 'true',
  name: 'Zoom meetup',
  online_link: 'https://zoom.us/j/123',
  start: { iso: '2026-11-02T12:00:00Z' },
});
assert.strictEqual(ttOnlinePatch.eventFormat, 'Online');
assert.strictEqual(ttOnlinePatch.onlineLink, 'https://zoom.us/j/123');

console.log('test-connected-booking-providers: ok');
