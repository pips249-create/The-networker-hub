#!/usr/bin/env node
/**
 * Eventbrite / external Connected booking revenue must:
 * - use amount_paid as face revenue (no Hub fee reverse-engineering)
 * - drop cancelled buyers from revenue as well as tickets sold / Attendees
 */
const assert = require('assert');
const path = require('path');
const Module = require('module');

// Avoid loading Supabase when we only need pure helpers from payouts.
const payoutsPath = path.join(__dirname, '../api/_lib/supabase-organiser-payouts.js');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === './supabase' || request.endsWith('/supabase')) {
    return {
      getSupabaseAdmin: function () {
        throw new Error('supabase_not_needed');
      },
      isSupabaseConfigured: function () {
        return false;
      },
    };
  }
  if (request === './supabase-organiser-access') {
    return { resolveOrganiserAccess: async function () { return { groupIds: [] }; } };
  }
  if (request === './stripe-connect') {
    return { isStripeConnectEnabled: function () { return false; } };
  }
  return originalLoad.apply(this, arguments);
};

const {
  applyRegistrationSalesToEventList,
  isRevenueCountableRegistration,
} = require(payoutsPath);
const { registrationTicketRevenue, registrationBookingFee } = require('../api/_lib/booking-fees');

Module._load = originalLoad;

assert.strictEqual(
  registrationTicketRevenue({ amount_paid: 2.04, quantity: 1, booking_source: 'external' }),
  2.04,
  'external amount_paid is face revenue'
);
assert.strictEqual(
  registrationBookingFee({ amount_paid: 2.04, quantity: 1, booking_source: 'external' }),
  0,
  'external bookings have no Hub booking fee'
);
assert.ok(
  registrationTicketRevenue({ amount_paid: 2.04, quantity: 1 }) < 2.04,
  'hub checkouts still strip booking fee'
);

const cancelledExternal = {
  event_id: 'ev-eb',
  payment_status: 'Paid',
  quantity: 1,
  amount_paid: 2.04,
  booking_source: 'external',
  cancelled_at: '2026-10-30T12:00:00.000Z',
};
assert.strictEqual(
  isRevenueCountableRegistration(cancelledExternal, {
    eventRow: { status: 'published', refund_policy: 'no_refunds' },
  }),
  false,
  'cancelled Eventbrite buyer is not revenue'
);

const events = [{ id: 'ev-eb', title: 'Testing The Networker UK Connection', ticketsCapacity: 0 }];
const enriched = applyRegistrationSalesToEventList(events, [cancelledExternal], []);
assert.strictEqual(enriched[0].ticketsSold, 0);
assert.strictEqual(enriched[0].ticketsSoldLabel, '0 / —');
assert.strictEqual(enriched[0].revenueNum, 0);
assert.strictEqual(enriched[0].revenueDisplay, '£0.00');

const activeExternal = {
  event_id: 'ev-eb',
  payment_status: 'Paid',
  quantity: 1,
  amount_paid: 2.04,
  booking_source: 'external',
};
const live = applyRegistrationSalesToEventList(events, [activeExternal], []);
assert.strictEqual(live[0].ticketsSold, 1);
assert.strictEqual(live[0].revenueNum, 2.04);
assert.strictEqual(live[0].revenueDisplay, '£2.04');

console.log('test-external-booking-revenue: ok');
