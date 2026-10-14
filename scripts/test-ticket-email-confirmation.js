#!/usr/bin/env node
/**
 * Ticket purchase is refused until the account email is confirmed.
 * Stubs Supabase so this does not email anyone or write a booking.
 */
const assert = require('assert');
const path = require('path');

process.env.SESSION_SECRET = 'ticket-email-confirmation-test-secret';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

const supabasePath = require.resolve('../api/_lib/supabase');
require.cache[supabasePath] = {
  id: supabasePath,
  filename: supabasePath,
  loaded: true,
  exports: {
    isSupabaseConfigured: () => true,
    useSupabase: () => true,
    dataProvider: () => 'supabase',
    supabaseConfig: () => ({
      url: process.env.SUPABASE_URL,
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      anonKey: 'anon',
    }),
    getSupabaseAdmin: () => ({
      rpc: async () => ({ data: null, error: { message: 'stub' } }),
      from() {
        throw new Error('stub_db');
      },
    }),
    getSupabaseAnon: () => {
      throw new Error('stub_anon');
    },
    testSupabaseConnection: async () => ({ ok: false, configured: true }),
  },
};

const guardPath = require.resolve('../api/_lib/organiser-access-guard');
require.cache[guardPath] = {
  id: guardPath,
  filename: guardPath,
  loaded: true,
  exports: {
    getOrganiserAccessStatus: async (session) => ({
      organiserEmailVerified: String(session?.email || '').endsWith('@confirmed.test'),
    }),
    assertOrganiserAccess: async () => ({ ok: true }),
    assertOrganiserEmailVerified: async () => ({ ok: true }),
    isPublishIntent: () => false,
  },
};

const { setSessionCookie } = require('../api/_lib/auth');
const { TICKET_EMAIL_NOT_VERIFIED_MESSAGE } = require('../api/_lib/ticket-email-verification');
const createCheckout = require('../api/_lib/routes/auth-create-checkout');
const completeBooking = require('../api/_lib/routes/auth-complete-booking');

assert.equal(
  TICKET_EMAIL_NOT_VERIFIED_MESSAGE,
  "Sorry, it seems you haven't confirmed your email. Please do so now."
);

function mockRes() {
  const headers = {};
  return {
    statusCode: 200,
    body: null,
    headers,
    setHeader(name, value) {
      headers[name] = value;
    },
    getHeader(name) {
      return headers[name];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };
}

function sessionCookie(email) {
  const jar = mockRes();
  const ok = setSessionCookie(jar, {
    sub: 'user-' + email,
    email,
    role: 'client',
    name: 'Test Buyer',
  });
  assert.equal(ok, true);
  const setCookie = String(jar.getHeader('Set-Cookie') || '');
  const match = setCookie.match(/hub_session=([^;]+)/);
  assert.ok(match, 'session cookie set');
  return 'hub_session=' + match[1];
}

function request({ cookie, body }) {
  return {
    method: 'POST',
    headers: {
      origin: 'http://localhost:3000',
      cookie: cookie || '',
      'x-forwarded-for': '203.0.113.10',
    },
    body,
  };
}

async function call(handler, req) {
  const res = mockRes();
  await handler(req, res);
  return res;
}

async function main() {
  const sorry = "Sorry, it seems you haven't confirmed your email. Please do so now.";

  const anon = await call(
    createCheckout,
    request({ body: { name: 'No Account', eventId: 'not-a-uuid' } })
  );
  assert.equal(anon.statusCode, 401);
  assert.equal(anon.body.error, 'not_authenticated');

  const unverified = await call(
    createCheckout,
    request({
      cookie: sessionCookie('buyer@unconfirmed.test'),
      body: { name: 'Buyer', email: 'buyer@unconfirmed.test', eventId: 'not-a-uuid' },
    })
  );
  assert.equal(unverified.statusCode, 403, JSON.stringify(unverified.body));
  assert.equal(unverified.body.error, 'email_not_verified');
  assert.equal(unverified.body.message, sorry);
  assert.match(unverified.body.redirect, /^\/organiser\/verify-email\?/);
  assert.match(unverified.body.redirect, /email=buyer%40unconfirmed\.test/);
  assert.doesNotMatch(unverified.body.redirect, /code=/);

  const mismatch = await call(
    createCheckout,
    request({
      cookie: sessionCookie('buyer@confirmed.test'),
      body: { name: 'Buyer', email: 'other@example.com', eventId: 'not-a-uuid' },
    })
  );
  assert.equal(mismatch.statusCode, 403);
  assert.equal(mismatch.body.error, 'checkout_email_mismatch');

  const confirmed = await call(
    createCheckout,
    request({
      cookie: sessionCookie('buyer@confirmed.test'),
      body: { name: 'Buyer', email: 'buyer@confirmed.test', eventId: 'not-a-uuid' },
    })
  );
  assert.equal(confirmed.statusCode, 400, JSON.stringify(confirmed.body));
  assert.equal(confirmed.body.error, 'invalid_event_id');

  const freeBlocked = await call(
    completeBooking,
    request({
      cookie: sessionCookie('buyer@unconfirmed.test'),
      body: { eventId: '00000000-0000-4000-8000-000000000001', paymentStatus: 'Free', amountPaid: 0 },
    })
  );
  assert.equal(freeBlocked.statusCode, 403, JSON.stringify(freeBlocked.body));
  assert.equal(freeBlocked.body.error, 'email_not_verified');
  assert.equal(freeBlocked.body.message, sorry);

  const paidInFlight = await call(
    completeBooking,
    request({
      cookie: sessionCookie('buyer@unconfirmed.test'),
      body: { eventId: '00000000-0000-4000-8000-000000000001', paymentStatus: 'Paid' },
    })
  );
  assert.equal(paidInFlight.statusCode, 400, JSON.stringify(paidInFlight.body));
  assert.equal(paidInFlight.body.error, 'missing_checkout_session');

  const page = require('fs').readFileSync(
    path.join(__dirname, '../organiser/verify-email.html'),
    'utf8'
  );
  assert.match(page, /Sorry, it seems you haven't confirmed your email\. Please do so now\./);

  console.log('OK  ticket email confirmation');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
