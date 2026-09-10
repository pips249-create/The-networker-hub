#!/usr/bin/env node
/**
 * Unit test: readRawBody must recover Stripe-signed bytes when Vercel Node
 * helpers parse JSON into req.body but restore the original stream.
 *
 *   node scripts/test-stripe-webhook-raw-body.js
 */
const assert = require('assert');
const { PassThrough, Readable } = require('stream');
const Stripe = require('stripe');
const { _test } = require('../api/stripe-webhook');

const { readRawBody, verifyAndParseStripeEvent } = _test;

const secret = 'whsec_' + Buffer.from('test_secret_value_here_ok').toString('base64');
const rawBody = `{
  "id": "evt_test_raw_body",
  "object": "event",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test"
    }
  }
}`;

/** Mimic @vercel/node restoreBody + lazy JSON req.body. */
function mockVercelParsedRequest(raw) {
  const buf = Buffer.from(raw, 'utf8');
  const replicateBody = new PassThrough();
  const req = new Readable({ read() {} });
  const originalOn = req.on.bind(req);
  const on = replicateBody.on.bind(replicateBody);

  req.read = replicateBody.read.bind(replicateBody);
  req.on = req.addListener = function (name, cb) {
    return name === 'data' || name === 'end' ? on(name, cb) : originalOn(name, cb);
  };
  replicateBody.write(buf);
  replicateBody.end();

  // Parsed object present (what triggers the old raw_body_unavailable path).
  Object.defineProperty(req, 'body', {
    configurable: true,
    enumerable: true,
    value: JSON.parse(raw),
  });

  return req;
}

(async function main() {
  const req = mockVercelParsedRequest(rawBody);
  assert.strictEqual(typeof req.body, 'object');
  assert.notStrictEqual(JSON.stringify(req.body), rawBody);

  const recovered = await readRawBody(req);
  assert.strictEqual(recovered, rawBody, 'must recover exact raw bytes from restored stream');

  const header = Stripe.webhooks.generateTestHeaderString({
    payload: rawBody,
    secret,
  });
  const event = verifyAndParseStripeEvent(recovered, header, secret);
  assert.strictEqual(event.type, 'checkout.session.completed');

  // Parsed object with no stream bytes must still fail closed.
  const dead = new Readable({ read() {} });
  dead.push(null);
  dead.body = { id: 'evt_dead' };
  let failed = false;
  try {
    await readRawBody(dead);
  } catch (err) {
    failed = true;
    assert.strictEqual(err.code, 'parsed_body_not_raw');
  }
  assert.ok(failed, 'empty stream + parsed body must reject');

  console.log('test-stripe-webhook-raw-body: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
