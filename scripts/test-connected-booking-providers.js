#!/usr/bin/env node
const assert = require('assert');
const { normalizeEventbriteWebhook } = require('../api/_lib/connected-booking-providers/adapters/eventbrite');
const { normalizeTicketTailorWebhook } = require('../api/_lib/connected-booking-providers/adapters/ticket-tailor');
const { normalizeLumaWebhook } = require('../api/_lib/connected-booking-providers/adapters/luma');
const { normalizeTryBookingWebhook } = require('../api/_lib/connected-booking-providers/adapters/trybooking');
const { isConnectedBookingProviderId, CONNECTED_BOOKING_PROVIDERS } = require('../api/_lib/connected-booking-providers');

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

console.log('test-connected-booking-providers: ok');
