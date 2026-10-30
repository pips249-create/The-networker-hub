#!/usr/bin/env node
/**
 * VAT invoice CTAs:
 * - Stripe-subscribed listings open invoices inline on the dashboard
 * - Marked-paid listings must not deep-link to #vat-invoices
 * - Edit-page jump keeps ?id= when setting the hash
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dash = fs.readFileSync(path.join(root, 'js/organiser-dashboard.js'), 'utf8');
const edit = fs.readFileSync(path.join(root, 'js/organiser-opportunity-edit.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'organiser/index.html'), 'utf8');
const editHtml = fs.readFileSync(path.join(root, 'organiser/opportunity-edit.html'), 'utf8');

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
  'Stripe-subscribed listings open VAT invoices inline on the dashboard',
  /function openOpportunityVatInvoices/.test(dash) &&
    /data-opp-open-vat-invoices/.test(dash) &&
    /opportunity-listing-invoices\?opportunityId=/.test(dash)
);
assert(
  'billing panel no longer deep-links Open VAT invoices to the editor',
  !/Open VAT invoices<\/a>/.test(dash) &&
    /Open VAT invoices<\/button>/.test(dash)
);
assert(
  'edit-page VAT jump preserves query string',
  /next\.pathname \+ next\.search \+ next\.hash/.test(edit) &&
    /data-oe-vat-mailto/.test(edit)
);
assert(
  'organiser dashboard cache keys bumped',
  /organiser-dashboard\.js\?v=20261030vatinvoice2/.test(html) &&
    /organiser-dashboard\.css\?v=20261030vatinvoice2/.test(html)
);
assert(
  'opportunity edit cache key bumped',
  /organiser-opportunity-edit\.js\?v=20261030vatinvoice2/.test(editHtml)
);

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nok: VAT invoice CTAs load Stripe invoices inline and mailto marked-paid');
