#!/usr/bin/env node
const {
  normalizeMemberOfferInput,
  isMemberOfferId,
  memberOfferFromRow,
} = require('../api/_lib/member-offers');

function fail(message) {
  console.error('FAIL: ' + message);
  process.exit(1);
}

const created = normalizeMemberOfferInput({
  title: '  Swft   Business Cards ',
  provider: 'Swft',
  category: 'Business cards',
  highlight: '3 months free',
  summary: 'Member offer on Swft business cards.',
  href: 'https://example.com/swft',
  imageUrl: '',
  published: true,
  sortOrder: 10,
});
if (!created.ok) fail('expected a valid offer');
if (created.fields.title !== 'Swft Business Cards') fail('title was not trimmed');
if (created.fields.href !== 'https://example.com/swft') fail('https link was dropped');
if (created.fields.published !== true) fail('published flag');
if (created.fields.image_url !== '') fail('blank image should be empty');

const blocked = normalizeMemberOfferInput({
  title: 'Franchise help',
  href: 'javascript:alert(1)',
});
if (blocked.ok || blocked.errors.indexOf('href') === -1) fail('javascript links must be rejected');

const missing = normalizeMemberOfferInput({ provider: 'Swft' });
if (missing.ok || missing.errors.indexOf('title') === -1) fail('title is required');

const patched = normalizeMemberOfferInput({ highlight: '3 months free' }, { partial: true });
if (!patched.ok) fail('partial update should not require a title');
if (patched.fields.highlight !== '3 months free') fail('partial highlight');
if (Object.prototype.hasOwnProperty.call(patched.fields, 'title')) {
  fail('partial update invented a title');
}

const sorted = normalizeMemberOfferInput({ title: 'Cards', sortOrder: 99999 });
if (sorted.fields.sort_order !== 9999) fail('sort order should clamp');

if (isMemberOfferId('not-an-id')) fail('bad id accepted');
if (!isMemberOfferId('11111111-1111-4111-8111-111111111111')) fail('uuid rejected');

const row = memberOfferFromRow({
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Swft Business Cards',
  provider: 'Swft',
  category: 'Business cards',
  highlight: '3 months free',
  summary: 'Member offer.',
  href: '',
  image_url: '',
  published: false,
  sort_order: 10,
});
if (!row || row.imageUrl !== '' || row.published !== false || row.sortOrder !== 10) {
  fail('row mapping');
}

console.log('OK: member offer validation');

const handler = require('../api/_lib/routes/auth-member-offers');

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: null,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    getHeader(key) {
      return this.headers[key];
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

(async function () {
  const anon = mockRes();
  await handler({ method: 'GET', url: '/api/auth/member-offers', headers: {} }, anon);
  if (anon.statusCode !== 401 || !anon.body || anon.body.error !== 'not_authenticated') {
    fail('signed-out read should be 401, got ' + anon.statusCode);
  }

  const write = mockRes();
  await handler(
    {
      method: 'POST',
      url: '/api/auth/member-offers',
      headers: { 'content-type': 'application/json' },
      body: { title: 'Swft Business Cards', highlight: '3 months free' },
    },
    write
  );
  if (write.statusCode !== 401) fail('signed-out create should be 401, got ' + write.statusCode);

  const preflight = mockRes();
  await handler({ method: 'OPTIONS', url: '/api/auth/member-offers', headers: {} }, preflight);
  if (preflight.statusCode !== 200) fail('options should be 200');

  console.log('OK: member offers route requires sign-in');
})().catch(function (err) {
  fail(err && err.stack ? err.stack : err);
});
