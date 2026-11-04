#!/usr/bin/env node
const assert = require('assert');
const { resolveCheckoutAttendeeName } = require('../api/_lib/supabase-registrations');

assert.strictEqual(
  resolveCheckoutAttendeeName({
    metadata: { attendee_name: 'Chris Smith' },
    customer_details: { name: 'Paul Osborne' },
  }),
  'Chris Smith',
  'form name must win over Stripe billing/cardholder name'
);

assert.strictEqual(
  resolveCheckoutAttendeeName({
    metadata: { attendee_name: '  Chris Smith  ' },
    customer_details: { name: 'Paul Osborne' },
  }),
  'Chris Smith',
  'form name should be trimmed'
);

assert.strictEqual(
  resolveCheckoutAttendeeName({
    metadata: { attendee_name: '' },
    customer_details: { name: 'Paul Osborne' },
  }),
  'Paul Osborne',
  'fall back to billing name when form name is missing'
);

assert.strictEqual(
  resolveCheckoutAttendeeName({
    metadata: {},
    customer_details: { name: '  Paul Osborne  ' },
  }),
  'Paul Osborne',
  'billing name fallback should be trimmed'
);

assert.strictEqual(
  resolveCheckoutAttendeeName({
    metadata: {},
    customer_details: {},
  }),
  null,
  'null when neither name is present'
);

assert.strictEqual(resolveCheckoutAttendeeName(null), null);
assert.strictEqual(resolveCheckoutAttendeeName(undefined), null);

console.log('ok — checkout attendee name prefers Hub form over Stripe billing name');
console.log('\nAll checkout attendee name checks passed.');
