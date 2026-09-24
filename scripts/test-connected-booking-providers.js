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
  isEventbriteAttendeeNotification,
  isEventbriteConnectivityPing,
  resolveEventbriteWebhookRegistrations,
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
  eventbriteAttendeeRefFromApiUrl,
  registrationsFromEventbriteOrder,
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

const twoTicketOrder = normalizeEventbriteOrderApiResponse({
  id: '555',
  event_id: '2001520723363',
  email: 'buyer@example.com',
  name: 'Alex Buyer',
  quantity: 2,
  costs: { gross: { value: 3000 } },
  attendees: [
    {
      id: 'att-1',
      profile: { email: 'buyer@example.com', name: 'Alex Buyer', company: 'Northwind' },
      costs: { gross: { value: 1500 } },
    },
    {
      id: 'att-2',
      profile: { first_name: 'Sam', last_name: 'Guest', job_title: 'Founder' },
      answers: [{ question: 'Email address', type: 'text', answer: 'sam@example.com' }],
      costs: { gross: { value: 1500 } },
    },
  ],
});
assert.strictEqual(twoTicketOrder.length, 2, 'both ticket holders become registrations');
assert.strictEqual(twoTicketOrder[0].email, 'buyer@example.com');
assert.strictEqual(twoTicketOrder[0].company, 'Northwind');
assert.strictEqual(twoTicketOrder[0].amountPaid, 15);
assert.strictEqual(twoTicketOrder[1].email, 'sam@example.com');
assert.strictEqual(twoTicketOrder[1].name, 'Sam Guest');
assert.strictEqual(twoTicketOrder[1].jobTitle, 'Founder');
assert.strictEqual(twoTicketOrder[1].amountPaid, 15);
assert.notStrictEqual(twoTicketOrder[0].orderId, twoTicketOrder[1].orderId);

const buyerOnlyExpand = registrationsFromEventbriteOrder(
  {
    id: '555',
    event_id: '2001520723363',
    email: 'buyer@example.com',
    name: 'Alex Buyer',
    quantity: 2,
    attendees: 'https://www.eventbriteapi.com/v3/orders/555/attendees/',
    costs: { gross: { value: 3000 } },
  },
  [
    [
      { id: 'att-1', profile: { email: 'buyer@example.com', name: 'Alex Buyer' } },
      { id: 'att-2', profile: { first_name: 'Sam', last_name: 'Guest', email: 'sam@example.com' } },
    ],
  ]
);
assert.strictEqual(buyerOnlyExpand.length, 2, 'attendees endpoint fills in the second ticket holder');
assert.strictEqual(buyerOnlyExpand[1].name, 'Sam Guest');
assert.strictEqual(buyerOnlyExpand[1].email, 'sam@example.com');
assert.strictEqual(buyerOnlyExpand[0].amountPaid, 30);
assert.strictEqual(buyerOnlyExpand[1].amountPaid, 0);

const namedGuestWithoutEmail = normalizeEventbriteOrderApiResponse({
  id: '556',
  event_id: '2001520723363',
  attendees: [
    { id: 'att-1', profile: { email: 'buyer@example.com', name: 'Alex Buyer' } },
    { id: 'att-2', profile: { first_name: 'Sam', last_name: 'Guest' } },
  ],
});
assert.strictEqual(namedGuestWithoutEmail.length, 1);
assert.deepStrictEqual(namedGuestWithoutEmail[0].guestNames, ['Sam Guest']);
assert.strictEqual(namedGuestWithoutEmail[0].quantity, 2);

assert.deepStrictEqual(
  eventbriteAttendeeRefFromApiUrl(
    'https://www.eventbriteapi.com/v3/events/2001520723363/attendees/998877/'
  ),
  { eventId: '2001520723363', attendeeId: '998877' }
);
const attendeeHook = {
  api_url: 'https://www.eventbriteapi.com/v3/events/2001520723363/attendees/998877/',
  config: { action: 'attendee.updated', endpoint_url: 'https://www.thenetworkeruk.com/w/eb/test' },
};
const attendeeHookNorm = normalizeEventbriteWebhook(attendeeHook);
assert.ok(isEventbriteAttendeeNotification(attendeeHook));
assert.ok(
  !isEventbriteConnectivityPing(attendeeHook, attendeeHookNorm),
  'attendee.updated must not be treated as a connectivity ping'
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

function jsonResponse(body, status) {
  return {
    ok: (status || 200) < 400,
    status: status || 200,
    text: async function () {
      return JSON.stringify(body);
    },
  };
}

async function runEventbriteFetchChecks() {
  const original = global.fetch;
  global.fetch = async function (url) {
    const href = String(url);
    if (href.includes('/orders/555/attendees/')) {
      if (href.includes('continuation=page2')) {
        return jsonResponse({
          pagination: { has_more_items: false },
          attendees: [
            {
              id: '998877',
              event_id: '2001520723363',
              order_id: '555',
              profile: { first_name: 'Sam', last_name: 'Guest', email: 'sam@example.com' },
            },
          ],
        });
      }
      return jsonResponse({
        pagination: { has_more_items: true, continuation: 'page2' },
        attendees: [
          {
            id: 'att-1',
            event_id: '2001520723363',
            order_id: '555',
            profile: { email: 'buyer@example.com', name: 'Alex Buyer' },
          },
        ],
      });
    }
    if (href.includes('/events/2001520723363/attendees/998877')) {
      return jsonResponse({
        id: '998877',
        event_id: '2001520723363',
        order_id: '555',
        profile: { first_name: 'Sam', last_name: 'Guest', email: 'sam@example.com', company: 'Contoso' },
      });
    }
    if (href.includes('/orders/555')) {
      return jsonResponse({
        id: '555',
        event_id: '2001520723363',
        email: 'buyer@example.com',
        name: 'Alex Buyer',
        quantity: 2,
        attendees: 'https://www.eventbriteapi.com/v3/orders/555/attendees/',
        costs: { gross: { value: 3000 } },
      });
    }
    throw new Error('unexpected fetch ' + href);
  };

  try {
    const placed = await resolveEventbriteWebhookRegistrations(
      {
        api_url: 'https://www.eventbriteapi.com/v3/orders/555/',
        config: { action: 'order.placed' },
      },
      { config: { eventbritePrivateToken: 'tok' } }
    );
    assert.strictEqual(placed.registrations.length, 2, 'order.placed loads every attendee page');
    assert.strictEqual(placed.registrations[1].email, 'sam@example.com');
    assert.strictEqual(placed.registrations[1].name, 'Sam Guest');

    const updated = await resolveEventbriteWebhookRegistrations(
      {
        api_url: 'https://www.eventbriteapi.com/v3/events/2001520723363/attendees/998877/',
        config: { action: 'attendee.updated' },
      },
      { config: { eventbritePrivateToken: 'tok' } }
    );
    assert.strictEqual(updated.source, 'eventbrite_api');
    assert.strictEqual(updated.registrations.length, 2);
    const sam = updated.registrations.find(function (row) {
      return row.email === 'sam@example.com';
    });
    assert.ok(sam, 'attendee.updated includes the second ticket holder');
    assert.strictEqual(sam.name, 'Sam Guest');
    assert.strictEqual(sam.company, 'Contoso');
  } finally {
    global.fetch = original;
  }
}

runEventbriteFetchChecks()
  .then(function () {
    console.log('test-connected-booking-providers: ok');
  })
  .catch(function (err) {
    console.error(err);
    process.exit(1);
  });
