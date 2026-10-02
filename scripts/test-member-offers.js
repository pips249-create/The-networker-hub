#!/usr/bin/env node
const {
  normalizeMemberOfferInput,
  isMemberOfferId,
  memberOfferFromRow,
  publishGaps,
  memberOfferIsLive,
  missingOfferExtras,
} = require('../api/_lib/member-offers');
const { prepareMemberOfferEnquire } = require('../api/_lib/member-offer-enquire');

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
if (created.ok || created.errors.indexOf('imageUrl') === -1) {
  fail('publishing without a picture must be rejected');
}
if (created.fields.title !== 'Swft Business Cards') fail('title was not trimmed');
if (created.fields.href !== 'https://example.com/swft') fail('https link was dropped');
if (created.fields.published !== true) fail('published flag');
if (created.fields.image_url !== '') fail('blank image should be empty');

const ready = normalizeMemberOfferInput({
  title: 'Swft Business Cards',
  href: 'https://example.com/swft',
  imageUrl: 'https://example.com/swft.jpg',
  published: true,
});
if (!ready.ok) fail('a link and a picture should be enough to publish');
if (publishGaps({ published: true, href: ready.fields.href, imageUrl: ready.fields.image_url }).length) {
  fail('publish gaps should be empty when link and picture are set');
}
if (publishGaps({ published: false, href: '', imageUrl: '' }).length) {
  fail('drafts can omit the link and picture');
}

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

const detailed = normalizeMemberOfferInput({
  title: 'Swft Business Cards',
  details: '  First paragraph.\n\nSecond paragraph.  ',
  published: false,
});
if (!detailed.ok) fail('details should be accepted');
if (detailed.fields.details !== 'First paragraph.\n\nSecond paragraph.') {
  fail('details should keep paragraphs, got ' + JSON.stringify(detailed.fields.details));
}

const sorted = normalizeMemberOfferInput({ title: 'Cards', sortOrder: 99999 });
if (sorted.fields.sort_order !== 9999) fail('sort order should clamp');

const coded = normalizeMemberOfferInput({
  title: 'Swft Business Cards',
  promoCode: '  NETWORKER  ',
  endsOn: '2026-12-31',
  published: false,
});
if (!coded.ok || coded.fields.promo_code !== 'NETWORKER' || coded.fields.ends_on !== '2026-12-31') {
  fail('code and end date should be kept');
}
const badDate = normalizeMemberOfferInput({ title: 'Cards', endsOn: 'next week', published: false });
if (badDate.ok || badDate.errors.indexOf('endsOn') === -1) fail('a bad end date must be rejected');
if (memberOfferIsLive({ published: true, endsOn: '2020-01-01' }, '2026-10-02')) {
  fail('an offer should end after its end date');
}
if (!memberOfferIsLive({ published: true, endsOn: '2026-10-02' }, '2026-10-02')) {
  fail('an offer should stay up on its end date');
}
if (!memberOfferIsLive({ published: true, endsOn: '' }, '2026-10-02')) {
  fail('an offer with no end date should stay up');
}
if (!missingOfferExtras({ message: "Could not find the 'promo_code' column of 'member_offers' in the schema cache" })) {
  fail('a missing code column should be recognised');
}
if (missingOfferExtras({ message: 'connection refused' })) fail('unrelated errors are not a missing column');

if (isMemberOfferId('not-an-id')) fail('bad id accepted');
if (!isMemberOfferId('11111111-1111-4111-8111-111111111111')) fail('uuid rejected');

const row = memberOfferFromRow({
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Swft Business Cards',
  provider: 'Swft',
  category: 'Business cards',
  highlight: '3 months free',
  summary: 'Member offer.',
  details: 'More about the offer.',
  href: '',
  image_url: '',
  published: false,
  sort_order: 10,
});
if (!row || row.imageUrl !== '' || row.published !== false || row.sortOrder !== 10 || row.details !== 'More about the offer.') {
  fail('row mapping');
}

const enquire = prepareMemberOfferEnquire(
  { offer: 'Three months of business cards', audience: 'New networkers', website: 'https://example.com' },
  { name: 'Sam Member', email: 'sam@example.com' }
);
if (!enquire.ok || enquire.input.email !== 'sam@example.com' || enquire.input.offer.indexOf('business cards') === -1) {
  fail('enquiry should use the signed-in email');
}
const shortEnquire = prepareMemberOfferEnquire({ offer: 'Too short' }, { email: 'sam@example.com' });
if (shortEnquire.ok) fail('a short offer note must be rejected');
const badSite = prepareMemberOfferEnquire(
  { offer: 'A useful member trial for cards', website: 'javascript:alert(1)' },
  { email: 'sam@example.com' }
);
if (badSite.ok) fail('enquiry website must be http(s)');

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

  const enquireHandler = require('../api/_lib/routes/auth-member-offer-enquire');
  const enquireAnon = mockRes();
  await enquireHandler(
    {
      method: 'POST',
      url: '/api/auth/member-offer-enquire',
      headers: { 'content-type': 'application/json' },
      body: { offer: 'Three months of business cards for members' },
    },
    enquireAnon
  );
  if (enquireAnon.statusCode !== 401) fail('signed-out enquiry should be 401, got ' + enquireAnon.statusCode);

  console.log('OK: member offers route requires sign-in');
})().catch(function (err) {
  fail(err && err.stack ? err.stack : err);
});
