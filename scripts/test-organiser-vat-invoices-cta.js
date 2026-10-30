#!/usr/bin/env node
/**
 * Marked-paid opportunity listings must not deep-link to #vat-invoices —
 * the editor cannot load Stripe invoices without a subscription id.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dash = fs.readFileSync(path.join(root, 'js/organiser-dashboard.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'organiser/index.html'), 'utf8');

let failed = 0;
function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

assert(
  'helper detects Stripe listing subscriptions',
  /function opportunityHasStripeListingSubscription/.test(dash)
);
assert(
  'marked-paid listings get a support mailto for VAT invoices',
  /function opportunityVatInvoicesMailto/.test(dash) &&
    /hi@thenetworkeruk\.com/.test(dash)
);
assert(
  'billing panel uses mailto when there is no Stripe subscription',
  /Email for VAT invoices/.test(dash) &&
    /opportunityVatInvoicesMailto\(o\)/.test(dash)
);
assert(
  'Stripe-subscribed listings still deep-link to #vat-invoices',
  /opportunityEditUrl\(o\) \+ '#vat-invoices'/.test(dash)
);
assert(
  'organiser dashboard cache key bumped',
  /organiser-dashboard\.js\?v=20261030ticketsvat1/.test(html)
);

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nok: VAT invoice CTAs distinguish Stripe vs marked-paid listings');
