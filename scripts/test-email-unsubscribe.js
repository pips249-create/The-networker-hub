#!/usr/bin/env node
/**
 * Unsubscribe tokens, footer URLs, and the public route's request parsing.
 * Run: node scripts/test-email-unsubscribe.js
 */
const assert = require('assert');

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-unsubscribe-secret';

const {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  maskEmail,
} = require('../api/_lib/unsubscribe-token');
const { unsubscribeUrl, oneClickUnsubscribeUrl } = require('../api/_lib/hub-email-urls');
const { ensureUnsubscribeLink } = require('../api/_lib/email-footer-unsubscribe');
const { normalizeUnsubscribeReason, unsubscribeReasonLabel } = require('../api/_lib/email-unsubscribe');

const email = 'Alex.Morgan@Example.com';
const token = createUnsubscribeToken(email);
assert.ok(token, 'token is created when SESSION_SECRET is set');
const parsed = verifyUnsubscribeToken(token);
assert.strictEqual(parsed.email, 'alex.morgan@example.com');
assert.strictEqual(verifyUnsubscribeToken(token + 'x'), null);
assert.strictEqual(verifyUnsubscribeToken('not-a-token'), null);
assert.strictEqual(maskEmail('alex.morgan@example.com'), 'a***@example.com');

const page = unsubscribeUrl('https://www.thenetworkeruk.com', email);
assert.ok(page.startsWith('https://www.thenetworkeruk.com/unsubscribe?t='), page);
assert.strictEqual(unsubscribeUrl('https://www.thenetworkeruk.com'), 'https://www.thenetworkeruk.com/unsubscribe');

const named = unsubscribeUrl('https://www.thenetworkeruk.com', 'Alex Morgan <alex.morgan@example.com>');
assert.ok(named.includes('/unsubscribe?t='), named);
const namedParsed = verifyUnsubscribeToken(decodeURIComponent(named.split('?t=')[1]));
assert.strictEqual(namedParsed.email, 'alex.morgan@example.com');

const oneClick = oneClickUnsubscribeUrl('https://www.thenetworkeruk.com', email);
assert.ok(oneClick.startsWith('https://www.thenetworkeruk.com/api/auth/unsubscribe?t='), oneClick);
assert.strictEqual(oneClickUnsubscribeUrl('https://www.thenetworkeruk.com', ''), '');

const previousSecret = process.env.SESSION_SECRET;
process.env.SESSION_SECRET = '';
assert.strictEqual(createUnsubscribeToken(email), '');
assert.strictEqual(verifyUnsubscribeToken(token), null);
process.env.SESSION_SECRET = previousSecret;

const expired = createUnsubscribeToken(email, { ttlDays: -1 });
assert.strictEqual(verifyUnsubscribeToken(expired), null);

const html = ensureUnsubscribeLink(
  '<td class="mobile-footer-pad"><a href="https://www.thenetworkeruk.com/contact">Contact</a></p></td>',
  page
);
assert.ok(/Unsubscribe/.test(html), 'footer gains an unsubscribe link');
assert.ok(html.includes('https://www.thenetworkeruk.com/unsubscribe'), 'footer points at the unsubscribe page');

const authSource = require('fs').readFileSync(require('path').join(__dirname, '../api/auth.js'), 'utf8');
assert.ok(authSource.includes("unsubscribe: require('./_lib/routes/auth-unsubscribe')"));

const settings = require('fs').readFileSync(require('path').join(__dirname, '../account/settings.html'), 'utf8');
assert.ok(settings.includes('id="as-unsub-guest-form"'));
assert.ok(settings.includes('id="as-unsubscribe-all"'));
assert.ok(settings.includes('id="as-unsub-reason"'));

const pageHtml = require('fs').readFileSync(require('path').join(__dirname, '../unsubscribe.html'), 'utf8');
assert.ok(pageHtml.includes('Want this page taken down?'));
assert.ok(pageHtml.includes('mailto:hi@thenetworkeruk.com?subject=Please%20take%20down%20my%20page'));
assert.ok(pageHtml.includes('id="unsub-reason"'));
assert.ok(pageHtml.includes('value="too_many"'));
assert.strictEqual(normalizeUnsubscribeReason('too_many'), 'too_many');
assert.strictEqual(normalizeUnsubscribeReason('nope'), '');
assert.strictEqual(unsubscribeReasonLabel('never_signed_up'), "I didn't sign up");

const adminSource = require('fs').readFileSync(require('path').join(__dirname, '../api/admin.js'), 'utf8');
assert.ok(adminSource.includes("unsubscribes: require('./_lib/routes/admin-unsubscribes')"));

const { shouldAttachListUnsubscribe, sendTemplatedEmail } = require('../api/_lib/send-template-email');
assert.strictEqual(shouldAttachListUnsubscribe('organiser_directory_invite'), true);
assert.strictEqual(shouldAttachListUnsubscribe('organiser_directory_invite_day35'), true);
assert.strictEqual(shouldAttachListUnsubscribe('organiser_claim_invite'), true);
assert.strictEqual(shouldAttachListUnsubscribe('booking_confirmation'), false);
assert.strictEqual(shouldAttachListUnsubscribe('password_reset'), false);

const unsub = require('../api/_lib/email-unsubscribe');
const originalSuppressed = unsub.isEmailSuppressed;
unsub.isEmailSuppressed = async function (address) {
  assert.strictEqual(String(address).toLowerCase(), 'gone@example.com');
  return true;
};
(async function () {
  try {
    await sendTemplatedEmail({
      slug: 'organiser_directory_invite',
      to: 'gone@example.com',
      skipEmailCheck: true,
      variables: {},
    });
    assert.fail('unsubscribed address should not receive a directory invite');
  } catch (e) {
    assert.strictEqual(e.code, 'emails_disabled');
  } finally {
    unsub.isEmailSuppressed = originalSuppressed;
  }
  console.log('email unsubscribe checks passed');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
