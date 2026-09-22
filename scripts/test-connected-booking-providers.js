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

console.log('test-connected-booking-providers: ok');
