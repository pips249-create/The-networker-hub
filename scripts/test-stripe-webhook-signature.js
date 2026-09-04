#!/usr/bin/env node
/**
 * Unit test: Stripe webhook signature verification must use the raw body.
 *
 *   node scripts/test-stripe-webhook-signature.js
 */
const assert = require('assert');
const Stripe = require('stripe');

const secret = 'whsec_' + Buffer.from('test_secret_value_here_ok').toString('base64');
const rawBody = `{
  "id": "evt_test_signature",
  "object": "event",
  "type": "invoice.paid",
  "data": {
    "object": {
      "id": "in_test"
    }
  }
}`;

const header = Stripe.webhooks.generateTestHeaderString({
  payload: rawBody,
  secret,
});

const event = Stripe.webhooks.constructEvent(rawBody, header, secret);
assert.strictEqual(event.type, 'invoice.paid');

const mangled = JSON.stringify(JSON.parse(rawBody));
assert.notStrictEqual(mangled, rawBody, 'Stripe payloads include whitespace; re-stringify must differ');

let mangledFailed = false;
try {
  Stripe.webhooks.constructEvent(mangled, header, secret);
} catch (err) {
  mangledFailed = true;
  assert.match(String(err.message || err), /No signatures found matching the expected signature/i);
}
assert.ok(mangledFailed, 'JSON.stringify(parsed body) must fail signature verification');

const trimmedSecret = ('  ' + secret + '\n').trim();
const eventTrimmed = Stripe.webhooks.constructEvent(rawBody, header, trimmedSecret);
assert.strictEqual(eventTrimmed.id, event.id);

console.log('test-stripe-webhook-signature: ok');
