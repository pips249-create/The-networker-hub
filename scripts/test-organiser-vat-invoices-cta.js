#!/usr/bin/env node
/**
 * VAT invoice CTAs:
 * - Stripe-subscribed listings open invoices inline on the dashboard
 * - Complimentary / marked-paid listings open an automatic account statement
 * - Edit-page jump keeps ?id= when setting the hash
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dash = fs.readFileSync(path.join(root, 'js/organiser-dashboard.js'), 'utf8');
const edit = fs.readFileSync(path.join(root, 'js/organiser-opportunity-edit.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'organiser/index.html'), 'utf8');
const editHtml = fs.readFileSync(path.join(root, 'organiser/opportunity-edit.html'), 'utf8');
const api = fs.readFileSync(
  path.join(root, 'api/_lib/routes/organiser-opportunity-listing-invoices.js'),
  'utf8'
);
const receipt = fs.readFileSync(
  path.join(root, 'api/_lib/opportunity-listing-vat-receipt.js'),
  'utf8'
);

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
  'complimentary listings do not use a support mailto CTA',
  !/function opportunityVatInvoicesMailto/.test(dash) &&
    !/Email for VAT invoices/.test(dash)
);
assert(
  'API builds complimentary account statements without Stripe',
  /buildComplimentaryListingAccountInvoice/.test(api) &&
    /function buildComplimentaryListingAccountInvoice/.test(receipt) &&
    /billingMode: 'complimentary'/.test(api)
);
assert(
  'Stripe-subscribed and complimentary listings open VAT invoices inline',
  /function openOpportunityVatInvoices/.test(dash) &&
    /data-opp-open-vat-invoices/.test(dash) &&
    /opportunity-listing-invoices\?opportunityId=/.test(dash) &&
    /Complimentary · statement kept on your account/.test(dash)
);
assert(
  'billing panel no longer deep-links Open VAT invoices to the editor',
  !/Open VAT invoices<\/a>/.test(dash) && /Open VAT invoices<\/button>/.test(dash)
);
assert(
  'edit-page VAT jump preserves query string',
  /next\.pathname \+ next\.search \+ next\.hash/.test(edit)
);
assert(
  'edit page shows complimentary account statement copy',
  /Account statement/.test(edit) && /complimentary<\/strong> term/.test(edit)
);
assert(
  'organiser dashboard cache keys bumped',
  /organiser-dashboard\.js\?v=20261030compvat1/.test(html) &&
    /organiser-dashboard\.css\?v=20261030compvat1/.test(html)
);
assert(
  'opportunity edit cache key bumped',
  /organiser-opportunity-edit\.js\?v=20261030compvat1/.test(editHtml)
);

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log(
  '\nok: VAT invoice CTAs load Stripe invoices / complimentary statements on account'
);
